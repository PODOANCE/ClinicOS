-- ============================================================================
-- MIGRACIÓN: Phase 2A — Reprocesamiento Manual de IA
-- Fecha: 2026-09-06
-- Objetivo: Endpoint para reprocesar facturas con Claude, aplicar extracciones
--           de forma transaccional, y recuperar operaciones colgadas
-- ============================================================================

-- ============================================================================
-- 1. TABLA: facturas_reprocesamiento_ia
-- Propósito: Controlar operaciones activas (máx 1 PENDIENTE/EN_PROCESO por factura)
-- ============================================================================

CREATE TABLE public.facturas_reprocesamiento_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID NOT NULL REFERENCES public.facturas(id) ON DELETE RESTRICT,
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  estado VARCHAR NOT NULL DEFAULT 'PENDIENTE',
  extraccion_ia_id UUID REFERENCES public.facturas_extraccion_ia(id) ON DELETE SET NULL,
  error_mensaje TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  iniciado_en TIMESTAMPTZ,
  completado_en TIMESTAMPTZ,

  -- Validaciones
  CONSTRAINT estado_valid CHECK (estado IN ('PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'ERROR'))
);

-- Índice ÚNICO PARCIAL: máx 1 operación activa (PENDIENTE o EN_PROCESO) por factura
-- ✅ CORRECTO: (factura_id) WHERE estado IN (...) — garantiza máx 1 activo, permite histórico
CREATE UNIQUE INDEX idx_reprocesamiento_activo
ON public.facturas_reprocesamiento_ia (factura_id)
WHERE estado IN ('PENDIENTE', 'EN_PROCESO');

-- Índices secundarios para búsquedas comunes
CREATE INDEX idx_reprocesamiento_factura_id ON public.facturas_reprocesamiento_ia(factura_id);
CREATE INDEX idx_reprocesamiento_estado ON public.facturas_reprocesamiento_ia(estado);
CREATE INDEX idx_reprocesamiento_usuario_id ON public.facturas_reprocesamiento_ia(usuario_id);

-- ============================================================================
-- 2. RPC: aplicar_extraccion_ia()
-- Aplicar una extracción a una factura, transaccionalmente
-- NOTA: p_expected_updated_at usa TIMESTAMP WITHOUT TIME ZONE (exacto a facturas.updated_at)
-- VALIDACIONES:
--   - Extracción debe tener datos_validados (supero validación determinista)
--   - Extracción debe tener errores_validacion = NULL
--   - Actualiza AMBOS extraccion_ia_id Y proveedor_id (semántica B.3)
--   - Auditoría incluida en transacción
-- ============================================================================

CREATE OR REPLACE FUNCTION public.aplicar_extraccion_ia(
  p_factura_id UUID,
  p_extraccion_id UUID,
  p_usuario_id UUID,
  p_expected_updated_at TIMESTAMP WITHOUT TIME ZONE
)
RETURNS TABLE (
  exitoso BOOLEAN,
  factura_id UUID,
  extraccion_id UUID,
  nuevo_updated_at TIMESTAMP WITHOUT TIME ZONE,
  mensaje TEXT
) AS $$
DECLARE
  v_estado_revision VARCHAR;
  v_current_updated_at TIMESTAMP WITHOUT TIME ZONE;
  v_current_extraccion_id UUID;
  v_current_proveedor_id UUID;
  v_extraccion_factura_id UUID;
  v_datos_validados JSONB;
  v_errores_validacion TEXT[];
  v_proveedor_id UUID;
  v_respuesta_json JSONB;
BEGIN
  -- 1. FOR UPDATE: Bloquear fila de factura
  SELECT estado_revision, updated_at, extraccion_ia_id, proveedor_id
  INTO v_estado_revision, v_current_updated_at, v_current_extraccion_id, v_current_proveedor_id
  FROM public.facturas
  WHERE id = p_factura_id
  FOR UPDATE;

  -- 2. Validar que factura existe (usando FOUND)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FACTURA_NO_ENCONTRADA';
  END IF;

  -- 3. Validar que factura NO está APROBADA_MANUALMENTE
  IF v_estado_revision = 'APROBADA_MANUALMENTE' THEN
    RAISE EXCEPTION 'FACTURA_APROBADA';
  END IF;

  -- 4. Validar optimistic locking (expected_updated_at)
  -- NOTA: Usa IS DISTINCT FROM para comparación exacta (ambos TIMESTAMP WITHOUT TIME ZONE)
  IF v_current_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'CONFLICTO_CONCURRENCIA';
  END IF;

  -- 5. Validar que extracción existe y pertenece a esta factura
  SELECT factura_id, datos_validados, errores_validacion, respuesta_json
  INTO v_extraccion_factura_id, v_datos_validados, v_errores_validacion, v_respuesta_json
  FROM public.facturas_extraccion_ia
  WHERE id = p_extraccion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXTRACCION_NO_EXISTE';
  END IF;

  IF v_extraccion_factura_id IS DISTINCT FROM p_factura_id THEN
    RAISE EXCEPTION 'EXTRACCION_AJENA';
  END IF;

  -- 6. CRÍTICO: Validar que extracción supero la validación determinista
  -- datos_validados = NULL significa que tiene errores, NO puede aplicarse
  IF v_datos_validados IS NULL THEN
    RAISE EXCEPTION 'EXTRACCION_NO_VALIDADA: no supero validacion determinista';
  END IF;

  -- 7. CRÍTICO: Validar que NO tiene errores de validación
  IF v_errores_validacion IS NOT NULL THEN
    RAISE EXCEPTION 'EXTRACCION_CON_ERRORES: tiene errores que deben resolverse';
  END IF;

  -- 8. Validar que extracción NO está ya aplicada
  IF v_current_extraccion_id = p_extraccion_id THEN
    RAISE EXCEPTION 'EXTRACCION_YA_APLICADA';
  END IF;

  -- 9. Extraer proveedor_id de la extracción (si está disponible)
  -- Semántica: si la extracción contiene _proveedor_id, usarlo
  -- Si es null en JSON, significa que la extracción no identificó proveedor
  IF v_respuesta_json ? '_proveedor_id' THEN
    v_proveedor_id := (v_respuesta_json->>'_proveedor_id')::UUID;
  ELSE
    v_proveedor_id := NULL;
  END IF;

  -- 10. UPDATE facturas: cambiar extraccion_ia_id Y proveedor_id (SEMÁNTICA B.3)
  UPDATE public.facturas
  SET
    extraccion_ia_id = p_extraccion_id,
    proveedor_id = v_proveedor_id,
    updated_at = NOW()
  WHERE id = p_factura_id;

  -- 11. INSERT auditoría en facturas_historial (MISMA TRANSACCIÓN)
  INSERT INTO public.facturas_historial (
    factura_id,
    usuario_id,
    accion,
    datos_nuevos,
    creado_en
  ) VALUES (
    p_factura_id,
    p_usuario_id,
    'EXTRACCION_IA_APLICADA',
    jsonb_build_object(
      'extraccion_ia_id_anterior', v_current_extraccion_id,
      'extraccion_ia_id_nueva', p_extraccion_id,
      'proveedor_id_anterior', v_current_proveedor_id,
      'proveedor_id_nuevo', v_proveedor_id
    ),
    NOW()
  );

  -- 12. RETURN success
  RETURN QUERY SELECT TRUE, p_factura_id, p_extraccion_id, NOW()::TIMESTAMP WITHOUT TIME ZONE, 'Extracción aplicada correctamente';
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Proteger RPC: solo service_role puede ejecutar
REVOKE EXECUTE ON FUNCTION public.aplicar_extraccion_ia(UUID, UUID, UUID, TIMESTAMP WITHOUT TIME ZONE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_extraccion_ia(UUID, UUID, UUID, TIMESTAMP WITHOUT TIME ZONE) TO service_role;

-- ============================================================================
-- 3. RPC: liberar_reprocesamiento_ia()
-- Liberar una operación colgada (EN_PROCESO > 30 minutos, TIMEOUT FIJO)
-- SOLO ACTÚA SOBRE EN_PROCESO
-- Timeout NO es parametrizable: siempre 30 minutos (decisión arquitectónica Phase 2A)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.liberar_reprocesamiento_ia(
  p_factura_id UUID,
  p_usuario_id UUID,
  p_motivo TEXT
)
RETURNS TABLE (
  exitoso BOOLEAN,
  mensaje TEXT
) AS $$
DECLARE
  v_operacion_id UUID;
  v_iniciado_en TIMESTAMPTZ;
  v_usuario_email VARCHAR;
BEGIN
  -- 1. Obtener operación con lock — SOLO SI ESTÁ EN EN_PROCESO
  SELECT id, iniciado_en
  INTO v_operacion_id, v_iniciado_en
  FROM public.facturas_reprocesamiento_ia
  WHERE factura_id = p_factura_id
    AND estado = 'EN_PROCESO'
  FOR UPDATE;

  -- 2. Validar que existe operación EN_PROCESO
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_OPERACION_ACTIVA';
  END IF;

  -- 3. Validar timeout: iniciado_en debe ser >= 30 minutos atrás (FIJO)
  IF v_iniciado_en > (NOW() - INTERVAL '30 minutes') THEN
    RAISE EXCEPTION 'OPERACION_RECIENTE_NO_PUEDE_LIBERAR';
  END IF;

  -- 4. Obtener email del usuario para auditoría
  SELECT email INTO v_usuario_email FROM public.usuarios WHERE id = p_usuario_id;

  -- 5. Marcar operación como ERROR
  UPDATE public.facturas_reprocesamiento_ia
  SET
    estado = 'ERROR',
    error_mensaje = FORMAT(
      'Liberada manualmente por %s: %s (colgada %s minutos)',
      COALESCE(v_usuario_email, p_usuario_id::TEXT),
      p_motivo,
      ROUND(EXTRACT(EPOCH FROM (NOW() - v_iniciado_en)) / 60::NUMERIC, 1)
    ),
    completado_en = NOW()
  WHERE id = v_operacion_id;

  -- 6. Registrar en auditoría
  INSERT INTO public.facturas_historial (
    factura_id,
    usuario_id,
    accion,
    datos_nuevos,
    creado_en
  ) VALUES (
    p_factura_id,
    p_usuario_id,
    'REPROCESAMIENTO_LIBERADO_MANUAL',
    jsonb_build_object(
      'motivo', p_motivo,
      'colgada_desde', v_iniciado_en,
      'liberada_en', NOW(),
      'minutos_espera', ROUND(EXTRACT(EPOCH FROM (NOW() - v_iniciado_en)) / 60::NUMERIC, 1)
    ),
    NOW()
  );

  RETURN QUERY SELECT TRUE, 'Operación liberada y marcada como ERROR. Factura disponible para reprocesar';
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Proteger RPC: solo service_role
REVOKE EXECUTE ON FUNCTION public.liberar_reprocesamiento_ia(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_reprocesamiento_ia(UUID, UUID, TEXT) TO service_role;

-- ============================================================================
-- 4. RPC: finalizar_reprocesamiento_ia()
-- Finalizar una operación: marcar como COMPLETADO y registrar extracción
-- NOTA: NO modifica facturas.extraccion_ia_id ni facturas.proveedor_id
--       Solo actualiza facturas_reprocesamiento_ia.estado y .extraccion_ia_id
--       La aplicación a facturas corresponde a aplicar_extraccion_ia() exclusivamente
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finalizar_reprocesamiento_ia(
  p_operacion_id UUID,
  p_factura_id UUID,
  p_extraccion_id UUID,
  p_usuario_id UUID
)
RETURNS TABLE (
  exitoso BOOLEAN,
  mensaje TEXT
) AS $$
DECLARE
  v_estado VARCHAR;
  v_operacion_factura_id UUID;
  v_operacion_usuario_id UUID;
  v_extraccion_factura_id UUID;
BEGIN
  -- 1. Obtener operación con FOR UPDATE lock
  SELECT estado, factura_id, usuario_id
  INTO v_estado, v_operacion_factura_id, v_operacion_usuario_id
  FROM public.facturas_reprocesamiento_ia
  WHERE id = p_operacion_id
  FOR UPDATE;

  -- 2. Validar que operación existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERACION_NO_EXISTE';
  END IF;

  -- 3. Validar que pertenece a la factura indicada
  IF v_operacion_factura_id IS DISTINCT FROM p_factura_id THEN
    RAISE EXCEPTION 'OPERACION_AJENA';
  END IF;

  -- 4. Validar que está EN_PROCESO
  IF v_estado IS DISTINCT FROM 'EN_PROCESO' THEN
    RAISE EXCEPTION 'OPERACION_NO_EN_PROCESO';
  END IF;

  -- 5. Validar que el usuario coincide
  IF v_operacion_usuario_id IS DISTINCT FROM p_usuario_id THEN
    RAISE EXCEPTION 'USUARIO_NO_COINCIDE';
  END IF;

  -- 6. Validar que extracción existe y pertenece a esta factura
  SELECT factura_id
  INTO v_extraccion_factura_id
  FROM public.facturas_extraccion_ia
  WHERE id = p_extraccion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXTRACCION_NO_EXISTE';
  END IF;

  IF v_extraccion_factura_id IS DISTINCT FROM p_factura_id THEN
    RAISE EXCEPTION 'EXTRACCION_AJENA';
  END IF;

  -- 7. Actualizar operación a COMPLETADO (SIN modificar facturas)
  UPDATE public.facturas_reprocesamiento_ia
  SET
    estado = 'COMPLETADO',
    extraccion_ia_id = p_extraccion_id,
    completado_en = NOW()
  WHERE id = p_operacion_id;

  -- 8. Registrar auditoría EN LA MISMA TRANSACCIÓN
  INSERT INTO public.facturas_historial (
    factura_id,
    usuario_id,
    accion,
    datos_nuevos,
    creado_en
  ) VALUES (
    p_factura_id,
    p_usuario_id,
    'REPROCESAMIENTO_FINALIZADO',
    jsonb_build_object(
      'operacion_id', p_operacion_id,
      'extraccion_id', p_extraccion_id,
      'finalizado_en', NOW()
    ),
    NOW()
  );

  RETURN QUERY SELECT TRUE, 'Operación finalizada correctamente. Extracción disponible para aplicación';
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Proteger RPC: solo service_role
REVOKE EXECUTE ON FUNCTION public.finalizar_reprocesamiento_ia(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_reprocesamiento_ia(UUID, UUID, UUID, UUID) TO service_role;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS en la tabla
ALTER TABLE public.facturas_reprocesamiento_ia ENABLE ROW LEVEL SECURITY;

-- Policy: Lectura permitida para admin y usuario propietario
-- Admin se valida en capa de aplicación/endpoint, RLS es defensa en profundidad
CREATE POLICY "read_reprocesamiento_policy" ON public.facturas_reprocesamiento_ia
  FOR SELECT
  USING (
    usuario_id = auth.uid()
  );

-- No permitir INSERT/UPDATE/DELETE desde cliente (solo RPC)
CREATE POLICY "no_insert_reprocesamiento_policy" ON public.facturas_reprocesamiento_ia
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "no_update_reprocesamiento_policy" ON public.facturas_reprocesamiento_ia
  FOR UPDATE
  USING (false);

CREATE POLICY "no_delete_reprocesamiento_policy" ON public.facturas_reprocesamiento_ia
  FOR DELETE
  USING (false);

-- ============================================================================
-- 5. PERMISOS (REVOKE/GRANT)
-- ============================================================================

-- Tabla: Solo service_role puede hacer todo
REVOKE ALL ON public.facturas_reprocesamiento_ia FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.facturas_reprocesamiento_ia TO authenticated;  -- Lectura via RLS
GRANT ALL ON public.facturas_reprocesamiento_ia TO service_role;      -- Backend completo

-- ============================================================================
-- 6. VERIFICACIÓN
-- ============================================================================

-- Verificar que tabla existe
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'facturas_reprocesamiento_ia'
LIMIT 1;

-- Verificar que índice UNIQUE parcial existe
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'facturas_reprocesamiento_ia'
  AND indexname = 'idx_reprocesamiento_activo';

-- Verificar que RPCs existen
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('aplicar_extraccion_ia', 'liberar_reprocesamiento_ia', 'finalizar_reprocesamiento_ia')
ORDER BY routine_name;

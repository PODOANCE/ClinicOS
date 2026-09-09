-- Bloque B.4.2: RPC Transaccional para Edición + Auditoría
-- Fecha: 2026-08-31
-- Descripción: Operación atómica única para editar factura con auditoría garantizada.
--
-- ARQUITECTURA:
-- - Transacción PostgreSQL automática (sin BEGIN/COMMIT manual)
-- - Lock pesimista (FOR UPDATE) previene race conditions
-- - Optimistic check (expected_updated_at) detecta conflictos de concurrencia
-- - Snapshots capturados DENTRO de la transacción garantizado correctos
-- - EXCEPTION hace rollback automático en PostgreSQL
-- - RPC NO invocable directamente por cliente (REVOKE anon, authenticated)

-- ============================================================================
-- 1. CREAR RPC TRANSACCIONAL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.actualizar_factura_con_auditoria(
  p_factura_id UUID,
  p_usuario_id UUID,
  p_cambios JSONB,
  p_expected_updated_at TIMESTAMP WITHOUT TIME ZONE,
  p_accion VARCHAR DEFAULT 'EDITADA'
)
RETURNS TABLE (
  exitoso BOOLEAN,
  factura_id UUID,
  historial_id UUID,
  nuevo_updated_at TIMESTAMP WITHOUT TIME ZONE,
  mensaje VARCHAR
) AS $$
DECLARE
  v_factura RECORD;
  v_campos_editables VARCHAR[] := ARRAY[
    'numero_factura', 'fecha_emision', 'fecha_vencimiento',
    'importe_base', 'importe_iva', 'importe_total',
    'tipo_iva', 'concepto', 'moneda', 'iban', 'proveedor_id'
  ];
  v_snapshot_anterior JSONB;
  v_snapshot_nuevo JSONB;
  v_campo_modificado VARCHAR;
  v_historial_id UUID;
  v_cambios_aplicados JSONB := '{}'::JSONB;
  v_campo VARCHAR;
  v_nuevo_updated_at TIMESTAMP WITHOUT TIME ZONE;
BEGIN
  -- ========================================================================
  -- PASO 1: Validar usuario (identidad del JWT debe coincidir)
  -- ========================================================================

  IF p_usuario_id != auth.uid() THEN
    RAISE EXCEPTION 'USUARIO_NO_AUTORIZADO: intento de modificación como otro usuario (% vs %)',
      p_usuario_id, auth.uid();
  END IF;

  -- ========================================================================
  -- PASO 2: Obtener factura CON LOCK PESIMISTA (FOR UPDATE)
  -- ========================================================================
  -- Bloquea la fila, impide que otro usuario la modifique durante la transacción

  SELECT * INTO v_factura FROM facturas
  WHERE id = p_factura_id
  FOR UPDATE;  -- ← LOCK PESIMISTA

  IF v_factura IS NULL THEN
    RAISE EXCEPTION 'FACTURA_NO_ENCONTRADA: %', p_factura_id;
  END IF;

  -- ========================================================================
  -- PASO 3: VALIDAR CONCURRENCIA (expected_updated_at)
  -- ========================================================================
  -- Si otro usuario modificó la factura entre que el cliente la abrió
  -- y ahora, el updated_at habrá cambiado.
  -- Esto es un error de concurrencia → 409 Conflict

  IF v_factura.updated_at != p_expected_updated_at THEN
    RAISE EXCEPTION 'CONFLICTO_CONCURRENCIA: factura modificada por otro usuario (updated_at: % vs esperado: %)',
      v_factura.updated_at, p_expected_updated_at;
  END IF;

  -- ========================================================================
  -- PASO 4: VALIDAR ESTADO_REVISION
  -- ========================================================================
  -- No editar factura aprobada manualmente

  IF v_factura.estado_revision = 'APROBADA_MANUALMENTE'::estado_revision THEN
    RAISE EXCEPTION 'FACTURA_APROBADA: no se puede editar una factura aprobada manualmente';
  END IF;

  -- ========================================================================
  -- PASO 5: CAPTURAR SNAPSHOT ANTERIOR (estado REAL bloqueado)
  -- ========================================================================
  -- Capturado DENTRO de la transacción, garantizado de ser el estado real

  v_snapshot_anterior := jsonb_build_object(
    'numero_factura', v_factura.numero_factura,
    'fecha_emision', v_factura.fecha_emision,
    'fecha_vencimiento', v_factura.fecha_vencimiento,
    'importe_base', v_factura.importe_base,
    'importe_iva', v_factura.importe_iva,
    'importe_total', v_factura.importe_total,
    'tipo_iva', v_factura.tipo_iva,
    'concepto', v_factura.concepto,
    'moneda', v_factura.moneda,
    'iban', v_factura.iban,
    'proveedor_id', v_factura.proveedor_id
  );

  -- ========================================================================
  -- PASO 6: VALIDAR Y APLICAR CAMBIOS (WHITELIST ESTRICTA)
  -- ========================================================================
  -- Solo 11 campos permitidos, el resto se rechaza

  FOR v_campo IN SELECT jsonb_object_keys(p_cambios)
  LOOP
    IF NOT (v_campo = ANY(v_campos_editables)) THEN
      RAISE EXCEPTION 'CAMPO_NO_PERMITIDO: % no se puede editar', v_campo;
    END IF;

    v_cambios_aplicados := jsonb_set(
      v_cambios_aplicados,
      ARRAY[v_campo],
      p_cambios -> v_campo
    );
  END LOOP;

  IF jsonb_object_keys(v_cambios_aplicados) IS NULL THEN
    RAISE EXCEPTION 'SIN_CAMBIOS: ningún cambio válido proporcionado';
  END IF;

  -- ========================================================================
  -- PASO 7: VALIDAR IMPORTES SI CAMBIAN
  -- ========================================================================
  -- base + iva ≈ total (tolerancia 0.01€)

  IF v_cambios_aplicados ? 'importe_base' OR
     v_cambios_aplicados ? 'importe_iva' OR
     v_cambios_aplicados ? 'importe_total' THEN

    DECLARE
      v_base NUMERIC := COALESCE(
        (v_cambios_aplicados ->> 'importe_base')::NUMERIC,
        v_factura.importe_base
      );
      v_iva NUMERIC := COALESCE(
        (v_cambios_aplicados ->> 'importe_iva')::NUMERIC,
        v_factura.importe_iva
      );
      v_total NUMERIC := COALESCE(
        (v_cambios_aplicados ->> 'importe_total')::NUMERIC,
        v_factura.importe_total
      );
      v_esperado NUMERIC := v_base + v_iva;
      v_diferencia NUMERIC := ABS(v_esperado - v_total);
    BEGIN
      IF v_diferencia > 0.01 THEN
        RAISE EXCEPTION 'IMPORTES_INCONSISTENTES: % + % = % pero total es % (diferencia: %€)',
          v_base, v_iva, v_esperado, v_total, v_diferencia;
      END IF;
    END;
  END IF;

  -- ========================================================================
  -- PASO 8: VALIDAR PROVEEDOR SI CAMBIA
  -- ========================================================================
  -- El proveedor debe existir en la tabla proveedores

  IF v_cambios_aplicados ? 'proveedor_id' THEN
    DECLARE
      v_proveedor_id UUID := (v_cambios_aplicados ->> 'proveedor_id')::UUID;
      v_proveedor_existe BOOLEAN;
    BEGIN
      SELECT EXISTS(SELECT 1 FROM proveedores WHERE id = v_proveedor_id)
      INTO v_proveedor_existe;

      IF NOT v_proveedor_existe THEN
        RAISE EXCEPTION 'PROVEEDOR_NO_EXISTE: %', v_proveedor_id;
      END IF;
    END;
  END IF;

  -- ========================================================================
  -- PASO 9: ACTUALIZAR FACTURA
  -- ========================================================================
  -- updated_at se incrementa automáticamente al UPDATE

  UPDATE facturas
  SET
    numero_factura = COALESCE((v_cambios_aplicados ->> 'numero_factura'), numero_factura),
    fecha_emision = COALESCE((v_cambios_aplicados ->> 'fecha_emision')::DATE, fecha_emision),
    fecha_vencimiento = CASE WHEN v_cambios_aplicados ? 'fecha_vencimiento'
      THEN NULLIF((v_cambios_aplicados ->> 'fecha_vencimiento'), 'null')::DATE
      ELSE fecha_vencimiento END,
    importe_base = COALESCE((v_cambios_aplicados ->> 'importe_base')::NUMERIC, importe_base),
    importe_iva = COALESCE((v_cambios_aplicados ->> 'importe_iva')::NUMERIC, importe_iva),
    importe_total = COALESCE((v_cambios_aplicados ->> 'importe_total')::NUMERIC, importe_total),
    tipo_iva = COALESCE((v_cambios_aplicados ->> 'tipo_iva'), tipo_iva),
    concepto = COALESCE((v_cambios_aplicados ->> 'concepto'), concepto),
    moneda = COALESCE((v_cambios_aplicados ->> 'moneda'), moneda),
    iban = CASE WHEN v_cambios_aplicados ? 'iban'
      THEN NULLIF((v_cambios_aplicados ->> 'iban'), 'null')
      ELSE iban END,
    proveedor_id = CASE WHEN v_cambios_aplicados ? 'proveedor_id'
      THEN NULLIF((v_cambios_aplicados ->> 'proveedor_id'), 'null')::UUID
      ELSE proveedor_id END,
    extraccion_ia_id = NULL,  -- Invalidar extracción IA (datos ahora son manuales)
    updated_at = NOW()
  WHERE id = p_factura_id
  RETURNING updated_at INTO v_nuevo_updated_at;

  -- ========================================================================
  -- PASO 10: CAPTURAR SNAPSHOT NUEVO (estado REAL actualizado)
  -- ========================================================================
  -- Capturado DESPUÉS del UPDATE, garantizado de ser el nuevo estado

  SELECT jsonb_build_object(
    'numero_factura', numero_factura,
    'fecha_emision', fecha_emision,
    'fecha_vencimiento', fecha_vencimiento,
    'importe_base', importe_base,
    'importe_iva', importe_iva,
    'importe_total', importe_total,
    'tipo_iva', tipo_iva,
    'concepto', concepto,
    'moneda', moneda,
    'iban', iban,
    'proveedor_id', proveedor_id
  ) INTO v_snapshot_nuevo
  FROM facturas WHERE id = p_factura_id;

  -- ========================================================================
  -- PASO 11: DETECTAR CAMPOS MODIFICADOS
  -- ========================================================================
  -- Si uno solo: "numero_factura"
  -- Si varios: "VARIOS"

  SELECT STRING_AGG(key, ', ' ORDER BY key)
  INTO v_campo_modificado
  FROM (
    SELECT jsonb_object_keys(v_cambios_aplicados) AS key
  ) t;

  IF v_campo_modificado IS NULL OR v_campo_modificado = '' THEN
    v_campo_modificado := 'VARIOS';
  ELSIF strpos(v_campo_modificado, ',') > 0 THEN
    v_campo_modificado := 'VARIOS';
  END IF;

  -- ========================================================================
  -- PASO 12: INSERTAR HISTORIAL (DENTRO DE MISMA TRANSACCIÓN)
  -- ========================================================================
  -- Si esto falla, PostgreSQL hace rollback de TODA la operación (UPDATE + INSERT)

  INSERT INTO facturas_historial (
    factura_id, usuario_id, accion, campo_modificado,
    datos_anteriores, datos_nuevos
  ) VALUES (
    p_factura_id, p_usuario_id, p_accion, v_campo_modificado,
    v_snapshot_anterior, v_snapshot_nuevo
  )
  RETURNING id INTO v_historial_id;

  -- ========================================================================
  -- PASO 13: RETORNAR ÉXITO
  -- ========================================================================

  RETURN QUERY SELECT TRUE, p_factura_id, v_historial_id, v_nuevo_updated_at,
    'Factura actualizada y auditada';

EXCEPTION WHEN OTHERS THEN
  -- PostgreSQL hace ROLLBACK automático de toda la transacción en caso de error
  -- No necesitamos manual BEGIN/COMMIT/ROLLBACK
  RETURN QUERY SELECT FALSE, p_factura_id, NULL::UUID, NULL::TIMESTAMP WITHOUT TIME ZONE,
    'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. SEGURIDAD: Revocar acceso desde cliente
-- ============================================================================

-- La RPC solo debe ser invocable por el backend (service_role)
-- Nunca por clientes autenticados o anónimos

REVOKE EXECUTE ON FUNCTION public.actualizar_factura_con_auditoria(
  UUID, UUID, JSONB, TIMESTAMP WITHOUT TIME ZONE, VARCHAR
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.actualizar_factura_con_auditoria(
  UUID, UUID, JSONB, TIMESTAMP WITHOUT TIME ZONE, VARCHAR
) FROM anon;

REVOKE EXECUTE ON FUNCTION public.actualizar_factura_con_auditoria(
  UUID, UUID, JSONB, TIMESTAMP WITHOUT TIME ZONE, VARCHAR
) FROM authenticated;

-- El backend accede mediante service_role (no requiere grant explícito)

-- ============================================================================
-- 3. VERIFICACIÓN
-- ============================================================================

-- Verificar que la RPC existe
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'actualizar_factura_con_auditoria'
  AND routine_type = 'FUNCTION';

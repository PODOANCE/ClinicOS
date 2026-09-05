-- ============================================================================
-- MIGRACIÓN: RPC Transaccional para Idempotencia Atómica de B.3
-- Fecha: 2026-09-05
-- Razón: Evitar race condition entre múltiples procesos B.3 simultáneos
-- ============================================================================
-- PROBLEMA:
-- Si dos procesos B.3 leen estado_lectura = NULL simultáneamente,
-- ambos pueden proceder a procesar la misma factura (race condition).
--
-- SOLUCIÓN:
-- RPC transaccional que:
-- 1. Bloquea la fila (FOR UPDATE)
-- 2. Verifica estado_lectura
-- 3. Solo si es NULL/ERROR_LECTURA, cambia a LECTURA_PENDIENTE (atómico)
-- 4. Devuelve booleano: puede procesar o no
--
-- GARANTÍA:
-- Solo un proceso por factura puede pasar puede_procesar = true simultáneamente.
-- ============================================================================

-- 1. CREAR RPC TRANSACCIONAL
CREATE OR REPLACE FUNCTION public.iniciar_procesamiento_factura(p_factura_id UUID)
RETURNS TABLE (
  puede_procesar BOOLEAN,
  estado_actual TEXT,
  razon TEXT
) AS $$
DECLARE
  v_estado factura_estado_lectura;
BEGIN
  -- PASO 1: Obtener factura con lock pesimista
  SELECT estado_lectura INTO v_estado
  FROM facturas
  WHERE id = p_factura_id
  FOR UPDATE;  -- ← BLOQUEA LA FILA hasta fin de transacción

  -- Si no existe, devolver resultado inequívoco
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'FACTURA_NO_EXISTE'::TEXT;
    RETURN;
  END IF;

  -- PASO 2: Verificar estado (idempotencia controlada)
  -- Si ya está en procesamiento, rechazar
  IF v_estado = 'LECTURA_PENDIENTE'::factura_estado_lectura THEN
    RETURN QUERY SELECT FALSE, v_estado::TEXT, 'PROCESAMIENTO_EN_CURSO'::TEXT;
    RETURN;
  END IF;

  -- Si ya fue procesado exitosamente, rechazar
  IF v_estado = 'VALIDACION_EXITOSA'::factura_estado_lectura THEN
    RETURN QUERY SELECT FALSE, v_estado::TEXT, 'PROCESADO_EXITOSAMENTE'::TEXT;
    RETURN;
  END IF;

  -- Si requiere revisión manual, rechazar
  IF v_estado = 'REVISION_MANUAL'::factura_estado_lectura THEN
    RETURN QUERY SELECT FALSE, v_estado::TEXT, 'PROCESADO_CON_ADVERTENCIAS'::TEXT;
    RETURN;
  END IF;

  -- PASO 3: Si es NULL o ERROR_LECTURA, proceder (cambiar a LECTURA_PENDIENTE)
  UPDATE facturas
  SET
    estado_lectura = 'LECTURA_PENDIENTE'::factura_estado_lectura,
    actualizado_en = NOW()
  WHERE id = p_factura_id;

  -- PASO 4: Confirmar éxito
  RETURN QUERY SELECT TRUE, 'LECTURA_PENDIENTE'::TEXT, 'INICIADO_POR_RPC'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. SEGURIDAD: Proteger RPC (solo service_role)
-- ============================================================================

-- Revocar acceso desde clientes públicos
REVOKE EXECUTE ON FUNCTION public.iniciar_procesamiento_factura(UUID)
FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.iniciar_procesamiento_factura(UUID)
FROM anon;

REVOKE EXECUTE ON FUNCTION public.iniciar_procesamiento_factura(UUID)
FROM authenticated;

-- Grant explícito a service_role (backend B.3 con createAdminClient)
-- CRÍTICO: Sin este GRANT, la RPC no es ejecutable desde createAdminClient()
GRANT EXECUTE ON FUNCTION public.iniciar_procesamiento_factura(UUID)
TO service_role;

-- ============================================================================
-- 3. VERIFICACIÓN
-- ============================================================================

-- Verificar que la RPC existe
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'iniciar_procesamiento_factura'
AND routine_type = 'FUNCTION';
-- Esperado: 1 fila con routine_type = 'FUNCTION'

-- Verificar que está protegida (sin grants para anon/authenticated)
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'iniciar_procesamiento_factura'
ORDER BY grantee;
-- Esperado: NO filas para 'anon' o 'authenticated' (si hay rows, solo para 'postgres' o service_role)

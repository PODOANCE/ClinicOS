-- Bloque B.4.2: Revisión, edición y auditoría de facturas
-- Fecha: 2026-08-31
-- Descripción: Permite revisión humana controlada, edición de campos específicos,
-- y auditoría append-only de todas las modificaciones.
--
-- ARQUITECTURA DE ESTADOS:
-- estado_lectura = qué hizo la IA (LECTURA_EXITOSA, VALIDACION_EXITOSA, REVISION_MANUAL, ERROR_LECTURA)
-- estado_revision = qué decidió el humano (NULL si no requiere revisión, PENDIENTE_REVISION si requiere)
--
-- FLUJO:
-- VALIDACION_EXITOSA → estado_revision = NULL (no requiere aprobación)
-- REVISION_MANUAL    → estado_revision = PENDIENTE_REVISION (requiere aprobación/rechazo)
-- Aprobado/Rechazado → estado_revision = APROBADA_MANUALMENTE / RECHAZADA (bloqueado contra edición)

-- ============================================================================
-- 1. CREAR ENUM estado_revision
-- ============================================================================

-- Estados para la revisión humana (independiente de estado_lectura)
-- NULL = no requiere revisión humana (estado_lectura = VALIDACION_EXITOSA)
-- PENDIENTE_REVISION = requiere decisión (estado_lectura = REVISION_MANUAL)
-- APROBADA_MANUALMENTE = aprobado, bloqueado
-- RECHAZADA = rechazado, no sigue a B.5
CREATE TYPE estado_revision AS ENUM (
  'PENDIENTE_REVISION',
  'APROBADA_MANUALMENTE',
  'RECHAZADA'
);

-- ============================================================================
-- 2. AGREGAR COLUMNAS A TABLA facturas
-- ============================================================================

-- Estado de revisión humana: NULL (sin revisión) o enum (con revisión)
-- IMPORTANTE: NO usar DEFAULT; se asigna explícitamente desde endpoint
ALTER TABLE facturas ADD COLUMN estado_revision estado_revision;

-- Auditoría: quién y cuándo realizó la última revisión
ALTER TABLE facturas ADD COLUMN revisado_por UUID REFERENCES usuarios(id);
ALTER TABLE facturas ADD COLUMN revisado_en TIMESTAMP;

-- Índices para queries frecuentes
CREATE INDEX idx_facturas_estado_revision ON facturas(estado_revision) WHERE estado_revision IS NOT NULL;
CREATE INDEX idx_facturas_revisado_por ON facturas(revisado_por);

-- ============================================================================
-- 3. CREAR TABLA facturas_historial (APPEND-ONLY)
-- ============================================================================

-- IMPORTANTE: Esta tabla es append-only. Nunca se modifica ni se borra un registro.
-- Es la fuente de verdad para auditoría de cambios.
--
-- PROPÓSITO: Registrar cada acción de usuario sobre una factura.
-- Cada fila es un evento inmutable que explica qué cambió y cuándo.
--
-- CAMPOS:
-- - datos_anteriores: snapshot JSONB completo ANTES del cambio
-- - datos_nuevos: snapshot JSONB completo DESPUÉS del cambio
-- - campo_modificado: lectura rápida de qué fue editado (numero_factura, proveedor_id, etc)

CREATE TABLE facturas_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID NOT NULL REFERENCES facturas(id),
  -- NOTA CRÍTICA: NO usamos ON DELETE CASCADE
  -- Razón: La auditoría debe ser inmutable. Si se borra una factura,
  -- el histórico DEBE permanecer para reconstrucción administrativa.
  -- Si algún día se permite borrar facturas, será necesario una política
  -- RLS que impida DELETE, o implementar soft delete (archived_at TIMESTAMP).
  usuario_id UUID NOT NULL REFERENCES usuarios(id),

  -- Tipo de acción realizada
  accion VARCHAR NOT NULL CHECK (accion IN (
    'EDITADA',                   -- Usuario editó uno o más campos
    'PROVEEDOR_ASIGNADO',        -- Usuario asignó proveedor
    'REPROCESADA',               -- Usuario solicitó reprocesamiento IA
    'APROBADA_MANUALMENTE',      -- Usuario aprobó factura
    'RECHAZADA'                  -- Usuario rechazó factura
  )),

  -- Campos modificados (para lectura rápida)
  -- Admite: numero_factura, fecha_emision, fecha_vencimiento, importe_base, importe_iva,
  -- importe_total, tipo_iva, concepto, moneda, iban, proveedor_id, VARIOS
  campo_modificado VARCHAR,

  -- Snapshots JSONB completos para reconstrucción histórica
  -- ANTERIOR: estado antes del cambio
  -- NUEVO: estado después del cambio
  -- Estos son snapshots de campos relevantes de la factura, no de la tabla entera
  datos_anteriores JSONB,
  datos_nuevos JSONB,

  -- Auditoría: cuándo ocurrió (inmutable, nunca modificar)
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para búsquedas eficientes
CREATE INDEX idx_historial_factura ON facturas_historial(factura_id);
CREATE INDEX idx_historial_usuario ON facturas_historial(usuario_id);
CREATE INDEX idx_historial_accion ON facturas_historial(accion);
CREATE INDEX idx_historial_creado ON facturas_historial(creado_en DESC);

-- Índice compuesto: "damme el histórico de una factura ordenado por fecha"
CREATE INDEX idx_historial_factura_creado ON facturas_historial(factura_id, creado_en DESC);

-- ============================================================================
-- 4. PROTECCIONES: facturas_historial es APPEND-ONLY
-- ============================================================================

-- Función helper: bloquear UPDATE y DELETE en historial
-- SECURITY DEFINER no necesario; simplemente rechazamos la operación
CREATE OR REPLACE FUNCTION fn_bloquear_modificacion_historial()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'facturas_historial es append-only: no se permite UPDATE ni DELETE. '
    'Registro id: %, factura_id: %', OLD.id, OLD.factura_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Prohibir UPDATE en facturas_historial
CREATE TRIGGER tg_historial_bloquear_update
  BEFORE UPDATE ON facturas_historial
  FOR EACH ROW
  EXECUTE FUNCTION fn_bloquear_modificacion_historial();

-- Trigger: Prohibir DELETE en facturas_historial
CREATE TRIGGER tg_historial_bloquear_delete
  BEFORE DELETE ON facturas_historial
  FOR EACH ROW
  EXECUTE FUNCTION fn_bloquear_modificacion_historial();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- NOTA: El historial es append-only. Solo se inserta desde endpoints autenticados,
-- nunca se modifica ni se borra. Las RLS son una capa adicional de protección.
--
-- RELACIÓN DE IDENTIDAD:
-- - auth.uid() devuelve UUID del usuario autenticado
-- - usuarios.id = auth.uid() (1:1 mapping, confirmado en DECISIONS.md)
-- - Roles se consultan via usuarios_roles → roles

ALTER TABLE facturas_historial ENABLE ROW LEVEL SECURITY;

-- POLICY 1: SELECT (lectura)
-- Quién puede leer el historial:
-- - El usuario que creó el registro (usuario_id = auth.uid())
-- - Los administradores del sistema (pueden auditar cualquier factura)
DROP POLICY IF EXISTS "historial_select_propio_o_admin" ON facturas_historial;
CREATE POLICY "historial_select_propio_o_admin" ON facturas_historial
  FOR SELECT
  USING (
    -- El usuario que realizó la acción puede ver su propio historial
    usuario_id = auth.uid()
    -- Los administradores pueden ver todo el historial
    OR EXISTS (
      SELECT 1
      FROM usuarios_roles ur
      JOIN roles r ON ur.rol_id = r.id
      WHERE ur.usuario_id = auth.uid()
        AND r.nombre = 'Administrador del sistema'
    )
  );

-- POLICY 2: INSERT (inserción)
-- Solo los endpoints autenticados pueden insertar.
-- La aplicación valida que usuario_id = auth.uid() (no confiar en RLS para esto,
-- pero es una capa adicional).
DROP POLICY IF EXISTS "historial_insert_propio_usuario" ON facturas_historial;
CREATE POLICY "historial_insert_propio_usuario" ON facturas_historial
  FOR INSERT
  WITH CHECK (
    -- Solo se puede insertar un registro si el usuario_id es el del usuario autenticado
    -- Esto evita que alguien intente atribuir cambios a otro usuario
    usuario_id = auth.uid()
  );

-- POLICY 3: UPDATE
-- COMPLETAMENTE BLOQUEADO. Nunca permitir actualización.
-- Redundancia: también está protegido por trigger, pero RLS proporciona defensa en profundidad.
DROP POLICY IF EXISTS "historial_update_bloqueado" ON facturas_historial;
CREATE POLICY "historial_update_bloqueado" ON facturas_historial
  FOR UPDATE
  USING (FALSE)  -- Nunca permitir (USING = condición siempre falsa)
  WITH CHECK (FALSE);  -- Redundancia adicional

-- POLICY 4: DELETE
-- COMPLETAMENTE BLOQUEADO. Nunca permitir eliminación.
DROP POLICY IF EXISTS "historial_delete_bloqueado" ON facturas_historial;
CREATE POLICY "historial_delete_bloqueado" ON facturas_historial
  FOR DELETE
  USING (FALSE);

-- ============================================================================
-- 6. CAMPOS AUDITABLES: Lista centralizada
-- ============================================================================

-- Esta lista define QUÉ campos de facturas se consideran "auditables"
-- y pueden aparecer en datos_anteriores / datos_nuevos
--
-- CAMPOS AUDITABLES (11 campos):
-- - numero_factura (VARCHAR)
-- - fecha_emision (DATE/TIMESTAMP)
-- - fecha_vencimiento (DATE/TIMESTAMP)
-- - importe_base (NUMERIC)
-- - importe_iva (NUMERIC)
-- - importe_total (NUMERIC)
-- - tipo_iva (VARCHAR) [de facturas_extraccion_ia]
-- - concepto (VARCHAR) [de facturas_extraccion_ia]
-- - moneda (VARCHAR) [de facturas_extraccion_ia]
-- - iban (VARCHAR) [de facturas_extraccion_ia]
-- - proveedor_id (UUID)
--
-- NOTA: Los snapshots guardan solo estos campos, NO la fila entera.
-- Futura adición: Si se añaden más campos auditables, actualizar esta lista
-- y el procedimiento que construye los snapshots.

-- ============================================================================
-- 7. STORED PROCEDURE: Registrar evento en historial
-- ============================================================================

-- NOTA: Esta función NO usa SECURITY DEFINER.
-- Los endpoints la invocan como usuario autenticado.
-- RLS + triggers proporcionan protección.
-- No queremos privilegios elevados que creen una puerta trasera.

CREATE OR REPLACE FUNCTION registrar_historial_factura(
  p_factura_id UUID,
  p_usuario_id UUID,
  p_accion VARCHAR,
  p_campo_modificado VARCHAR DEFAULT NULL,
  p_datos_anteriores JSONB DEFAULT NULL,
  p_datos_nuevos JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_historial_id UUID;
BEGIN
  -- Validación 1: La factura debe existir
  IF NOT EXISTS (SELECT 1 FROM facturas WHERE id = p_factura_id) THEN
    RAISE EXCEPTION 'Factura no encontrada: %', p_factura_id;
  END IF;

  -- Validación 2: El usuario debe existir
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = p_usuario_id) THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', p_usuario_id;
  END IF;

  -- Validación 3: p_usuario_id debe ser el del usuario autenticado
  -- (protección contra que alguien atribuya cambios a otro usuario)
  IF p_usuario_id != auth.uid() THEN
    RAISE EXCEPTION 'Usuario no autorizado: intento de registrar acción como otro usuario';
  END IF;

  -- Validación 4: Acción debe ser válida
  IF p_accion NOT IN ('EDITADA', 'PROVEEDOR_ASIGNADO', 'REPROCESADA', 'APROBADA_MANUALMENTE', 'RECHAZADA') THEN
    RAISE EXCEPTION 'Acción no válida: %', p_accion;
  END IF;

  -- Insertar registro de auditoría
  -- RLS se encargará de validar si el usuario tiene permiso
  INSERT INTO facturas_historial (
    factura_id, usuario_id, accion, campo_modificado, datos_anteriores, datos_nuevos
  ) VALUES (
    p_factura_id, p_usuario_id, p_accion, p_campo_modificado, p_datos_anteriores, p_datos_nuevos
  )
  RETURNING id INTO v_historial_id;

  RETURN v_historial_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. ADVERTENCIA: POLÍTICA DE DELETE EN FACTURAS
-- ============================================================================

-- PROBLEMA IDENTIFICADO:
-- No existe actualmente una política RLS que bloquee DELETE en tabla facturas.
-- Si alguien ejecuta: DELETE FROM facturas WHERE id = '...';
-- El registro de facturas se borrará, pero facturas_historial quedará como registro huérfano.
--
-- SOLUCIÓN (A IMPLEMENTAR EN FASE POSTERIOR):
-- Opción 1: Agregar RLS policy que bloquee DELETE en facturas
--   CREATE POLICY "facturas_no_delete" ON facturas FOR DELETE USING (FALSE);
--
-- Opción 2: Implementar soft delete en facturas
--   ALTER TABLE facturas ADD COLUMN archived_at TIMESTAMP;
--   UPDATE operaciones se hacen via: UPDATE facturas SET archived_at = NOW() WHERE id = '...';
--
-- Por ahora: facturas_historial NO usa ON DELETE CASCADE.
-- Si se borra una factura, el histórico se convierte en registro huérfano
-- (violación referencial de integridad, pero auditoría persiste).

-- ============================================================================
-- 8. SEGURIDAD: Revocar acceso a la RPC desde cliente
-- ============================================================================

-- La RPC de auditoría NO debe ser invocable directamente por usuarios del cliente
-- Solo el backend con service_role puede llamarla
-- Esto evita que alguien intente: registrar_historial_factura(..., p_usuario_id=otro_usuario)

REVOKE EXECUTE ON FUNCTION registrar_historial_factura(
  UUID, UUID, VARCHAR, VARCHAR, JSONB, JSONB
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION registrar_historial_factura(
  UUID, UUID, VARCHAR, VARCHAR, JSONB, JSONB
) FROM anon;

REVOKE EXECUTE ON FUNCTION registrar_historial_factura(
  UUID, UUID, VARCHAR, VARCHAR, JSONB, JSONB
) FROM authenticated;

-- El backend accede mediante service_role (no requiere grant explícito)

-- ============================================================================
-- 9. VERIFICACIÓN: Mostrar estado después de migración
-- ============================================================================

-- Verificar que el enum fue creado
SELECT enum_range(NULL::estado_revision) AS estados_revision;

-- Verificar que las columnas existen
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'facturas'
AND column_name IN ('estado_revision', 'revisado_por', 'revisado_en');

-- Verificar que la tabla existe
SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'facturas_historial') AS tabla_creada;

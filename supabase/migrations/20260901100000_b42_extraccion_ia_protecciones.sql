-- ============================================================================
-- MIGRACIÓN: Protecciones append-only en facturas_extraccion_ia
-- Fecha: 2026-09-01
-- Razón: Auditoría append-only (no modificar extracciones previas)
-- ============================================================================

-- 1. BLOQUEAR UPDATE (RLS)
-- Aunque la tabla es técnica, agregar RLS para defensa en profundidad
ALTER TABLE facturas_extraccion_ia ENABLE ROW LEVEL SECURITY;

-- Política: SELECT — solo propietario (quien la generó) o admin
DROP POLICY IF EXISTS "extraccion_select_propio_o_admin" ON facturas_extraccion_ia;
CREATE POLICY "extraccion_select_propio_o_admin" ON facturas_extraccion_ia
FOR SELECT
USING (
  usuario_id = auth.uid()  -- Quien la generó
  OR usuario_id IS NULL    -- B.3 automático (todos pueden ver)
  OR EXISTS (
    SELECT 1 FROM usuarios_roles ur
    JOIN roles r ON ur.rol_id = r.id
    WHERE ur.usuario_id = auth.uid()
    AND r.nombre = 'Administrador del sistema'
  )
);

-- Política: INSERT — B.3 (sin usuario) o usuario autenticado
DROP POLICY IF EXISTS "extraccion_insert_usuario" ON facturas_extraccion_ia;
CREATE POLICY "extraccion_insert_usuario" ON facturas_extraccion_ia
FOR INSERT
WITH CHECK (
  usuario_id = auth.uid()  -- Usuario autenticado
  OR usuario_id IS NULL    -- B.3 automático
);

-- Política: UPDATE — BLOQUEADO (append-only)
DROP POLICY IF EXISTS "extraccion_update_bloqueado" ON facturas_extraccion_ia;
CREATE POLICY "extraccion_update_bloqueado" ON facturas_extraccion_ia
FOR UPDATE
USING (FALSE)
WITH CHECK (FALSE);

-- Política: DELETE — BLOQUEADO
DROP POLICY IF EXISTS "extraccion_delete_bloqueado" ON facturas_extraccion_ia;
CREATE POLICY "extraccion_delete_bloqueado" ON facturas_extraccion_ia
FOR DELETE
USING (FALSE);

-- 2. TRIGGER: Prohibir UPDATE (defensa SQL)
CREATE OR REPLACE FUNCTION fn_bloquear_actualizacion_extraccion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'facturas_extraccion_ia es append-only: no se permite UPDATE. ID: %', OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_extraccion_bloquear_update ON facturas_extraccion_ia;
CREATE TRIGGER tg_extraccion_bloquear_update
BEFORE UPDATE ON facturas_extraccion_ia
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_actualizacion_extraccion();

-- 3. TRIGGER: Prohibir DELETE (defensa SQL)
CREATE OR REPLACE FUNCTION fn_bloquear_eliminacion_extraccion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'facturas_extraccion_ia es append-only: no se permite DELETE. ID: %', OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_extraccion_bloquear_delete ON facturas_extraccion_ia;
CREATE TRIGGER tg_extraccion_bloquear_delete
BEFORE DELETE ON facturas_extraccion_ia
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_eliminacion_extraccion();

-- 4. VERIFICACIÓN — RLS policies (no GRANT/REVOKE)
-- Verificar que RLS está habilitado
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'facturas_extraccion_ia';
-- Esperado: rowsecurity = true

-- Verificar que las 4 policies fueron creadas
SELECT COUNT(*) as num_policies
FROM pg_policies
WHERE tablename = 'facturas_extraccion_ia';
-- Esperado: 4

-- Listar todas las RLS policies
SELECT
  policyname,
  permissive,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'facturas_extraccion_ia'
ORDER BY policyname;

-- Verificar que UPDATE está bloqueado (USING = FALSE)
SELECT COUNT(*) as bloqueado_update
FROM pg_policies
WHERE tablename = 'facturas_extraccion_ia'
  AND policyname = 'extraccion_update_bloqueado'
  AND qual = 'FALSE';
-- Esperado: 1

-- Verificar que DELETE está bloqueado (USING = FALSE)
SELECT COUNT(*) as bloqueado_delete
FROM pg_policies
WHERE tablename = 'facturas_extraccion_ia'
  AND policyname = 'extraccion_delete_bloqueado'
  AND qual = 'FALSE';
-- Esperado: 1

-- Verificar que los 2 triggers fueron creados
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'facturas_extraccion_ia'
ORDER BY trigger_name;
-- Esperado: 2 triggers (tg_extraccion_bloquear_delete, tg_extraccion_bloquear_update)

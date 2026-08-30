-- Migración: Actualizar RLS para módulo "Hoy" con permisos de supervisión
-- Objetivo: Permitir que administradores (ambito: "todo") vean todas las tareas
--           Mantener restricción (ambito: "propio") para podólogas
-- Fecha: 2026-08-10
-- Reversible: Sí

-- ============================================================================
-- FUNCIÓN: es_supervisor_hoy()
-- Verifica si el usuario actual tiene permiso de supervisión en "Hoy"
-- (es decir, tiene un rol con "Hoy": {"ambito": "todo"})
-- ============================================================================

CREATE OR REPLACE FUNCTION es_supervisor_hoy()
RETURNS BOOLEAN AS $$
BEGIN
  -- Retorna TRUE si el usuario autenticado tiene algún rol
  -- con "Hoy".ambito = "todo"
  RETURN EXISTS (
    SELECT 1
    FROM usuarios_roles ur
    JOIN roles r ON ur.rol_id = r.id
    WHERE ur.usuario_id = auth.uid()
      AND r.areas_permitidas -> 'Hoy' ->> 'ambito' = 'todo'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ACTUALIZAR POLÍTICAS RLS PARA TABLA: tareas
-- ============================================================================

-- LECTURA: Ver tareas según permisos
DROP POLICY IF EXISTS "tareas_ver_propias" ON tareas;
CREATE POLICY "tareas_ver_propias" ON tareas
  FOR SELECT USING (
    -- Supervisores ven todas las tareas
    es_supervisor_hoy()
    OR
    -- Otros usuarios solo ven las asignadas a ellos
    usuario_id = auth.uid()
  );

-- CREACIÓN: Permitir crear tareas
DROP POLICY IF EXISTS "tareas_crear_propias" ON tareas;
CREATE POLICY "tareas_crear_propias" ON tareas
  FOR INSERT WITH CHECK (
    -- Supervisores pueden crear tareas para cualquiera
    es_supervisor_hoy()
    OR
    -- Otros usuarios solo pueden crear tareas asignadas a sí mismos
    usuario_id = auth.uid()
  );

-- EDICIÓN: Permitir editar tareas
DROP POLICY IF EXISTS "tareas_editar_propias" ON tareas;
CREATE POLICY "tareas_editar_propias" ON tareas
  FOR UPDATE USING (
    -- Supervisores pueden editar cualquier tarea
    es_supervisor_hoy()
    OR
    -- Otros usuarios solo pueden editar las asignadas a ellos
    usuario_id = auth.uid()
  );

-- ELIMINACIÓN: Permitir eliminar tareas
DROP POLICY IF EXISTS "tareas_eliminar_propias" ON tareas;
CREATE POLICY "tareas_eliminar_propias" ON tareas
  FOR DELETE USING (
    -- Supervisores pueden eliminar cualquier tarea
    es_supervisor_hoy()
    OR
    -- Otros usuarios solo pueden eliminar las asignadas a ellos
    usuario_id = auth.uid()
  );

-- ============================================================================
-- NOTAS
-- ============================================================================
--
-- Esta migración mantiene compatibilidad con tareas existentes.
-- Las tareas que ya existen con usuario_id establecido seguirán funcionando.
--
-- DEFINICIÓN DE PERMISOS:
--
-- Supervisores (ambito: "todo" en Hoy):
--   - Andrés (Administrador del sistema)
--   - Sara (Administración) - si roles están configurados
--   - Álvaro (Administración) - si roles están configurados
--   PUEDEN: Ver todas, crear para cualquiera, editar cualquiera, eliminar cualquiera
--
-- Usuarios normales (ambito: "propio" en Hoy):
--   - Podólogas
--   PUEDEN: Ver solo las asignadas a ellas, editar solo las suyas, eliminar solo las suyas
--
-- ============================================================================

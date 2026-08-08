-- ================================================================
-- FASE 1: Correcciones de Schema y RLS para Sincronización
-- ================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- ================================================================
-- 1. FUNCTION: Sincronizar auth.users con public.usuarios
-- ================================================================

CREATE OR REPLACE FUNCTION public.sync_auth_user_to_usuarios()
RETURNS TRIGGER AS $$
BEGIN
  -- Cuando se confirma el email de un usuario en Auth,
  -- crear automáticamente su registro en public.usuarios si no existe

  INSERT INTO public.usuarios (
    id,
    email,
    nombre,
    activo,
    centro_id,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    -- Nombre: primera parte del email (antes del @)
    SPLIT_PART(NEW.email, '@', 1),
    true,
    -- Centro ID por defecto (debe existir en public.centros)
    '12345678-1234-5678-1234-567812345678',
    -- Created by SISTEMA (usuario 00000000...)
    '00000000-0000-0000-0000-000000000000',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();  -- Si ya existe, actualizar timestamp

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario
COMMENT ON FUNCTION public.sync_auth_user_to_usuarios()
IS 'Trigger function que sincroniza auth.users con public.usuarios automáticamente';

-- ================================================================
-- 2. TRIGGER: Ejecutar la sincronización cuando se crea usuario en Auth
-- ================================================================

-- Nota: Este trigger debe crearse en la tabla auth.users directamente
-- pero desde Supabase REST API no podemos hacerlo.
-- Se ejecuta MANUALMENTE en la CLI de Supabase o en SQL Editor directo:
--
-- CREATE TRIGGER on_auth_user_created
-- AFTER INSERT ON auth.users
-- FOR EACH ROW
-- EXECUTE FUNCTION public.sync_auth_user_to_usuarios();

-- ================================================================
-- 3. RLS POLICIES: Permitir que usuarios lean su propio perfil
-- ================================================================

-- Policy: Tabla usuarios - SELECT propio perfil
DROP POLICY IF EXISTS "read_own_profile" ON public.usuarios;
CREATE POLICY "read_own_profile"
ON public.usuarios FOR SELECT
USING (auth.uid() = id);

COMMENT ON POLICY "read_own_profile" ON public.usuarios
IS 'Cada usuario puede ver su propio perfil en usuarios';

-- ================================================================
-- 4. RLS POLICIES: Permitir que usuarios lean sus roles
-- ================================================================

-- Policy: Tabla usuarios_roles - SELECT propios roles
DROP POLICY IF EXISTS "read_own_roles" ON public.usuarios_roles;
CREATE POLICY "read_own_roles"
ON public.usuarios_roles FOR SELECT
USING (usuario_id = auth.uid());

COMMENT ON POLICY "read_own_roles" ON public.usuarios_roles
IS 'Cada usuario puede ver sus propias asignaciones de rol';

-- ================================================================
-- 5. RLS POLICIES: Permitir que usuarios lean los roles disponibles
-- ================================================================

-- Policy: Tabla roles - SELECT público (roles no contienen datos sensibles)
DROP POLICY IF EXISTS "read_all_roles" ON public.roles;
CREATE POLICY "read_all_roles"
ON public.roles FOR SELECT
USING (true);

COMMENT ON POLICY "read_all_roles" ON public.roles
IS 'Todos pueden leer los roles disponibles (no contienen datos sensibles)';

-- ================================================================
-- 6. LIMPIEZA: Eliminar usuario de prueba inconsistente (OPCIONAL)
-- ================================================================

-- Si quieres eliminar admin.test@clinicos.local de Auth:
-- DELETE FROM auth.users WHERE email = 'admin.test@clinicos.local';

-- O si quieres mantenerlo, agregar a public.usuarios:
INSERT INTO public.usuarios (id, email, nombre, activo, centro_id, created_by, created_at, updated_at)
VALUES (
  '4bc4ad90-9955-4593-ac67-e71b323a1bfd',
  'admin.test@clinicos.local',
  'admin.test',
  true,
  '12345678-1234-5678-1234-567812345678',
  '00000000-0000-0000-0000-000000000000',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Y asignarle un rol (Administrador del sistema):
INSERT INTO public.usuarios_roles (usuario_id, rol_id, created_at)
VALUES (
  '4bc4ad90-9955-4593-ac67-e71b323a1bfd',
  '97736608-999c-4771-af7f-0326200221e3',
  NOW()
)
ON CONFLICT DO NOTHING;

-- ================================================================
-- 7. VERIFICACIÓN: Consultar estado actual
-- ================================================================

-- Ver usuarios sincronizados
SELECT 'Usuarios en public.usuarios:' as info;
SELECT id, email, nombre, activo FROM public.usuarios ORDER BY email;

-- Ver asignaciones de rol
SELECT 'Asignaciones de rol:' as info;
SELECT ur.usuario_id, u.email, r.nombre
FROM public.usuarios_roles ur
JOIN public.usuarios u ON u.id = ur.usuario_id
JOIN public.roles r ON r.id = ur.rol_id
ORDER BY u.email;

-- ================================================================
-- NOTAS IMPORTANTES
-- ================================================================
--
-- 1. El TRIGGER debe crearse manualmente porque Supabase no permite
--    triggers en auth.users desde SQL Editor.
--    En su lugar, puedes:
--    a) Usar la CLI: supabase functions create sync-auth
--    b) Usar un webhook de Auth que llame a una Edge Function
--    c) Crear el trigger mediante psql con acceso directo
--
-- 2. Para crear el trigger vía CLI:
--    supabase sql < - << 'EOF'
--    CREATE TRIGGER on_auth_user_created
--    AFTER INSERT ON auth.users
--    FOR EACH ROW
--    EXECUTE FUNCTION public.sync_auth_user_to_usuarios();
--    EOF
--
-- 3. Los RLS policies se crean aquí y HABILITAN automáticamente
--    si RLS está enabled en las tablas (verificar en Supabase Dashboard)
--
-- 4. Después de ejecutar este script, restaurar:
--    - lib/contexts/UserContext.tsx (cargar usuarios + roles)
--    - components/Navigation.tsx (filtrar por permisos)
--    - middleware.ts (proteger rutas)

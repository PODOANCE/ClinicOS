# Decisiones Arquitectónicas - ClinicOS Fase 1

**Fecha**: 2026-08-08  
**Versión**: 1.0  
**Estado**: En Implementación

---

## Contexto

Después de auditoría técnica se encontró que:
- ✅ 6 usuarios existen en Auth y public.usuarios
- ✅ 6 asignaciones de rol ya existen
- ❌ Usuario autenticado `admin.test@clinicos.local` no tiene registro en public.usuarios
- ❌ Hay inconsistencia de IDs en 1 usuario (admin@podologiarivas.com)
- ❌ UserContext fue simplificado evitando carga de permisos

---

## Decisión 1: Fuente Única de Verdad - auth.users

**Principio**: `auth.users` (Supabase Auth) es la fuente autoritativa de identidad.

**Implementación**:
- Toda identidad comienza en Auth
- UUID de Auth = UUID en public.usuarios (1:1 mapping)
- Nunca crear usuarios directamente en public.usuarios sin Auth
- Nunca permitir UUIDs diferentes entre Auth y BD

**Flujo de autoridad**:
```
Auth.users (identidad + credenciales)
    ↓ (UUID)
public.usuarios (perfil ClinicOS)
    ↓ (M:M)
public.usuarios_roles
    ↓ (FK)
public.roles (permisos)
```

---

## Decisión 2: Sincronización Controlada - Database Trigger

**Problema**: Si permitimos inserciones libres desde cliente en public.usuarios, se crea inconsistencia.

**Solución**: Usar un trigger de PostgreSQL que:
1. Detecta cuando un usuario Auth se autentica por primera vez
2. Crea automáticamente entrada en public.usuarios
3. Corre en servidor, no en cliente

**Implementación**:
```sql
CREATE FUNCTION public.sync_auth_to_usuarios()
RETURNS TRIGGER AS $$
BEGIN
  -- Cuando se autentica un usuario, asegurar que existe en public.usuarios
  INSERT INTO public.usuarios (id, email, nombre, activo, centro_id, created_by)
  VALUES (
    NEW.id,
    NEW.email,
    SPLIT_PART(NEW.email, '@', 1),  -- Nombre = parte antes del @
    true,
    '12345678-1234-5678-1234-567812345678',  -- centro_id por defecto
    '00000000-0000-0000-0000-000000000000'   -- SISTEMA
  )
  ON CONFLICT (id) DO NOTHING;  -- Si ya existe, ignorar
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Ubicación**: En Supabase SQL Editor (corre en servidor)

---

## Decisión 3: Sin Permisos Automáticos

**Regla**: Un usuario autenticado sin roles asignados:
- ✅ Puede ver su propio perfil
- ✅ Puede cambiar su contraseña
- ❌ NO puede acceder a ninguna área de negocio
- ❌ NO recibe permisos "por defecto"

**Implementación**:
- Roles son asignados explícitamente por administrador
- En Navigation, si usuario sin roles → mostrar mensaje "Sin permisos"
- En Dashboard, mostrar solo la sección de perfil

---

## Decisión 4: Seguridad - No usar service_role en Cliente

**Regla Strict**: 
- ❌ NO usar `service_role` key en `.env.local` (ni con `NEXT_PUBLIC_`)
- ❌ NO hacer inserciones/updates desde navegador a public.usuarios
- ❌ NO permitir que cliente bypasse RLS

**Cómo se cargan permisos entonces**:
1. Usuario se autentica en cliente (anon key)
2. Client obtiene token de sesión
3. Client consulta `usuarios_roles` + `roles` (permitido por RLS para usuario autenticado)
4. Las RLS policies permiten que el usuario lea sus propias asignaciones

**Implementación de RLS**:
```sql
-- usuarios: cada usuario ve su propio perfil
CREATE POLICY "Usuarios ven su propio perfil"
ON public.usuarios FOR SELECT
USING (id = auth.uid());

-- usuarios_roles: cada usuario ve sus roles
CREATE POLICY "Usuarios ven sus roles"
ON public.usuarios_roles FOR SELECT
USING (usuario_id = auth.uid());

-- roles: todos pueden leer roles (no contienen datos sensibles)
CREATE POLICY "Roles lectura abierta"
ON public.roles FOR SELECT
USING (true);
```

---

## Decisión 5: Multiplos Roles - Matriz de Permisos

**Caso**: Un usuario con roles "Podólogo" + "Administración"

**Cómo se combinan permisos**:
- Los permisos se unen (OR lógico)
- Si rol A permite "ver Facturas" y rol B permite "crear Facturas"
  → Usuario puede ver Y crear Facturas

**Implementación**:
```typescript
function getEffectivePermissions(roles: Rol[]): Record<string, AreaPermiso> {
  const merged: Record<string, AreaPermiso> = {};
  
  roles.forEach(role => {
    Object.entries(role.areas_permitidas || {}).forEach(([area, permisos]) => {
      if (!merged[area]) {
        merged[area] = { ver: false };
      }
      // Unir permisos (OR lógico)
      merged[area].ver = merged[area].ver || permisos.ver;
      merged[area].crear = merged[area].crear || permisos.crear;
      merged[area].editar = merged[area].editar || permisos.editar;
      merged[area].aprobar = merged[area].aprobar || permisos.aprobar;
    });
  });
  
  return merged;
}
```

---

## Decisión 6: Protección de Rutas - Servidor + Cliente

**Capas de protección**:

1. **Servidor (middleware.ts)** - Verificación fuerte
   - Valida token Auth
   - Verifica existencia en public.usuarios
   - Verifica permisos en base de datos
   - Si falla → 401/403

2. **Cliente (components + UserContext)** - UX layer
   - Oculta menús que usuario no puede ver
   - Redirige si intenta acceso directo a ruta
   - Muestra mensajes de permiso denegado
   - **NO es seguridad, es comodidad**

**Flujo**:
```
URL /areas/facturas
    ↓
Middleware: ¿Token válido? ¿Usuario existe? ¿Tiene permiso "Facturas"?
    ├─ Sí → Permite continuar
    └─ No → 403 Forbidden (no ejecuta componente)
    ↓
Navigation: ¿Usuario en useUser().roles incluye "Facturas"?
    ├─ Sí → Muestra link en sidebar
    └─ No → Lo oculta
    ↓
DashboardPage: Si llegó aquí, puede renderizar con seguridad
```

---

## Decisión 7: Limpieza de Datos

**Estado actual**:
- ✅ 6 usuarios genuinos (clínica real)
- ❌ 2 usuarios de prueba (admin.phase1.* @clinic.local)
- ❌ 1 usuario nuevo (admin.test@clinicos.local sin BD)

**Decisión**:
- Mantener los 6 usuarios reales
- Mantener los 2 de prueba para testing inicial
- Eliminar admin.test@clinicos.local de Auth (o crear en BD si queremos reutilizar)

**Acción**:
```sql
DELETE FROM auth.users WHERE email = 'admin.test@clinicos.local';
-- O crear en BD:
INSERT INTO public.usuarios (id, email, nombre, activo, centro_id, created_by)
VALUES (
  '4bc4ad90-9955-4593-ac67-e71b323a1bfd',
  'admin.test@clinicos.local',
  'Admin Prueba',
  true,
  '12345678-1234-5678-1234-567812345678',
  '00000000-0000-0000-0000-000000000000'
);

-- Y asignarle rol:
INSERT INTO public.usuarios_roles (usuario_id, rol_id)
VALUES (
  '4bc4ad90-9955-4593-ac67-e71b323a1bfd',
  '97736608-999c-4771-af7f-0326200221e3'  -- Administrador del sistema
);
```

---

## Decisión 8: RLS Policies - Permitir Lecturas Autorizadas

**Goal**: Usuario autenticado DEBE poder leer su propio perfil y roles.

**RLS Policies a implementar**:

```sql
-- Tabla: usuarios
-- Política 1: Cada usuario ve su propio perfil
CREATE POLICY "read_own_profile"
ON public.usuarios FOR SELECT
USING (auth.uid() = id);

-- Tabla: usuarios_roles
-- Política 1: Cada usuario ve sus propias asignaciones de rol
CREATE POLICY "read_own_roles"
ON public.usuarios_roles FOR SELECT
USING (usuario_id = auth.uid());

-- Tabla: roles
-- Política 1: Todos pueden ver disponibles roles
CREATE POLICY "read_all_roles"
ON public.roles FOR SELECT
USING (true);  -- O: USING (auth.uid() IS NOT NULL) si requiere auth
```

---

## Decisión 9: UserContext Restaurado

**Propósito**: Proporcionar datos de usuario y permisos al árbol de componentes.

**Datos que carga**:
```typescript
interface UserSession {
  id: string | null;
  email: string | null;
  nombre: string | null;
  roles: Rol[];                           // Roles completos con areas_permitidas
  permisos: Record<string, AreaPermiso>;  // Permisos efectivos (multirol unido)
  loading: boolean;
}
```

**Queries que ejecuta**:
```typescript
// 1. Obtener usuario auth
const { data: { user } } = await supabase.auth.getUser();

// 2. Si existe, obtener perfil desde BD
const { data: usuario } = await supabase
  .from('usuarios')
  .select('*')
  .eq('id', user.id)
  .single();

// 3. Obtener roles con relación
const { data: usuarioRoles } = await supabase
  .from('usuarios_roles')
  .select('rol:roles(*)')
  .eq('usuario_id', user.id);

// 4. Calcular permisos efectivos
const permisos = getEffectivePermissions(roles);
```

**Errores esperados**:
- ✅ Si usuario no existe en BD → mostrar "Perfil pendiente"
- ✅ Si usuario sin roles → permisos vacío
- ✅ Si query falla por permisos → mostrar error autenticado

---

## Decisión 10: Navigation - Filtrado por Permisos Reales

**Antes (Fase 0 - Error)**:
```typescript
// Intentaba: roles sin datos, navigation se rompía
const accessibleAreas = getAccessibleAreas(roles);
```

**Ahora (Fase 1 - Correcto)**:
```typescript
// Usa los permisos efectivos del UserContext
const { permisos } = useUser();

const navItems = [
  { nombre: 'Dashboard', href: '/dashboard', permiso: null },  // Siempre visible
  { nombre: 'Hoy', href: '/areas/hoy', permiso: 'Hoy' },
  { nombre: 'Facturas', href: '/areas/facturas', permiso: 'Facturas' },
  // ...
].filter(item => !item.permiso || permisos[item.permiso]?.ver);
```

---

## Decisión 11: Tests Obligatorios Antes de Cerrar Fase 1

**Test 1**: Usuario autenticado con rol "Administrador del sistema"
- ✅ Puede ver su perfil
- ✅ Ve todos los menús (si tiene permisos en cada área)
- ✅ UserContext carga correctamente

**Test 2**: Usuario autenticado sin rol alguno
- ✅ Puede ver su perfil
- ✅ Dashboard muestra "Sin permisos"
- ✅ Navigation vacío (solo Dashboard)
- ✅ Intento de acceso a /areas/facturas → 403 Forbidden

**Test 3**: Usuario con múltiples roles
- ✅ Ejemplo: "Podólogo" + "Administración"
- ✅ Permisos se combinan correctamente
- ✅ Navigation muestra áreas de ambos roles

**Test 4**: Acceso a ruta no autorizada
- ✅ GET /areas/stock sin permiso → middleware rechaza
- ✅ Respuesta: 403 Forbidden

---

## Plan de Implementación

1. ✅ **Auditoría** - Completada
2. 📄 **Este documento** - Completando
3. 🔧 **SQL Changes**
   - Crear trigger de sincronización
   - Verificar/crear RLS policies
   - Limpiar datos de prueba inconsistentes
4. 💻 **Código**
   - Restaurar UserContext
   - Restaurar Navigation con filtrado
   - Implementar middleware de protección
   - Calcular permisos multirol
5. 🧪 **Tests** - Los 4 casos mencionados
6. ✅ **Cerrar Fase 1**

---

## Referencias

- **AUDIT_REPORT.md** - Hallazgos técnicos
- **BUILD_PLAN.md** - Plan de fases
- **RLS Documentation** - https://supabase.com/docs/guides/auth/row-level-security

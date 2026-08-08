# ClinicOS - Plan de Construcción

**Versión**: 0.1.0  
**Última Actualización**: 2026-08-08  
**Estado Actual**: Fase 1 ✅ Completada

---

## Fase 1: Shell Operativo ✅

### Objetivos
- [x] Autenticación básica con Supabase Auth
- [x] Estructura de shell layout (Header + Navigation + Content)
- [x] Dashboard básico funcional
- [x] Session management
- [x] Navegación sin errores de runtime

### Implementado
- ✅ **Autenticación**: Login/logout con email y contraseña vía Supabase Auth
- ✅ **UserContext**: Contexto React para gestionar sesión de usuario (id, email, loading)
- ✅ **Shell Layout**: `app/(shell)/layout.tsx` con Header + Navigation + Content
- ✅ **Header**: Componente que muestra nombre del usuario y botón logout
- ✅ **Navigation**: Menú sidebar básico con links a Dashboard y Hoy
- ✅ **Dashboard**: Página de bienvenida mostrando estado de sesión
- ✅ **Dev Server**: Configuración Next.js con Turbopack
- ✅ **TypeScript**: Sin errores de compilación

### No Implementado (Deferred to Phase 2)
- ❌ Carga de roles y permisos desde BD
- ❌ Validación de acceso por permisos
- ❌ Filtrado de navegación según roles
- ❌ Protección de rutas por middleware
- ❌ Datos completos del usuario desde tabla `usuarios`

### Arquitectura
```
app/
├── (shell)/
│   ├── layout.tsx          # Shell wrapper
│   └── dashboard/page.tsx  # Dashboard page
├── login/page.tsx          # Login page
├── layout.tsx              # Root layout con UserProvider

components/
├── Header.tsx              # User info + logout button
└── Navigation.tsx          # Sidebar menu

lib/
├── contexts/UserContext.tsx    # Session management
└── supabase/client.ts          # Singleton Supabase client
```

### Base de Datos (Fase 1)
- ✅ Tabla `auth.users` (Supabase Auth)
- ⏳ Tabla `usuarios` (no usada en Fase 1 por RLS)
- ⏳ Tabla `roles` (no usada en Fase 1)
- ⏳ Tabla `usuarios_roles` (no usada en Fase 1)

### Seguridad
- ✅ Row Level Security habilitado (pero no usado en Fase 1)
- ✅ No almacenar contraseñas en cliente
- ✅ Usar Supabase Auth para auth token management
- ⏳ Middleware de protección de rutas (Fase 2)

### Testing
- ✅ Usuario de prueba: `admin.test@clinicos.local` / `TestAdmin123!@#`
- ✅ Login funciona y redirige a dashboard
- ✅ No hay errores en consola (excepto recursos 404)

---

## Fase 2: Permisos y Roles ⏳

### Objetivos
- [ ] Cargar roles del usuario desde BD
- [ ] Calcular matriz de permisos
- [ ] Filtrar navegación por permisos
- [ ] Proteger rutas por middleware
- [ ] Validar permisos en components

### Tareas
1. Restaurar datos de usuario desde tabla `usuarios`
2. Cargar `usuarios_roles` y mapear con `roles`
3. Implementar `getAccessibleAreas()` con datos de BD
4. Actualizar Navigation para filtrar por permisos
5. Re-habilitar y mejorar middleware
6. Crear validadores de permiso en componentes

---

## Fase 3: Módulos de Negocio ⏳

### Áreas Planificadas
- [ ] Hoy - Citas y tareas del día
- [ ] Facturas - Gestión de facturas
- [ ] Stock - Gestión de inventario
- [ ] Leads - CRM básico
- [ ] Vacaciones - Gestión de licencias

---

## Guía de Credenciales

### Usuarios de Prueba (Fase 1)
```
Email:    admin.test@clinicos.local
Password: TestAdmin123!@#
Rol:      (none - solo Auth en Fase 1)
```

### Usuarios Preexistentes (BD - No usados en Fase 1)
- admin@podologiarivas.com
- info@podologiarivas.com
- ortopedia@podologiarivas.com
- podologia@podologiarivas.com

---

## Notas Técnicas

### Por Qué Fase 1 Simplificado
1. RLS policies estaban bloqueando inserciones en `usuarios`
2. Crear usuarios con rol completo requería actualizar BD
3. Enfoque pragmático: Auth funciona sin BD en Fase 1
4. Separación clara: Fase 1 = autenticación, Fase 2 = autorización

### Variables de Entorno Necesarias
```
NEXT_PUBLIC_SUPABASE_URL=https://gyusgttlwjpnwchmrjih.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Scripts Disponibles
- `npm run dev` - Inicia servidor en http://localhost:3000
- `create-auth-user.js` - Crea usuario en Supabase Auth (requiere cambios)
- `check-users.js` - Lista usuarios en BD

---

## Próximos Pasos (Fase 2)

1. **BD**: Revisar RLS policies y permitir inserciones autorizadas
2. **Contexto**: Restaurar carga de roles en UserContext
3. **Validación**: Implementar matriz de permisos
4. **Navegación**: Filtrar menú por permisos
5. **Rutas**: Proteger con middleware y componentes

# ClinicOS - Plan de Construcción

**Versión**: 0.1.0  
**Última Actualización**: 2026-08-17  
**Estado Actual**: Fase 1 ✅ Shell + Autenticación + Roles + Permisos (COMPLETADA)

---

## Fase 1: Shell + Autenticación + Roles + Permisos ✅ COMPLETADA

### Objetivos ✅ Cumplidos
- [x] Autenticación con Supabase Auth
- [x] Estructura de shell layout (Header + Navigation + Content)
- [x] Dashboard funcional
- [x] Session management
- [x] Navegación sin errores de runtime
- [x] Carga de roles y permisos desde BD
- [x] Filtrado dinámico de navegación según permisos
- [x] Datos completos del usuario
- [x] RLS funcionando

### Implementado
- ✅ **Autenticación**: Login/logout con email y contraseña vía Supabase Auth
- ✅ **UserContext**: Contexto React con sesión, roles, permisos, centro_id
- ✅ **Shell Layout**: `app/(shell)/layout.tsx` con Header + Navigation + Content
- ✅ **Header**: Muestra nombre del usuario y botón logout
- ✅ **Navigation**: Menú sidebar filtrado por permisos reales del usuario
- ✅ **Dashboard**: Perfil completo, roles asignados, áreas accesibles
- ✅ **Módulo Hoy**: Tareas internas (crear, editar, eliminar, completar, reabrir)
- ✅ **Roles & Permisos**: 6 usuarios con roles definidos, RLS en BD
- ✅ **RLS**: Políticas de fila para seguridad de datos por usuario/rol
- ✅ **TypeScript**: Sin errores de compilación
- ✅ **Build**: `npm run build` pasa exitosamente

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
- ✅ Tabla `usuarios` (con RLS funcionando)
- ✅ Tabla `roles` (con 4 roles definidos)
- ✅ Tabla `usuarios_roles` (6 usuarios con roles asignados)
- ✅ Tabla `centros` (centros clínicos)
- ✅ Tabla `tareas` (Módulo Hoy)

### Seguridad
- ✅ Row Level Security habilitado y funcionando
- ✅ Políticas RLS en todas las tablas críticas
- ✅ No almacenar contraseñas en cliente
- ✅ Usar Supabase Auth para auth token management
- ✅ Middleware de protección de rutas implementado
- ✅ Función `private.has_role()` para validación de permisos

### Testing
- ✅ 6 usuarios reales completamente testeados
- ✅ Login funciona para todos los usuarios
- ✅ Roles se cargan correctamente
- ✅ Permisos se aplican según rol
- ✅ Navigation se filtra por permisos
- ✅ No hay errores en consola
- ✅ `npm run build` exitoso

---

## Fase 2: Módulo Facturas ✅ PARCIALMENTE COMPLETO (2026-08-30)

**Versión actualizada**: 0.2.0

### Bloque A: Base de Datos ✅ COMPLETADO (2026-08-17)
- ✅ Schema `private` + función `private.has_role()`
- ✅ 6 nuevas tablas con índices y constraints
- ✅ RLS policies en todas las tablas
- ✅ RPC `claim_factura_para_procesamiento()` para service_role
- ✅ Actor técnico SISTEMA_CRON en usuarios_sistema

### Bloque 0: Google Drive + OAuth2 ✅ VALIDADO
- ✅ OAuth2 con Google Drive
- ✅ Listado de archivos
- ✅ Creación, lectura, movimiento de PDFs
- ✅ Preservación de file_id
- ✅ Service Account descartada

### Bloque B: Integración Funcional ✅ PARCIALMENTE COMPLETO

**B.2: Detección y Registro** ✅ COMPLETO (2026-08-29)
- [x] Detección de PDFs nuevos en ENTRADA
- [x] Registro automático en tabla `facturas`
- [x] Idempotencia por `UNIQUE(drive_file_id)`
- [x] `service_role` para operaciones servidor
- [x] Estados: PENDIENTE

**B.3: Lectura y Extracción con IA** ✅ COMPLETO (2026-08-30)
- [x] Descarga segura de PDF desde Drive
- [x] Extracción de texto (detección de escaneos)
- [x] Claude Vision para extracción de datos
- [x] Validación matemática determinista
- [x] Almacenamiento en `facturas_extraccion_ia`
- [x] Estados: LECTURA_PENDIENTE → LECTURA_EXITOSA → VALIDACION_EXITOSA
- [x] Auditoría de respuestas IA

**B.3.5: Asignación de Proveedor** ✅ COMPLETO (2026-08-30)
- [x] Búsqueda por CIF/NIF
- [x] Idempotencia controlada (no error DB)
- [x] Asignación automática si existe

**B.4: UI de Facturas** ✅ COMPLETO (2026-08-30)
- [x] Lista de facturas con tabla
- [x] Filtro por estado
- [x] Muestra proveedor, fecha, total
- [x] Códigos de color por estado
- [x] Endpoint `/api/facturas/listar`
- [x] Página `/app/(shell)/facturas`

**B.5: Conciliación** 🟡 SIGUIENTE
- [ ] Importación CSV bancario
- [ ] Conciliación automática
- [ ] Gestión de incidencias
- [ ] Estado independiente para gestoría

**Objetivo anterior**: Procesar PDFs de Drive, extraer datos con IA, clasificar, conciliar, gestionar incidencias.

**Estructura Google Drive**:
```
FACTURAS/
├── ENTRADA/
├── SIN CLASIFICAR/
└── 2026/
    └── MES/
        ├── PENDIENTES DE ENVIAR A GESTORÍA/
        └── ENVIADAS A GESTORÍA/
```

**Pasos de implementación**:
1. [ ] Integración productiva con Google Drive
2. [ ] Detección de nuevos PDFs en ENTRADA
3. [ ] Motor de procesamiento semanal/manual
4. [ ] Procesamiento por lotes (idempotente)
5. [ ] IA (Claude API) para leer y extraer datos
6. [ ] Clasificación automática año/mes
7. [ ] Movimiento automático de archivos
8. [ ] Interfaz de Facturas (vista, filtros, estados)
9. [ ] Importación CSV para banco
10. [ ] Conciliación factura ↔ movimiento
11. [ ] Gestión de incidencias
12. [ ] Estado independiente para gestoría
13. [ ] Integración con Hoy para incidencias críticas

---

## Fase 3: Módulos de Negocio Futuros ⏳

### Áreas Planificadas
- ✅ **Hoy** - ✅ Tareas internas (COMPLETADA) - NO incluye citas clínicas
- 🟡 **Facturas** - ✅ Base datos + OAuth2 validado (BLOQUE B en curso)
- [ ] **Stock** - Gestión de inventario
- ❌ **Pacientes/Citas/CRM** - Gestionado por Organízate (no en ClinicOS)
- ❌ **Facturación Clínica** - Gestionada por Organízate (no en ClinicOS)
- [ ] **Vacaciones** - Gestión de licencias

---

## Usuarios Definitivos del Sistema

**NO añadir usuarios adicionales.**

1. **PODOANCE SL** (Organización)
   - Email: admin@podologiarivas.com
   - Rol: Administrador del sistema

2. **Sara Gómez Velázquez**
   - Email: s.gomez@podologiarivas.com
   - Rol: Administración

3. **Álvaro Espada Bermejo**
   - Email: a.espada@podologiarivas.com
   - Rol: Administración

4. **Belén Iglesias Arias**
   - Email: b.iglesias@podologiarivas.com
   - Rol: Podólogo

5. **Paula Castillo Carpio**
   - Email: p.castillo@podologiarivas.com
   - Rol: Podólogo

6. **Patricia Jerónimo Hernández**
   - Email: p.jeronimo@podologiarivas.com
   - Rol: Ortopeda

---

## Notas Técnicas

### Arquitectura de Fase 1
1. Separación clara: Autenticación (Auth) ≠ Autorización (Roles/Permisos)
2. Fuente única de verdad: auth.users (Supabase Auth)
3. Sincronización automática: Trigger PostgreSQL
4. RLS obligatorio: Todas las tablas críticas
5. Permisos explícitos: No automáticos, asignados manualmente

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

## Próximos Pasos (Fase 2: Facturas Bloque B)

**Orden de implementación**:

1. Integración productiva con Google Drive
2. Detección de nuevos PDFs en carpeta ENTRADA
3. Motor de procesamiento semanal/manual
4. Procesamiento por lotes con idempotencia
5. IA (Claude API) para lectura y extracción de datos
6. Clasificación automática año/mes
7. Movimiento automático de archivos en Drive
8. Interfaz de usuario para Facturas (vista, filtros, estados)
9. Importación de CSV bancario
10. Conciliación automática
11. Gestión de incidencias
12. Estado independiente para gestoría
13. Integración con módulo Hoy si aplica

**NO implementar**:
- Gestión de pacientes/citas (Organízate)
- Facturación clínica (Organízate)
- Nuevos usuarios
- Modificaciones en Fase 1 (Shell, Auth, Roles, Permisos, Hoy)

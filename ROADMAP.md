# ClinicOS - Roadmap Definitivo

**Última Actualización**: 2026-08-30  
**Versión**: 0.2.1

---

## Resumen General

ClinicOS es un sistema interno de gestión administrativa para clínicas. **NO gestiona pacientes, citas o facturación clínica** (eso lo hace Organízate).

**ClinicOS gestiona**:
- Tareas internas de trabajo
- Facturas recibidas de proveedores
- Conciliación bancaria
- Incidencias administrativas

---

## Fases Completadas ✅

### Fase 0: Fundaciones ✅ COMPLETADA
- [x] Repo git configurado
- [x] Supabase proyecto activo
- [x] Arquitectura base definida
- [x] Build system (Next.js + Turbopack)
- [x] Documentación inicial

**Fecha**: 2026-08-01 a 2026-08-07

---

### Fase 1: Shell + Autenticación + Roles + Permisos ✅ COMPLETADA
- [x] Supabase Auth funcionando
- [x] Login/logout operativo
- [x] UserContext con sesión, roles, permisos
- [x] Layout shell (Header + Navigation + Content)
- [x] Dashboard completo
- [x] Módulo Hoy (tareas internas)
- [x] RLS configurado
- [x] 6 usuarios definitivos
- [x] Build exitoso

**Fecha**: 2026-08-08 a 2026-08-17

**Estado**: Estable, listo para producción

---

## Fases en Progreso 🟡

### Fase 2: Módulo Facturas - Bloque A ✅ + Bloque 0 ✅ + Bloque B 🟡

**Bloque A: Base de Datos** ✅ COMPLETADO (2026-08-17)
- [x] 6 nuevas tablas creadas
- [x] RLS implementado (12 políticas)
- [x] RPC de claim creado
- [x] Índices y constraints
- [x] Actor técnico SISTEMA_CRON

**Bloque 0: Google Drive + OAuth2** ✅ VALIDADO
- [x] OAuth2 funciona
- [x] Acceso a Drive confirmado
- [x] file_id se preserva

**Bloque B: Integración Funcional** 🟡 EN PROGRESO

**B.1: Validación Google Drive** ✅ (2026-08-20)
- [x] OAuth2 con Google Drive
- [x] Listado de PDFs
- [x] Preservación de file_id

**B.2: Detección y Registro** ✅ (2026-08-29)
- [x] Detección de PDFs nuevos en ENTRADA
- [x] Registro idempotente en tabla `facturas`
- [x] `service_role` para operaciones en servidor
- [x] Idempotencia por UNIQUE(drive_file_id)

**B.3: Lectura y Extracción con IA** ✅ (2026-08-30)
- [x] Descarga segura de PDF desde Drive
- [x] Extracción de texto con detección de escaneos
- [x] Claude Vision para extracción de datos
- [x] Validación matemática determinista
- [x] Almacenamiento en `facturas_extraccion_ia`
- [x] Estados granulares (LECTURA_PENDIENTE → VALIDACION_EXITOSA)
- [x] Auditoría de respuestas IA

**B.3.5: Mejoras Idempotencia** ✅ (2026-08-30)
- [x] Devolver estado controlado en segunda ejecución (no error DB)
- [x] Permite reprocesamiento de facturas con error
- [x] Buscar proveedor por CIF/NIF

**B.4: UI de Facturas** ✅ (2026-08-30)
- [x] Interfaz de usuario: listado de facturas
- [x] Filtro por estado de lectura
- [x] Mostrar: número, proveedor, fecha, total, estado
- [x] Endpoint `/api/facturas/listar`

**B.4.1: Detalle de Factura** ✅ (2026-08-30)
- [x] Vista detallada por factura
- [x] Información completa (fechas, importes, estado)
- [x] Datos de extracción IA
- [x] Link a PDF en Google Drive
- [x] Auditoría de respuestas IA (expandible)
- [x] Endpoint `/api/facturas/[id]`

**B.4.2: Revisión + Edición + Auditoría** ▶️ SIGUIENTE
- [ ] Edición controlada (número, fechas, importes, proveedor, concepto, IBAN)
- [ ] Búsqueda de proveedor con autocomplete
- [ ] Reprocesamiento con IA
- [ ] Estado de revisión independiente (PENDIENTE_REVISION, APROBADA_MANUALMENTE, RECHAZADA)
- [ ] Tabla `facturas_historial` para auditoría append-only
- [ ] Registrar usuario, fecha/hora, acción, valores anterior/nuevo
- [ ] Distinción clara: estado_lectura (IA) ≠ estado_revision (humano)

**B.4.3: Documento/Descarga** ⏳
- [ ] Descarga de PDF original
- [ ] Impresión de resumen

**B.5: Conciliación** ⏳
- [ ] Importación CSV bancario
- [ ] Conciliación automática
- [ ] Gestión de incidencias
- [ ] Estado independiente para gestoría

**Estimado**: Completar B.4 en 1 semana, B.5 en 1-2 semanas

---

## Fases Planificadas ⏳

### Fase 3: Módulos Adicionales
- [ ] **Stock**: Gestión de inventario
- [ ] **Vacaciones**: Gestión de licencias

**Estimado**: Post-Facturas

---

## NO en ClinicOS ❌

**Estos módulos están fuera del alcance** (gestionados por Organízate):
- ❌ Pacientes
- ❌ Agenda/citas clínicas
- ❌ Historia clínica
- ❌ Facturación a pacientes
- ❌ CRM

---

## Usuarios Definitivos

**Total**: 6 usuarios, sin cambios futuros

| # | Nombre | Email | Rol |
|---|--------|-------|-----|
| 1 | PODOANCE SL | admin@podologiarivas.com | Administrador del sistema |
| 2 | Sara Gómez | s.gomez@podologiarivas.com | Administración |
| 3 | Álvaro Espada | a.espada@podologiarivas.com | Administración |
| 4 | Belén Iglesias | b.iglesias@podologiarivas.com | Podólogo |
| 5 | Paula Castillo | p.castillo@podologiarivas.com | Podólogo |
| 6 | Patricia Jerónimo | p.jeronimo@podologiarivas.com | Ortopeda |

---

## Estructura Google Drive para Facturas

**Única**: FACTURAS/

```
FACTURAS/
├── ENTRADA/                          ← Usuario coloca PDFs aquí
├── SIN CLASIFICAR/                   ← IA no pudo procesar
└── 2026/
    ├── ENERO/
    │   ├── PENDIENTES DE ENVIAR A GESTORÍA/
    │   └── ENVIADAS A GESTORÍA/
    ├── FEBRERO/
    ├── ...
    └── DICIEMBRE/
```

---

## Tecnología

| Componente | Stack |
|-----------|-------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind |
| **Backend** | Next.js API Routes |
| **BD** | Supabase PostgreSQL |
| **Auth** | Supabase Auth |
| **Cloud Storage** | Google Drive |
| **IA** | Claude API (futuro) |

---

## Seguridad

- ✅ Supabase Auth (credenciales seguras)
- ✅ RLS en todas las tablas
- ✅ No usar service_role en cliente
- ✅ Permisos basados en roles
- ✅ Auditoría de cambios

---

## Variables de Entorno Requeridas

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://gyusgttlwjpnwchmrjih.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<client_id>
GOOGLE_CLIENT_SECRET=<client_secret>

# Claude API (futuro)
CLAUDE_API_KEY=<api_key>
```

---

## Decisiones Arquitectónicas Clave

1. **Fuente única de verdad**: auth.users (Supabase Auth)
2. **Sincronización automática**: Trigger PostgreSQL
3. **RLS obligatorio**: Todas las tablas
4. **Permisos explícitos**: No automáticos
5. **Separación clara**: Auth (Fase 1) ≠ Negocio (Fase 2+)
6. **Google Drive como repositorio**: Fuente de verdad para PDFs
7. **Procesamiento idempotente**: Tolerante a reintentos
8. **Lease de 15 minutos**: Para claim de facturas

---

## Documentación Relacionada

- [BUILD_PLAN.md](BUILD_PLAN.md) - Plan detallado por fase
- [PHASE1_STATUS.md](PHASE1_STATUS.md) - Estado de Fase 1
- [DECISIONS.md](DECISIONS.md) - Decisiones arquitectónicas
- [docs/03-DATA_MODEL.md](docs/03-DATA_MODEL.md) - Modelo de datos
- [docs/05-ARCHITECTURE.md](docs/05-ARCHITECTURE.md) - Arquitectura del sistema

---

## Estado Actual (2026-08-30)

**Listo para**: B.5 (Conciliación)

**Completado**: Fase 1 + Facturas B.2 + B.3 + B.3.5 + B.4 + B.4.1

**Bloqueadores**: Ninguno

**Deuda técnica**: Ninguna crítica

**Calidad de código**: ✅ Excelente (TypeScript, sin errores)

**Build**: ✅ Exitoso (npm run build)

---

## Contacto

**Proyecto**: ClinicOS  
**Repositorio**: `/Users/podoancesl/Desktop/ClinicOS`  
**Supabase**: gyusgttlwjpnwchmrjih.supabase.co

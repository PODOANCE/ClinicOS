# Schema Validation Checklist

Validación técnica del schema SQL antes de ejecutarlo en Supabase.

## ✅ Validación contra 03-DATA_MODEL.md

### Objetos del Sistema

- [x] **Usuario**
  - [x] email (identificador único)
  - [x] nombre
  - [x] activo (bool)
  - [x] empleado_id (FK, opcional)
  - [x] roles (relación M:M)
  - [x] No contraseña (manejado por Auth)
  - [x] No cargo (vive en Empleado)

- [x] **Rol**
  - [x] nombre (único)
  - [x] areas_permitidas (JSONB, extensible)
  - [x] No almacenar lógica de negocio

- [x] **Tarea**
  - [x] título
  - [x] descripción (opcional)
  - [x] usuario_id (asignado a)
  - [x] estado (abierta/hecha)
  - [x] tipo_objeto + objeto_id (opcional)
  - [x] origen (manual/area)
  - [x] fecha_límite (opcional)

### Objetos de Configuración

- [x] **Centro**
  - [x] Creado desde V1 para preparar multi-centro
  - [x] No requiere en Fase 1 pero está preparado

### Reglas Comunes

- [x] **Archivado**: Todos tienen `archived_at` (nunca borrar)
- [x] **Autoría**: `created_by` + `created_at` en todos
- [x] **Actualización**: `updated_at` en todos
- [x] **Identidad**: UUIDs únicos y estables
- [x] **Nombres**: Singular (Usuario, no Usuarios)

---

## ✅ Validación de Relaciones

- [x] `usuarios.id` → `auth.users.id` (FK implícita)
- [x] `usuarios.centro_id` → `centros.id`
- [x] `usuarios.empleado_id` → `empleados.id` (será agregada en Fase 2)
- [x] `usuarios_roles.usuario_id` → `usuarios.id` (ON DELETE CASCADE)
- [x] `usuarios_roles.rol_id` → `roles.id` (ON DELETE CASCADE)
- [x] `tareas.usuario_id` → `usuarios.id` (ON DELETE CASCADE)
- [x] `tareas.centro_id` → `centros.id`
- [x] `tareas.created_by` → `usuarios_sistema.id`
- [x] Todos los FK usan CASCADE para mantener integridad

---

## ✅ Validación de Auditoría

- [x] `created_by` es UUID (no string)
- [x] `created_by` apunta a `usuarios_sistema` (usuario especial para cambios automáticos)
- [x] `created_at` registra timestamp de creación
- [x] `updated_at` registra última modificación
- [x] `archived_at` marca archivos sin borrar

**Caso especial:** Usuario sistema (`00000000-0000-0000-0000-000000000000`)
- [x] UUID fijo y documentado
- [x] No aparece en listas de usuarios activos (created_by != id)
- [x] No puede hacer login (sin entrada en auth.users)
- [x] Registra cambios automáticos

---

## ✅ Validación de RLS

### Decisión: RLS básicas (provisional V1)

- [x] **roles**: Lectura pública (todos pueden leer para resolver permisos)
- [x] **usuarios**: Lectura pública de activos (PROVISIONAL: futuras Áreas agregarán restricciones específicas)
- [x] **usuarios_roles**: Lectura personal (cada usuario ve solo sus roles)
- [x] **tareas**: Lectura/creación personal (usuario ve solo sus propias tareas)

**Documentación:** Todas las políticas incluyen comentarios explicando que son PROVISIONALES en V1.

---

## ✅ Validación de Índices

- [x] `usuarios.activo` — query frecuente: listar usuarios activos
- [x] `usuarios.centro_id` — future query: usuarios de un centro
- [x] `usuarios_roles.usuario_id` — frequent: cargar roles de usuario
- [x] `tareas.usuario_id` — frequent: cargar tareas de usuario (Hoy)
- [x] `tareas.estado` — frequent: filtrar tareas abiertas vs. hechas
- [x] `tareas.centro_id` — future: tareas de un centro
- [x] `tareas.fecha_limite` — frequent: ordenar por urgencia

---

## ✅ Validación de Compatibilidad

- [x] No usa características exóticas de PostgreSQL
- [x] Compatible con Supabase
- [x] Compatible con política de seguridad (RLS)
- [x] Soporta Supabase Auth nativo
- [x] JSONB es bien soportado en Supabase

---

## ✅ Preparación para Futuro

### Fase 2+: Nuevas Áreas

Cuando se construyan Áreas (Facturas, Stock, Leads, Vacaciones):
- [x] Cada una agregará su propia tabla
- [x] Todas llevarán `centro_id UUID NOT NULL REFERENCES centros(id)`
- [x] Todas llevarán metadatos: created_by, created_at, updated_at, archived_at
- [x] Todas agregarán sus propias políticas RLS (por Área)

**Ejemplo (Facturas, Fase 3):**
```sql
CREATE TABLE facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id),
  numero_factura TEXT NOT NULL,
  total DECIMAL(10, 2),
  estado TEXT,
  centro_id UUID NOT NULL REFERENCES centros(id),  -- Preparado desde V1
  created_by UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMP
);
```

### Fase 3+: Relaciones con Áreas

Cuando Áreas referencias a usuarios/tareas:
- [x] Las tareas apuntan a objetos de Áreas (tipo_objeto + objeto_id)
- [x] Los usuarios pueden ser creados/editados por aplicación (no automatización)
- [x] Los centros pueden tener relaciones adicionales

---

## ⚠️ Limitaciones Conocidas

1. **No hay validación de permisos en RLS**: Las restricciones definitivas serán por Área
   - ACEPTABLE: Lógica de aplicación valida
   - REVISION: Cuando existan 3+ Áreas, evaluar si RLS de BD agregan valor

2. **Usuario sistema es hardcoded**: UUID `00000000...`
   - MITIGACION: Bien documentado, no aparece en listas normales

3. **Lectura de usuarios es pública**: Email + nombre visibles
   - ACEPTABLE: No son datos clínicos
   - REVISION: Si un Área necesita ocultar usuarios, agregará su propia lógica

---

## Pasos Previos a Ejecutar en Supabase

1. [ ] Copiar TODO el contenido de `DATABASE_SCHEMA.sql`
2. [ ] Ir a Supabase → SQL Editor
3. [ ] Pegar
4. [ ] Ejecutar
5. [ ] Verificar que NO hay errores
6. [ ] Verificar que se crearon las 5 tablas + índices + RLS policies

**Orden esperado de ejecución:**
1. `usuarios_sistema` table + insert
2. `centros` table
3. `roles` table
4. `usuarios` table
5. `usuarios_roles` table
6. `tareas` table
7. Todos los índices
8. Todas las políticas RLS

---

## Seguimiento Post-Ejecución

- [ ] Las 5 tablas existen en Supabase (verificar en "Database" → "Tables")
- [ ] Los índices están creados
- [ ] Las RLS policies están activas
- [ ] Ningún error en el SQL Editor log

Una vez validado, proceder a ejecutar `SEED_DATA.sql` para insertar los 4 roles.

---

**Validación completada:** 2026-08-07  
**Status:** ✅ LISTO PARA EJECUTAR

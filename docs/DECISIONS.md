# DECISIONS

Registro de decisiones arquitectónicas y de diseño tomadas durante la construcción de ClinicOS.

Cada decisión incluye:
- **Fecha**: Cuándo se tomó
- **Contexto**: Por qué era necesaria
- **Decisión**: Qué se decidió
- **Rationale**: Por qué esa opción sobre otras
- **Consecuencias**: Qué implica esta decisión
- **Estado**: Vigente, revertida, revisada

---

## D001: Matriz de permisos en JSONB + lógica en aplicación

**Fecha:** 2026-08-07  
**Estado:** Vigente

**Contexto:**
ClinicOS necesita un sistema de permisos flexible que permita diferentes roles con diferentes acciones en diferentes Áreas. El modelo 04-ROLES.md define una matriz: Rol × Área × Acciones.

**Decisión:**
Almacenar `areas_permitidas` como JSONB en tabla `roles`. La lógica de validación de permisos vive en la aplicación (frontend + backend), no en políticas RLS genéricas.

**Rationale:**
1. **Flexibilidad**: JSONB permite agregar áreas y acciones sin migración
2. **Legibilidad**: El esquema de permisos es visible y documentado
3. **Escalabilidad**: Preparado para evolucionar a permisos configurables en BD cuando sea necesario
4. **Desarrollo ágil**: No bloquea con RLS genéricas demasiado restrictivas

**Estructura:**
```json
{
  "facturas": {
    "ver": true,
    "crear": true,
    "editar": false,
    "aprobar": true,
    "archivar": false,
    "ambito": "todo"
  },
  "stock": {
    "ver": true,
    "crear": false,
    "ambito": "propio"
  }
}
```

**Consecuencias:**
- Cada Área debe validar permisos en su lógica
- Las políticas RLS son básicas (protegen tareas propias, usuarios activos)
- En Fase 3+ se agregarán RLS específicas por Área si es necesario

**Revisión prevista:** Cuando se construyan 3+ Áreas, evaluar si RLS de BD agregan valor real vs. complejidad.

---

## D002: Usuario sistema para auditoría (created_by)

**Fecha:** 2026-08-07  
**Estado:** Vigente

**Contexto:**
Todos los objetos necesitan registrar `created_by` (quién creó). Pero hay acciones automáticas (cambios de estado, tareas generadas) que no son de un usuario real.

**Decisión:**
Crear tabla `usuarios_sistema` con un usuario especial:
- UUID fijo: `00000000-0000-0000-0000-000000000000`
- Nombre: "Sistema"
- No puede hacer login
- Aparece en auditoría como creador de cambios automáticos

**Rationale:**
1. **Auditoría limpia**: Diferencia cambios humanos vs. automáticos
2. **Sin magic strings**: Valor fijo en lugar de 'system' o NULL
3. **Escalable**: Permite agregar más usuarios especiales (triggers, cron, etc.)

**Consecuencias:**
- Todas las funciones que insertan datos automáticos usan este UUID
- En queries de auditoría, filter `created_by != '00000000...'` para ver solo cambios humanos
- IMPORTANTE: Este usuario NO se muestra en listas de usuarios activos

**Alternativas rechazadas:**
- NULL en created_by: Quebraría auditoría (no sabemos si fue automático o error)
- 'system' string: Inconsistente con otros created_by que son UUID

---

## D003: Lectura pública de usuarios activos (provisional V1)

**Fecha:** 2026-08-07  
**Estado:** Vigente (provisional)

**Contexto:**
Las RLS iniciales decían "usuarios solo ven su propio perfil", pero eso impide:
- Mostrar "Asignado a Juan" en tareas
- Ver nombres de creadores en auditoría
- Listar usuarios en administración

**Decisión:**
Permitir lectura pública de `usuarios` con `activo = TRUE`. No hay restricción RLS en SELECT.

**Rationale:**
1. **Datos no sensibles**: Nombre y email no son datos clínicos
2. **No bloquea V1**: Necesitamos poder mostrar nombres en la interfaz
3. **Provisional**: Las restricciones definitivas dependerán de permisos por Área
4. **Simple**: Evita RLS genéricas que rompen desarrollo sin beneficio

**Evolucion:**
Cuando se construyan Áreas (Facturas, Stock, Leads), cada Área decidirá quién ve qué usuarios según su lógica. Por ejemplo:
- Área de Facturas: solo admin ve todos los usuarios; podólogo ve solo staff administrativo
- Área de Stock: todos ven todos (colaboración)

**Consecuencias:**
- No hay ocultación de usuarios en la BD (ocurrirá en aplicación)
- La validación de acceso es responsabilidad de cada Área
- UPDATE en usuarios solo permite el propietario (política RLS: `id = auth.uid()`)

**Riesgo:** Si se confía SOLO en RLS, datos de usuarios quedan expuestos. MITIGACION: Lógica de aplicación valida permisos antes de mostrar datos sensibles.

---

## D004: Campo centro_id en usuarios y tareas

**Fecha:** 2026-08-07  
**Estado:** Vigente

**Contexto:**
03-DATA_MODEL.md dice: "Mientras haya una sola sede, esta pertenencia es casi invisible, pero existe desde el principio para que el paso a multi-centro no obligue a rehacer nada."

Agregar centro_id después (en Fase 2+) sería costoso: migración, actualización de queries, cambio de constraints.

**Decisión:**
Incluir `centro_id UUID NOT NULL REFERENCES centros(id)` en:
- `usuarios` (cada usuario pertenece a una sede)
- `tareas` (cada tarea pertenece a una sede)

En Fase 1 habrá un único centro. En Fase 3+ se permitirá multi-centro sin migración.

**Rationale:**
1. **Costo de migración**: Mucho mayor después
2. **Preparado**: No complica Fase 1 (un solo centro)
3. **Escalable**: Cuando haya múltiples sedes, ya está listo

**Futuro:**
En Fase 3+, cuando se construyan Áreas, todas tendrán `centro_id` de forma similar. No hace falta especificar ahora cuáles; cada Área lo agregará cuando se implemente.

**Objetos que llevarán centro_id en futuras Áreas:**
- Facturas (operativa)
- Leads (operativa)
- Solicitudes de vacaciones (operativa)
- Documentos (operativa)
- Productos (maestro, puede compartirse pero típicamente por sede)
- Proveedores (maestro, puede compartirse pero típicamente por sede)

---

## D005: Relación auth.users ↔ usuarios

**Fecha:** 2026-08-07  
**Estado:** Vigente

**Contexto:**
Supabase Auth maneja credenciales en tabla `auth.users`. Nuestro modelo necesita perfiles de usuario en tabla `usuarios`.

**Decisión:**
- `usuarios.id` es Foreign Key a `auth.users.id`
- No duplicamos email ni contraseña: eso vive solo en `auth.users`
- Tabla `usuarios` es el perfil + identidad dentro de ClinicOS

**Rationale:**
1. **Single source of truth**: Credenciales en Auth, perfiles en BD
2. **Seguridad**: No guardamos passwords
3. **Standard pattern**: Supabase SSR helpers asumen esta relación

**Flujo:**
1. Usuario se autentica en Supabase Auth (`auth.users`)
2. Token JWT contiene `user.id` de Auth
3. Consultamos tabla `usuarios` con ese ID
4. Cargamos roles, centro, permisos

**Consecuencias:**
- Eliminar usuario de Auth no elimina su registro en `usuarios` (independencia)
- La tabla `usuarios` puede tener registros huérfanos (usuarios eliminados de Auth); usamos `archived_at` para marcarlos

---

## D006: RLS básicas (provisionales) vs. RLS por Área (futuro)

**Fecha:** 2026-08-07  
**Estado:** Vigente

**Contexto:**
¿Aplicamos RLS en la BD que validen roles y permisos, o dejamos eso en aplicación?

**Decisión:**
RLS básicas AHORA (protegen datos obvios: tareas propias, usuarios activos).
RLS específicas POR ÁREA DESPUÉS (cuando se construyan Áreas, cada una agregará sus propias políticas).

**Rationale:**
1. **No prematura**: Antes de construir Áreas, no sabemos qué restricciones necesitamos
2. **Fácil de agregar**: Las RLS de Áreas se pueden crear sin tocar la Shell
3. **Evita bloqueos**: RLS genéricas que cumplen la matriz de permisos serían complejas y difíciles de debuggear

**Ejemplos de RLS futura (Área de Facturas):**
```sql
CREATE POLICY "facturas_admin_ve_todas" ON facturas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_roles ur
      JOIN roles r ON ur.rol_id = r.id
      WHERE ur.usuario_id = auth.uid()
        AND r.nombre = 'Administrador del sistema'
    )
  );
```

**Evolución:**
- Fase 1-2: RLS Shell básicas
- Fase 3: RLS Área de Hoy (tareas)
- Fase 4+: RLS Áreas de Facturas, Stock, etc.

---

## D007: Tabla usuarios_sistema para cambios automáticos

**Fecha:** 2026-08-07  
**Estado:** Vigente

**Contexto:** (Ver D002)

**Decisión extra:** No hacer usuario system anónimo. Crear tabla explícita que documenta la intención.

**Beneficio:** Código futuro que vea `created_by = '00000000-0000-0000-0000-000000000000'` puede consultar `usuarios_sistema.nombre` y `usuarios_sistema.descripcion` para entender por qué.

**Trigger de inicialización:**
```sql
INSERT INTO usuarios_sistema (id, nombre, descripcion) VALUES
  ('00000000-0000-0000-0000-000000000000', 'Sistema', 'Usuario del sistema para cambios automáticos')
ON CONFLICT DO NOTHING;
```

---

## Revisión de decisiones

Estas decisiones serán revisadas cuando:
1. Se construya la primera Área real (habrá insights sobre permisos)
2. Se agreguen multi-centro (validar que centro_id sea suficiente)
3. Se necesite migrar RLS a BD (evaluar complejidad vs. beneficio)

Todos los cambios futuros se registrarán aquí con contexto y rationale.

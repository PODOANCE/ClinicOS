# Decisiones Arquitectónicas - ClinicOS

**Fecha**: 2026-08-30  
**Versión**: 2.0  
**Estado**: Fase 1 ✅ + Bloque A ✅ + Bloque B.2 ✅ + Bloque B.3 ✅

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

> ⚠️ **REVISADA (2026-08-09)**: Middleware fue eliminado deliberadamente en Fase 1 simplificada. Protección actualmente solo en cliente (UserContext redirige). Middleware se reintroducirá en Fase 2 si/cuando sea necesario.

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

> ⚠️ **REVISADA (2026-08-09)**: En Fase 1 simplificada, UserContext carga solo `{user: {id, email}, loading}`. Carga de roles, permisos y datos completos del usuario será en Fase 2 cuando sea necesario.

**Propósito**: Proporcionar datos de usuario al árbol de componentes.

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

> ⚠️ **REVISADA (2026-08-09)**: En Fase 1 simplificada, Navigation solo muestra Dashboard. Filtrado dinámico por permisos se implementará en Fase 2 cuando existan Áreas que lo requieran.

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

## Decisiones — Módulo Facturas (Google Drive + IA)

**Fecha**: 2026-08-11
**Estado**: Aprobadas por Product Owner, pendientes de implementación

### Decisión F1: Google Drive como repositorio documental de Facturas

**Contexto**: 05-ARCHITECTURE.md (sección 2) establece que los documentos se almacenan en Supabase Storage. El Área de Facturas necesita que los PDFs vivan en Google Drive, no en Supabase.

**Decisión**: Para el Área de Facturas, Google Drive es el repositorio principal de los PDFs originales. Supabase almacena únicamente metadatos, datos extraídos, estados, conciliaciones, incidencias y la referencia (`drive_file_id`) al documento en Drive. No se duplica el archivo en dos sistemas.

**Alcance**: Decisión específica del Área de Facturas. No cambia el comportamiento por defecto (Supabase Storage) para el resto de la plataforma, salvo que una futura Área lo justifique igual y se registre aquí.

Excepción reflejada en 05-ARCHITECTURE.md, sección 2.

### Decisión F2: Cuenta de Google Drive compartida (no Workspace)

**Decisión**: El repositorio vive en una cuenta de Google Drive normal (no Google Workspace), propiedad de PODOANCE SL, con acceso humano inicial para PODOANCE SL y Sara Gómez Velázquez (Álvaro Espada Bermejo, pendiente de confirmar).

**Mecanismo técnico**: ClinicOS accede vía una cuenta de servicio (Service Account) de Google Cloud, a la que se comparte la carpeta raíz `FACTURAS` con permiso de Editor desde la cuenta de PODOANCE SL. No se usa OAuth2 interactivo como mecanismo principal (ver informe de arquitectura para el análisis completo y la alternativa de respaldo si la cuota de la cuenta de servicio resultara un problema en la práctica).

### Decisión F3: Nuevos objetos del modelo de datos

**Decisión**: Se incorporan al modelo de datos común (03-DATA_MODEL.md):
- **Movimiento bancario** *(operativo)* — un pago/cobro real de la empresa a justificar.
- **Categoría de gasto** *(maestro, compartido)* — clasificación económica del gasto, compartida por Facturas y el futuro Panel 360.

La relación Factura ↔ Movimiento bancario es de muchos a muchos, mediada por el objeto Conciliación, propio del Área de Facturas.

Esta decisión formaliza lo que `FACTURAS-diseno-funcional.md` (secciones 0.1–0.3) ya daba por aprobado y que nunca llegó a registrarse. Referencia a la "decisión 047" citada en `FACTURAS-especificacion-funcional.md` y `FACTURAS-diseno-funcional.md`: no existe ningún registro numerado 047 en este documento ni en ningún otro del proyecto; se salda esa referencia pendiente con esta entrada.

Reflejado en 03-DATA_MODEL.md, secciones 2, 3 y 5.

### Decisión F4: La IA es núcleo de la v1 de Facturas

**Decisión**: La lectura, interpretación, clasificación y propuesta de conciliación por IA no es una mejora futura del Área de Facturas: es parte esencial de su v1. La IA nunca inventa datos ni conciliaciones; ante confianza insuficiente, genera una incidencia y no decide.

Formaliza la excepción ya aprobada en `FACTURAS-diseno-funcional.md`, sección 0.4.

### Decisión F5: Entrada automática por Drive + IA, desbloqueada para Facturas

**Contexto**: `BACKLOG.md` tenía aparcada la idea de "entrada automática de datos... facturas que llegan por email o Drive, lectura de PDF con IA" como mejora futura, para no comprometer la arquitectura de integraciones antes de tiempo.

**Decisión**: Se desbloquea específicamente para el Área de Facturas. El resto de Áreas sigue con entrada manual en su v1, salvo que se decida lo contrario caso por caso.

Reflejado en BACKLOG.md.

### Decisión F6: Significado de "Aprobar" en Facturas

**Decisión**: "Aprobar" en el Área de Facturas significa revisar/validar que la factura está correctamente tratada dentro del flujo interno y puede avanzar hacia gestoría. No implica autorizar, ejecutar o validar ningún pago o transferencia bancaria — ClinicOS no gestiona pagos.

### Decisión F7: Estructura de Google Drive y nomenclatura

**Decisión**: Estructura de carpetas:

```
FACTURAS/
├── ENTRADA/                                  (sin procesar)
├── SIN CLASIFICAR/                           (procesada pero sin datos suficientes)
└── {AÑO}/
    └── {MES en dos dígitos} - {Nombre mes}/
        ├── PENDIENTES DE ENVIAR A GESTORÍA/
        └── ENVIADAS A GESTORÍA/
```

Nomenclatura obligatoria: `PENDIENTES DE ENVIAR A GESTORÍA` y `ENVIADAS A GESTORÍA`. Prohibido usar "Subidas" o cualquier término que confunda "estar en Drive" con "enviada a gestoría".

### Decisión F8: Tres ejes de estado independientes

**Decisión**: Toda factura tiene tres estados independientes, que nunca se mezclan ni se infieren uno del otro:
- **Lectura**: pendiente de procesar / procesada / error de lectura.
- **Conciliación**: no conciliada / conciliada automática / pendiente de revisión / conciliada manual.
- **Gestoría**: pendiente de enviar a gestoría / enviada a gestoría.

La carpeta de Drive en la que vive el PDF refleja únicamente el eje de gestoría (y, transitoriamente, el de lectura mientras está en ENTRADA/SIN CLASIFICAR).

---

## Referencias

- **AUDIT_REPORT.md** - Hallazgos técnicos
- **BUILD_PLAN.md** - Plan de fases
- **RLS Documentation** - https://supabase.com/docs/guides/auth/row-level-security
- **docs/FACTURAS-especificacion-funcional.md**, **docs/FACTURAS-diseno-funcional.md**, **docs/FACTURAS-handoff-desarrollo.md** — documentación funcional del Área de Facturas

---

## Decisión 9: Bloque B.3 - IA Interpreta, Backend Valida (2026-08-30)

**Principio Fundamental**: La IA NO es autoridad final. Claude devuelve datos estructurados; nuestro código decide si son válidos.

**Flujo de Responsabilidades**:
```
PDF → Texto → Claude → JSON
         ↓
    LECTURA_EXITOSA (Claude respondió)
         ↓
    Backend: Validación determinista
         ↓
    ├─ Válido   → VALIDACION_EXITOSA ✓
    └─ Inválido → REVISION_MANUAL (requiere humano)
```

**Decisiones concretas**:

### 9.1 La IA NO escribe en Supabase
- ❌ Claude NO tiene acceso directo a BD
- ❌ Claude NO decide qué datos guardar
- ✅ Claude devuelve JSON estructurado
- ✅ Backend valida antes de guardar

### 9.2 Conservar respuesta JSON bruta de IA
- `facturas_extraccion_ia.respuesta_json` → JSON exacto de Claude
- `facturas_extraccion_ia.datos_validados` → JSON después de pasar reglas
- Permite auditoría, depuración y reentrenamiento

### 9.3 Validación matemática determinista
- Tolerancia: 0.01€ en suma (base + iva ≈ total)
- Importes no negativos
- Fechas coherentes (vencimiento ≥ emisión)
- Tipo IVA dentro de 0-100%
- No confiamos en la IA para matemáticas

### 9.4 Service Role solo en servidor
- ✅ `createAdminClient()` en `/api/facturas/procesar-lectura` (Next.js Route Handler)
- ❌ Nunca enviar service_role al cliente (React component)
- Protege RLS; automatización de servidor > sesión de usuario

### 9.5 PDFs se procesan en memoria
- ✅ Buffer en RAM durante extracción
- ❌ No guardamos PDF en disco (Supabase lo guarda en Drive)
- Seguridad: PDF nunca toca servidor

### 9.6 Detección de PDFs escaneados
- `pdf-parse` extrae texto → si < 100 caracteres → NULL
- NULL → flujo pasa a REVISION_MANUAL (requerirá OCR futuro)
- No forzamos procesamiento de escaneos sin capa de texto

### 9.7 Idempotencia por UNIQUE(factura_id)
- `facturas_extraccion_ia(factura_id UNIQUE)`
- Segunda ejecución → duplicate key
- ⚠️ TODO B.3.5: Devolver estado controlado en lugar de exponer error DB

---

## Decisión 10: Estados de Lectura Granulares (2026-08-30)

**Estados de `factura_estado_lectura` enum**:

```
PENDIENTE
   ↓
LECTURA_PENDIENTE (comienza procesamiento)
   ↓
LECTURA_EXITOSA (Claude devolvió JSON válido)
   ├─ ✓ → VALIDACION_EXITOSA (datos pasan reglas)
   └─ ✗ → REVISION_MANUAL (datos inconsistentes)

ERROR_LECTURA (fallo técnico: OAuth, API, PDF corrupto)
   → permite reintento automático
```

**Semántica**:
- `PENDIENTE`: Detectada en B.2, sin procesar aún
- `LECTURA_EXITOSA`: IA respondió; ahora valida backend
- `VALIDACION_EXITOSA`: Datos matemáticamente válidos, listos para B.4
- `REVISION_MANUAL`: IA respondió pero datos son inconsistentes (humano revisa)
- `ERROR_LECTURA`: Fallo técnico (reintentable, no terminal)

---

## Decisión 11: Tabla `facturas_extraccion_ia` (2026-08-30)

**Propósito**: Auditoría inmutable de lo que Claude extrajo de cada PDF.

**Estructura**:
```sql
CREATE TABLE facturas_extraccion_ia (
  id UUID PRIMARY KEY,
  factura_id UUID UNIQUE REFERENCES facturas(id),
  respuesta_json JSONB,        -- JSON bruto de Claude (auditoría)
  datos_validados JSONB,       -- JSON después pasar validación (NULL si error)
  errores_validacion TEXT[],   -- Array de mensajes si validación falla
  creado_en TIMESTAMP,
  actualizado_en TIMESTAMP
);
```

**Campos**:
- `respuesta_json`: Exacto output de Claude; **nunca modificar**
- `datos_validados`: Copia si pasa validación; NULL si no
- `errores_validacion`: {"campo": "...", "mensaje": "..."} si hay inconsistencias
- `factura_id UNIQUE`: Protege idempotencia; detecta reprocesamiento

---

## Decisión 12: Auditoría de Modificaciones Humanas (2026-08-30)

**Problema**: Sin registrar quién edita qué y cuándo, un auditor administrativo no puede reconstruir decisiones.

**Principio**: Toda modificación humana debe ser append-only, inmutable y trazable.

**Distinción de capas**:
```
estado_lectura       ← Describe SOLO extracción IA
(PENDIENTE, LECTURA_EXITOSA, VALIDACION_EXITOSA, REVISION_MANUAL, ERROR_LECTURA)

estado_revision      ← Describe SOLO supervisión humana (introducido en B.4.2)
(PENDIENTE_REVISION, APROBADA_MANUALMENTE, RECHAZADA)

estado_administrativo ← Para B.5 (conciliación, gestoría)
```

**Tabla `facturas_historial`** (Creada en B.4.2):
```sql
CREATE TABLE facturas_historial (
  id UUID PRIMARY KEY,
  factura_id UUID REFERENCES facturas(id),
  usuario_id UUID REFERENCES usuarios(id),
  accion VARCHAR,  -- CREADA, EDITADA, REPROCESADA, PROVEEDOR_CAMBIADO, APROBADA, RECHAZADA
  datos_anteriores JSONB,      -- Valores antes del cambio
  datos_nuevos JSONB,          -- Valores después del cambio
  creado_en TIMESTAMP NOT NULL
);
```

**Invariantes**:
- ✅ Append-only: nunca borrar, nunca actualizar histórico
- ✅ Usuario_id es obligatorio (quién)
- ✅ Acción explícita (qué)
- ✅ Timestamps creado_en inmodificables (cuándo)
- ✅ Registrar también reprocesamiento IA (no solo cambios manuales)
- ✅ El proveedor seleccionado manualmente queda auditado
- ✅ Las extracciones anteriores se conservan en `facturas_extraccion_ia`

**Ejemplo flujo B.4.2**:
```
1. Usuario abre factura en REVISION_MANUAL
2. Cambia base_imponible de 1000€ a 1050€
   → INSERT facturas_historial (usuario_id, accion='EDITADA', datos_anteriores={'base_imponible': 1000}, datos_nuevos={'base_imponible': 1050})
3. Usuario busca y asigna proveedor "Distribuciones ABC"
   → INSERT facturas_historial (usuario_id, accion='PROVEEDOR_CAMBIADO', datos_anteriores={proveedor_id: null}, datos_nuevos={proveedor_id: '...'})
4. Usuario aprueba factura
   → INSERT facturas_historial (usuario_id, accion='APROBADA_MANUALMENTE', datos_nuevos={estado_revision: 'APROBADA_MANUALMENTE'})
```

**Beneficio**:
Auditoría completa: "Claude dijo 1000€, pero Sara Gómez lo corrigió a 1050€ el 30/08/2026 10:23:45."

---

## Decisión 13: Revisión Selectiva y Flujos Bifurcados (2026-08-30)

**Problema**: No todas las facturas requieren aprobación humana explícita. Una factura con `VALIDACION_EXITOSA` está matemáticamente correcta; forzar aprobación humana es ineficiente.

**Solución**: Bifurcar en B.4.2 según estado_lectura.

**Estados y flujos**:

```
VALIDACION_EXITOSA (datos correctos, no hay inconsistencias)
    ↓
[Automático: sigue flujo sin intervención]
    ↓
B.5 (conciliación)

vs.

REVISION_MANUAL (IA respondió pero datos inconsistentes)
    ↓
PENDIENTE_REVISION
    ↓
Humano revisa/corrige en B.4.2
    ↓
APROBADA_MANUALMENTE | RECHAZADA
    ↓
B.5 (conciliación) o rechazo
```

**Invariantes**:
- ✅ Facturas en VALIDACION_EXITOSA **no pasan por PENDIENTE_REVISION** automáticamente
- ✅ Facturas en REVISION_MANUAL **sí deben pasar por PENDIENTE_REVISION** (requieren decisión humana)
- ✅ Una vez APROBADA_MANUALMENTE → **bloqueada contra edición normal**
  - Futuro: flujo explícito de "Reabrir" si es necesario modificar
- ✅ Nunca crear proveedores desde formulario de edición de factura
  - Solo autocomplete de `proveedores` existentes
  - Si necesita proveedor nuevo → gestión de proveedores separada

**Campos de auditoría**:
```
facturas_historial:
- factura_id (FK)
- usuario_id (FK)
- accion: EDITADA, PROVEEDOR_ASIGNADO, REPROCESADA, APROBADA, RECHAZADA
- campo_modificado: null para acciones sistémicas, else 'numero_factura', 'proveedor_id', etc.
- datos_anteriores: JSONB del estado antes
- datos_nuevos: JSONB del estado después
- creado_en: timestamp inmutable
```

**Protección en BD**:
```sql
CREATE TRIGGER bloquear_historial_update BEFORE UPDATE ON facturas_historial
  FOR EACH ROW RAISE EXCEPTION 'facturas_historial es append-only';

CREATE TRIGGER bloquear_historial_delete BEFORE DELETE ON facturas_historial
  FOR EACH ROW RAISE EXCEPTION 'facturas_historial es append-only';
```

**Diferencia clave**:
- `estado_lectura` = lo que Claude hizo (IA)
- `estado_revision` = lo que el humano decidió (administración)
- Nunca se mezclan conceptualmente

---


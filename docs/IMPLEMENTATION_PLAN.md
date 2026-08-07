# IMPLEMENTATION PLAN

**Plan de implementación técnica de ClinicOS — V1**

Documento basado en la lectura completa de la documentación oficial (00-VISION a 07-BUILD_PLAN). Define la arquitectura, el modelo de datos, los módulos y el orden de implementación para la V1 de la plataforma.

---

## 1. ARQUITECTURA FINAL PROPUESTA PARA V1

### 1.1 Visión Arquitectónica

La plataforma se organiza en **tres capas independientes** que se comunican a través de interfaces bien definidas:

```
┌─────────────────────────────────────────────────────────────┐
│                      INTERFAZ (UI)                          │
│        React + Next.js 16 (App Router)                      │
│   Componentes compartidos, patrones UX, sistema de diseño   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   LÓGICA Y DATOS                            │
│              Supabase (PostgreSQL + Auth)                   │
│     Objetos del modelo, permisos, autenticación, archivos   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    ALOJAMIENTO                              │
│                Vercel (despliegue automático)               │
└─────────────────────────────────────────────────────────────┘
```

**Principio fundamental:** Cada dato existe una sola vez en Supabase. La interfaz nunca almacena copias; siempre consulta y modifica la fuente única.

### 1.2 Stack Tecnológico Definitivo

**Frontend:**
- Next.js 16 (con TypeScript)
- React 19
- Tailwind CSS (utilidades de diseño)
- Sistema de componentes propio (construido en Fase 2)
- Conexión con Supabase via SDK de JavaScript

**Backend / Datos:**
- Supabase (PostgreSQL + Auth nativo)
- Row Level Security (RLS) para permisos a nivel de base de datos
- Funciones PostgreSQL para lógica compleja (si la necesidad lo justifica)
- Storage de Supabase para documentos

**DevOps:**
- Vercel (despliegue automático desde GitHub)
- GitHub como repositorio único
- ESLint + Prettier para código limpio

### 1.3 Estructura del Repositorio (Fase 0)

```
clinicos/
├── app/                          # Next.js App Router
│   ├── (shell)/                  # Layout común a toda la plataforma
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Página inicial/Hoy
│   │   └── [area]/              # Estructura dinámica para Áreas
│   └── auth/                    # Rutas de autenticación
├── components/
│   ├── shell/                   # Componentes de la shell común
│   │   ├── Navigation.tsx
│   │   ├── Header.tsx
│   │   └── PermissionGuard.tsx
│   ├── shared/                  # Componentes reutilizables (Fase 2)
│   │   ├── Table.tsx
│   │   ├── Form.tsx
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   └── States/              # Componentes de estado
│   └── areas/                   # Componentes específicos de Áreas
├── lib/
│   ├── supabase/                # Cliente de Supabase
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   └── queries.ts           # Funciones de consulta
│   ├── hooks/                   # Custom hooks compartidos
│   │   ├── useAuth.ts
│   │   ├── usePermissions.ts
│   │   └── useTasks.ts
│   ├── utils/                   # Funciones de utilidad
│   └── types/                   # Tipos TypeScript globales
├── types/
│   ├── database.ts              # Tipos generados de Supabase
│   ├── auth.ts
│   ├── models.ts                # Objetos del modelo de datos
│   └── permissions.ts
├── styles/
│   ├── globals.css              # Estilos globales (Tailwind)
│   └── design-system.css        # Variables del sistema de diseño
├── public/                      # Assets estáticos
├── docs/                        # Documentación del proyecto
├── .env.example                 # Variables de entorno de ejemplo
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── eslint.config.mjs
└── .prettierrc.json
```

### 1.4 El Flujo Único de una Acción

Toda acción en la plataforma sigue **siempre** este recorrido:

1. **Usuario actúa** en la interfaz (hace clic, rellena un formulario)
2. **Interfaz recoge la acción** y envía datos a la lógica
3. **Autenticación se verifica** (¿quién es?)
4. **Permisos se validan** (¿puede hacer esto?)
5. **Lógica de negocio** decide qué ocurre
6. **Base de datos se actualiza** (fuente única de verdad)
7. **Interfaz refleja el cambio** (el usuario ve el resultado)

**Nunca hay caminos alternativos.** Si dos acciones distintas logran el mismo resultado, es un defecto de arquitectura.

---

## 2. MODELO DE DATOS INICIAL

### 2.1 Principios que Gobiernan Todo el Modelo

1. **Un objeto existe una sola vez** — cada cosa importante (proveedor, factura, empleado) vive en un único lugar
2. **Usuario y Empleado son separados** — una persona puede ser ambos, uno, o ninguno
3. **El cargo no determina permisos** — cargo es atributo del Empleado; permisos los definen los Roles
4. **Nada se borra, se archiva** — todo tiene campo `archived_at`
5. **Todo objeto sabe quién lo creó y cuándo** — `created_by`, `created_at`, `updated_at`
6. **Frontera con Organízate es sagrada** — nada de datos clínicos

### 2.2 Objetos del Sistema (Base de Todo)

#### **Usuario** (maestro)
Identidad de acceso a la plataforma.

```sql
usuarios
├── id (UUID, PK)
├── email (TEXT, UNIQUE)
├── nombre (TEXT)
├── activo (BOOLEAN)
├── empleado_id (FK → empleados, nullable)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── roles (M:M → roles)
```

#### **Rol** (maestro)
Define qué Áreas ve y qué puede hacer.

```sql
roles
├── id (UUID, PK)
├── nombre (TEXT, UNIQUE)
├── areas_permitidas (JSONB)  # array de Área + acciones
├── es_admin (BOOLEAN)        # Administrador del sistema
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

**Roles iniciales (hardcoded):**
- `Administrador del sistema` — acceso total
- `Administración` — Facturas, Stock, Leads, Vacaciones, Dashboard
- `Podólogo` — Stock (ver/editar), Leads (ver/editar), Vacaciones (crear propias)
- `Ortopedia` — Stock (ver/editar), Leads (ver/editar), Vacaciones (crear propias)

#### **Tarea** (operativo)
Unidad de trabajo. El corazón del sistema.

```sql
tareas
├── id (UUID, PK)
├── usuario_id (FK → usuarios)
├── titulo (TEXT)
├── descripcion (TEXT, nullable)
├── estado (ENUM: abierta, hecha)
├── tipo_objeto (TEXT, nullable)    # Factura, Lead, etc.
├── objeto_id (UUID, nullable)      # ID del objeto
├── origen (ENUM: manual, area)
├── fecha_limite (DATE, nullable)
├── created_by (FK → usuarios)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── archived_at (TIMESTAMP, nullable)
```

### 2.3 Objetos de Negocio (Base de V1)

#### **Proveedor** (maestro)
Empresa o persona a quien se compra.

```sql
proveedores
├── id (UUID, PK)
├── nombre (TEXT)
├── cif_nif (TEXT)
├── email (TEXT, nullable)
├── telefono (TEXT, nullable)
├── direccion (TEXT, nullable)
├── notas (TEXT, nullable)
├── centro_id (FK → centros)
├── created_by (FK → usuarios)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── archived_at (TIMESTAMP, nullable)
```

#### **Producto** (maestro)
Artículo que se almacena o utiliza.

```sql
productos
├── id (UUID, PK)
├── nombre (TEXT)
├── codigo_referencia (TEXT, nullable)
├── unidad_medida (TEXT)
├── stock_actual (INTEGER)
├── stock_minimo (INTEGER)
├── centro_id (FK → centros)
├── created_by (FK → usuarios)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── archived_at (TIMESTAMP, nullable)
```

**Relación:** `producto_proveedores` (M:M)

#### **Factura** (operativo)
Documento de cobro recibido.

```sql
facturas
├── id (UUID, PK)
├── proveedor_id (FK → proveedores)
├── numero_factura (TEXT)
├── fecha_factura (DATE)
├── base_imponible (DECIMAL)
├── iva (DECIMAL)
├── total (DECIMAL)
├── estado (TEXT)              # Definido por Área de Facturas
├── notas (TEXT, nullable)
├── centro_id (FK → centros)
├── created_by (FK → usuarios)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── archived_at (TIMESTAMP, nullable)
```

#### **Empleado** (maestro)
Persona que trabaja en la clínica.

```sql
empleados
├── id (UUID, PK)
├── nombre_completo (TEXT)
├── cargo (TEXT)
├── email_personal (TEXT, nullable)
├── telefono (TEXT, nullable)
├── fecha_alta (DATE)
├── tipo_contrato (TEXT, nullable)
├── usuario_id (FK → usuarios, nullable)
├── centro_id (FK → centros)
├── created_by (FK → usuarios)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── archived_at (TIMESTAMP, nullable)
```

#### **Lead** (operativo)
Posible paciente que ha mostrado interés.

```sql
leads
├── id (UUID, PK)
├── nombre (TEXT)
├── email (TEXT, nullable)
├── telefono (TEXT, nullable)
├── origen (TEXT)
├── tratamiento_interes (TEXT)
├── estado (TEXT)              # nuevo, contactado, cualificado, convertido, descartado
├── notas (TEXT, nullable)
├── centro_id (FK → centros)
├── created_by (FK → usuarios)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── archived_at (TIMESTAMP, nullable)
```

#### **Solicitud de Vacaciones** (operativo)
Petición de ausencia de un empleado.

```sql
solicitudes_vacaciones
├── id (UUID, PK)
├── empleado_id (FK → empleados)
├── fecha_inicio (DATE)
├── fecha_fin (DATE)
├── tipo (TEXT)                # vacaciones, asuntos_propios, baja
├── estado (ENUM: pendiente, aprobada, rechazada)
├── motivo_notas (TEXT, nullable)
├── created_by (FK → usuarios)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── archived_at (TIMESTAMP, nullable)
```

#### **Documento** (operativo)
Archivo asociado a otro objeto.

```sql
documentos
├── id (UUID, PK)
├── nombre (TEXT)
├── tipo (TEXT)                # factura, contrato, justificante, etc.
├── ruta_archivo (TEXT)        # Path en Supabase Storage
├── tipo_objeto (TEXT)         # Factura, Empleado, Lead
├── objeto_id (UUID)           # ID del objeto
├── centro_id (FK → centros)
├── created_by (FK → usuarios)
├── created_at (TIMESTAMP)
└── archived_at (TIMESTAMP, nullable)
```

#### **Centro** (maestro, configuración)
Sede física de la clínica.

```sql
centros
├── id (UUID, PK)
├── nombre (TEXT)
├── direccion (TEXT)
├── telefono (TEXT, nullable)
├── email (TEXT, nullable)
├── created_by (FK → usuarios)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── archived_at (TIMESTAMP, nullable)
```

### 2.3 Relaciones Clave

```
Usuario ──M:M──> Rol
Usuario ──1:M──> Tarea
Usuario ──1:M──> [creaciones de objetos]

Empleado <──0:1──> Usuario
Empleado ──1:M──> Solicitud de Vacaciones
Empleado ──1:M──> Documentos

Proveedor ──1:M──> Factura
Proveedor <──M:M──> Producto

Producto ──M:M──> Proveedor
Producto ──[stock_minimo genera]──> Tarea

Factura ──1:M──> Documentos
Factura ──[cambio de estado]──> Tarea

Lead ──1:M──> Documentos
Lead ──[cambio de estado]──> Tarea

Solicitud de Vacaciones ──[cambio de estado]──> Tarea
Solicitud de Vacaciones ──1:M──> Documentos

Centro ──1:M──> [Todos los objetos de negocio]
```

---

## 3. MÓDULOS INCLUIDOS EN LA PRIMERA VERSIÓN (V1)

### 3.1 Módulo 1: AUTENTICACIÓN Y SHELL

**Objetivo:** Una persona puede entrar, ver solo lo que su rol permite, y navegar.

**Componentes:**
- ✅ Login (email + autenticación Supabase)
- ✅ Logout
- ✅ Persistencia de sesión
- ✅ Navegación lateral (solo Áreas permitidas)
- ✅ Cabecera con usuario y opciones
- ✅ Enrutado protegido (no accesible si no permisos)

**Archivos clave:**
- `lib/supabase/auth.ts`
- `components/shell/Navigation.tsx`
- `app/auth/login/page.tsx`
- `app/(shell)/layout.tsx`
- Middleware de autenticación en Next.js

### 3.2 Módulo 2: USUARIO Y PERMISOS

**Objetivo:** El sistema de roles funciona y controla quién ve qué.

**Componentes:**
- ✅ Objeto Usuario con roles
- ✅ Objeto Rol con matriz de permisos
- ✅ Ocultación total (lo prohibido no se ve ni se accede)
- ✅ Evaluación de permisos en cada acción

**Archivos clave:**
- `lib/hooks/usePermissions.ts`
- `components/shell/PermissionGuard.tsx`
- `lib/supabase/queries.ts` (funciones de permisos)
- Políticas RLS en Supabase

### 3.3 Módulo 3: SISTEMA DE DISEÑO Y COMPONENTES BASE

**Objetivo:** Existen componentes reutilizables que todas las Áreas usarán.

**Componentes:**
- ✅ Tabla (con ordenar, filtrar, paginar, abrir detalle)
- ✅ Formulario (una columna, etiqueta encima, errores)
- ✅ Botón (primario con Banana, secundarios neutrales)
- ✅ Modal
- ✅ Estados: vacío, cargando, éxito, error
- ✅ Paleta de colores + tipografía + espaciado

**Archivos clave:**
- `components/shared/Table.tsx`
- `components/shared/Form.tsx`
- `components/shared/Button.tsx`
- `components/shared/Modal.tsx`
- `components/shared/States/`
- `styles/design-system.css` (variables de diseño)
- `tailwind.config.ts` (integración del sistema)

### 3.4 Módulo 4: VISTA "HOY"

**Objetivo:** La persona ve sus tareas abiertas en un lugar central.

**Componentes:**
- ✅ Lista de tareas del usuario actual
- ✅ Ordenadas por urgencia (plazo, tipo)
- ✅ Cada tarea como fila clickeable
- ✅ Marca de "hecha"
- ✅ Estado vacío cuando no hay trabajo

**Archivos clave:**
- `app/(shell)/(today)/page.tsx`
- `components/shared/TaskList.tsx`
- `lib/hooks/useTasks.ts`

### 3.5 Módulo 5: PRIMERA ÁREA (A DEFINIR DESPUÉS)

**Nota:** La primera Área se construirá después de decidir cuál es la más apropiada (tras análisis de flujo de trabajo). Las Áreas candidatas son:
- Facturas (clara, bien definida, genera mucho trabajo)
- Stock (control de existencias, tareas)
- Leads (captación, seguimiento)
- Vacaciones (solicitudes, aprobaciones)

Cada Área seguirá esta estructura:
- ✅ Lista de objetos (usando componente Table compartido)
- ✅ Detalle de un objeto (ver detalles, editar)
- ✅ Crear nuevo objeto (usando componente Form compartido)
- ✅ Acciones (editar, archivar, aprobar según permisos)
- ✅ Generar tareas cuando corresponda
- ✅ Conexión con objetos relacionados

---

## 4. ORDEN DE IMPLEMENTACIÓN RECOMENDADO

### FASE 0: PREPARACIÓN (COMPLETADA ✅)

**Estado:** Ya realizado
- ✅ Repositorio en GitHub (`PODOANCE/ClinicOS`)
- ✅ Next.js 16 + TypeScript configurado
- ✅ Tailwind CSS integrado
- ✅ ESLint + Prettier listos
- ✅ Estructura de carpetas base
- ✅ Documentación preparada

**Siguiente:** Fase 1

---

### FASE 1: SHELL (1-2 SEMANAS)

**Duración estimada:** 5-10 sesiones de desarrollo

**Pasos en orden:**

1. **Configurar Supabase** (1 sesión)
   - [ ] Crear cliente de Supabase en `lib/supabase/client.ts`
   - [ ] Conectar Supabase Auth con Next.js
   - [ ] Crear tablas base en Supabase (usuarios, roles, relaciones)
   - [ ] Verificar conexión end-to-end

2. **Autenticación** (2 sesiones)
   - [ ] Pantalla de login (email + contraseña)
   - [ ] Pantalla de recuperación de contraseña (opcional pero recomendado)
   - [ ] Middleware de autenticación en Next.js
   - [ ] Persistencia de sesión
   - [ ] Logout y limpieza

3. **Usuarios y Roles** (2 sesiones)
   - [ ] Objeto Usuario con campos base
   - [ ] Objeto Rol con matriz de permisos
   - [ ] Crear roles iniciales (hardcoded o seed)
   - [ ] Asignar usuario de prueba a cada rol

4. **Permisos** (1-2 sesiones)
   - [ ] Hook `usePermissions()` que evalúa roles
   - [ ] Componente `PermissionGuard` que oculta elementos
   - [ ] Políticas RLS en Supabase (Row Level Security)
   - [ ] Pruebas de ocultación total

5. **Shell Visual y Navegación** (2 sesiones)
   - [ ] Layout común (`app/(shell)/layout.tsx`)
   - [ ] Componente Navigation (barra lateral)
   - [ ] Componente Header (cabecera con usuario)
   - [ ] Enrutado dinámico por Áreas
   - [ ] Protección de rutas según permisos

**Criterios de terminado:**
- [ ] Login/logout funcionan
- [ ] Usuario ve solo Áreas de su rol
- [ ] Lo prohibido es invisible e inaccesible
- [ ] La navegación es estable
- [ ] Se puede navegar entre Áreas (vacías)

---

### FASE 2: SISTEMA DE DISEÑO Y COMPONENTES BASE (1-2 SEMANAS)

**Duración estimada:** 5-8 sesiones

**Pasos en orden:**

1. **Fundamentos Visuales** (1 sesión)
   - [ ] Configurar Tailwind con paleta de colores (#F3C577 Banana, grises, etc.)
   - [ ] Tipografía base (usar serif/sans que esté disponible por ahora)
   - [ ] Sistema de espaciado (múltiplos de 4px)
   - [ ] Variables CSS en `design-system.css`

2. **Componente Table** (2 sesiones)
   - [ ] Estructura básica (encabezados, filas)
   - [ ] Ordenar por columna
   - [ ] Buscar y filtrar
   - [ ] Paginación
   - [ ] Abrir detalle
   - [ ] Acciones de fila

3. **Componente Form** (1-2 sesiones)
   - [ ] Layout una columna
   - [ ] Etiqueta encima del campo
   - [ ] Validación y errores junto al campo
   - [ ] Botones Guardar/Cancelar
   - [ ] Prevenir pérdida de datos

4. **Componente Button** (1 sesión)
   - [ ] Botón primario (Banana)
   - [ ] Botones secundarios (texto, contorno)
   - [ ] Estados (normal, hover, active, deshabilitado)

5. **Componentes de Estado** (1 sesión)
   - [ ] Estado vacío (invitación a crear)
   - [ ] Estado cargando (skeletons)
   - [ ] Estado éxito (mensaje discreto)
   - [ ] Estado error (mensaje claro, no pierde trabajo)

6. **Componentes adicionales** (1 sesión)
   - [ ] Modal
   - [ ] Confirmación
   - [ ] Toast/notificación

**Criterios de terminado:**
- [ ] Catálogo de componentes existe en `components/shared/`
- [ ] Todos los componentes respetan el sistema de diseño
- [ ] Se pueden reutilizar sin modificación
- [ ] Storybook opcional pero recomendado para visualizar

---

### FASE 3: VISTA "HOY" (1 SEMANA)

**Duración estimada:** 3-4 sesiones

**Pasos:**

1. **Crear objeto Tarea en BD** (1 sesión)
   - [ ] Tabla `tareas` en Supabase
   - [ ] Campos necesarios (usuario, título, estado, objeto, origen)
   - [ ] Políticas RLS

2. **Hook useTasks()** (1 sesión)
   - [ ] Obtener tareas del usuario actual
   - [ ] Filtrar por estado (abiertas)
   - [ ] Ordenar por fecha límite

3. **Pantalla Hoy** (1-2 sesiones)
   - [ ] Layout: título + saludo + lista de tareas
   - [ ] Cada tarea como fila clickeable
   - [ ] Botón para marcar como hecha
   - [ ] Estado vacío cuando no hay tareas
   - [ ] Ordenación por lo urgente primero

**Criterios de terminado:**
- [ ] Usuario ve sus tareas abiertas
- [ ] Puede marcar como hecha
- [ ] Estado vacío es amigable
- [ ] Refleja cambios en tiempo cercano

---

### FASE 3B: PRIMERA ÁREA (2-3 SEMANAS)

**Duración estimada:** 10-15 sesiones

**A DECIDIR:** Cuál es la Área prioritaria (tras análisis de flujo de trabajo real)

**Pasos genéricos (cualquier Área):**

1. **Preparar datos en Supabase** (1-2 sesiones)
   - [ ] Crear tablas de objetos necesarios
   - [ ] Relaciones y claves foráneas
   - [ ] Políticas RLS por rol
   - [ ] Datos de prueba

2. **Definir permisos** (1 sesión)
   - [ ] Qué roles ven el Área
   - [ ] Qué acciones permite cada rol
   - [ ] Actualizar matriz de permisos en roles

3. **Estructura visual (5 zonas)** (2-3 sesiones)
   - [ ] Contexto (título, ruta)
   - [ ] Acciones principales (botón crear)
   - [ ] Filtros y búsqueda
   - [ ] Contenido principal (tabla de objetos)
   - [ ] Acciones secundarias (editar, archivar)

4. **Lógica propia del Área** (2-3 sesiones)
   - [ ] Crear/editar/archivar objetos
   - [ ] Cambios de estado
   - [ ] Validaciones de negocio
   - [ ] Generación de tareas (lo más importante)

5. **Conexión con Hoy** (1-2 sesiones)
   - [ ] Definir qué hechos del Área generan tareas
   - [ ] Crear tareas con usuario correcto
   - [ ] Verificar que aparecen en Hoy
   - [ ] Que al resolver el trabajo, la tarea se cierre automáticamente

6. **Pruebas y validación** (1-2 sesiones)
   - [ ] Casos de uso reales
   - [ ] Permisos funcionan
   - [ ] Tareas se generan correctamente
   - [ ] Flujo de punta a punta

**Criterios de terminado:**
- [ ] El Área funciona de punta a punta
- [ ] Las tareas que genera llegan a Hoy
- [ ] No contiene componentes duplicados
- [ ] La segunda Área requeriría menos esfuerzo

---

## 5. DEPENDENCIAS TÉCNICAS NECESARIAS

### 5.1 Dependencias ya Instaladas ✅

```json
{
  "react": "19.x",
  "react-dom": "19.x",
  "next": "16.x",
  "typescript": "latest",
  "tailwindcss": "latest",
  "postcss": "latest",
  "autoprefixer": "latest",
  "eslint": "latest",
  "prettier": "latest"
}
```

### 5.2 Dependencias a Agregar (NECESARIAS)

```bash
npm install @supabase/supabase-js
npm install @supabase/auth-helpers-nextjs
npm install @supabase/auth-helpers-react
npm install --save-dev @types/node @types/react
```

**Por qué cada una:**
- `@supabase/supabase-js` → Cliente de Supabase
- `@supabase/auth-helpers-nextjs` → Integración autenticación con Next.js
- `@supabase/auth-helpers-react` → Hooks de autenticación

### 5.3 Dependencias Opcionales (DESPUÉS)

Estas se agregan cuando se justifique en desarrollo real:
- `react-hook-form` — si los formularios crecen
- `zod` o `yup` — validación de esquemas
- `date-fns` — manejo de fechas
- `framer-motion` — animaciones (si se necesitan)
- `zustand` o `jotai` — estado global (si se necesita)

**Política:** No instalar librerías por anticipación. Cada una se añade cuando el código la necesita de verdad.

### 5.4 Configuración de Supabase Necesaria

Antes de empezar Fase 1:

1. **Proyecto Supabase creado** (ya debería estar)
2. **Variables de entorno configuradas:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=<url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
   ```
3. **Auth configurado** (Magic Link o Email/Contraseña)
4. **Tablas base creadas** (usuarios, roles, relaciones)

---

## 6. RIESGOS Y DECISIONES PENDIENTES

### 6.1 Riesgos Identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|-----------|
| **Desincronización entre Supabase y UI** | Media | Alto | RLS correcto, una única fuente de verdad, evitar estado local innecesario |
| **Permisos mal configurados permiten acceso no autorizado** | Baja | Crítico | Políticas RLS en Supabase + validación en UI, pruebas de ocultación |
| **Primera Área requiere rehacimiento de shell/componentes** | Baja | Alto | Seguir BUILD PLAN, validar contrato de Área antes de implementar |
| **Cambios en modelo de datos durante Fase 1-2** | Media | Medio | Documentación como fuente, decisiones en DECISIONS.md antes de codificar |
| **Rendimiento con muchas tareas** | Baja | Medio | Paginación desde el inicio, índices en Supabase |
| **Storage de documentos sin límites** | Baja | Medio | Definir límites en Supabase Storage, validar tamaños |

### 6.2 Decisiones Pendientes Antes de Comenzar

**DECIDIR Y REGISTRAR EN DECISIONS.md:**

1. ✅ **¿Qué rol de Usuario de prueba usar para desarrollo?**
   - Recomendación: Usuario con todos los roles para testing
   - Alternativa: Crear usuarios por rol

2. ✅ **¿Tipografía NOW BLACK disponible ahora?**
   - Si no: usar serif estándar temporal (sustituible después)
   - La decisión no debe bloquear Fase 2

3. ⚠️ **¿Cuál es la primera Área?**
   - **BLOQUEANTE:** Requiere análisis de flujo de trabajo real
   - Análisis debe ocurrir después de Fase 2
   - Criterios: máximo valor, mínima complejidad, genera mucho trabajo

4. ⚠️ **¿Cómo se generan usuarios iniciales?**
   - Opción A: Admin crea usuarios en UI (requiere Área de Ajustes)
   - Opción B: Seed script que crea usuarios automáticos
   - Recomendación: Opción B para desarrollo, Opción A para producción

5. ⚠️ **¿Storage de documentos en Supabase o alternativa?**
   - Supabase Storage incluido en plan estándar
   - Decisión: usar Supabase Storage, validar tamaño máximo

6. ⚠️ **¿Notificaciones en tiempo real (WebSockets)?**
   - Supabase soporta realtime subscriptions
   - Decisión: implementar en Fase 3 si tiempo, sino en Fase 4
   - Impacto: actualizar Hoy cuando aparecen tareas

### 6.3 Restricciones y Límites Conocidos

1. **Monolito modular, no microservicios** — una sola aplicación Next.js
2. **No se construye entrada automática de datos (Fase 1-3)** — todo manual de inicio
3. **No multi-centro todavía** — modelo preparado, pero no se implementa
4. **Frontera con Organízate es fija** — cero datos clínicos en esta plataforma
5. **Una sola persona + IA puede mantenerlo** — guía toda decisión técnica

---

## 7. RESUMEN EJECUTIVO

### Versión 1 Entregará

✅ **Autenticación** — Login, logout, sesión persistente
✅ **Permisos** — Ocultación total según rol, un mecanismo único
✅ **Vista Hoy** — Centro operativo con tareas del usuario
✅ **Sistema de Diseño** — Componentes compartidos reutilizables
✅ **Una Área Completa** — Funcionando de punta a punta con generación de tareas

### Arquitectura Garantiza

✅ Una sola fuente de verdad (Supabase)
✅ Shell común que todas las Áreas heredan
✅ Componentes que se reutilizan sin duplicación
✅ Flujo único para toda acción
✅ Mantenibilidad a largo plazo por una persona + IA

### Próximas Fases

**Fase 4:** Segunda y tercera Áreas (validarán el molde)
**Fase 5:** Sistema de diseño completo, animaciones, refinamiento UX
**Fase 6:** Entrada automática de datos, integraciones, IA
**Fase 7:** Escalado a más Áreas según necesidad

---

**Documento cerrado.** Lista para desarrollo.

*IMPLEMENTATION_PLAN.md — v1.0*

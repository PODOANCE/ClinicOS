# Supabase Setup Guide

Guía para configurar Supabase Auth y la base de datos de ClinicOS.

## 1. Configuración Inicial en Supabase

### 1.1 Crear Proyecto

1. Ve a [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Copia `Project URL` y `Anon Key` (proyecto → settings → API)
4. Pega en `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<tu_url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu_key>
   ```

### 1.2 Configurar Auth

1. Ve a `Authentication` → `Providers` en Supabase
2. Habilita `Email` con:
   - ✅ Email confirmation OFF (para desarrollo)
   - ✅ Double confirm OFF
   - Password: requiere longitud mínima 6

3. Ve a `Authentication` → `URL Configuration`
4. Agrega `Authorized redirect URLs`:
   - `http://localhost:3000/**` (desarrollo)
   - `https://tu-dominio.vercel.app/**` (producción)

## 2. Crear Esquema de Base de Datos

### 2.1 Ejecutar Migraciones de Schema

1. Ve a Supabase → `SQL Editor`
2. Abre archivo `docs/DATABASE_SCHEMA.sql` desde este proyecto
3. Lee COMPLETAMENTE el archivo (contiene comentarios importantes sobre RLS)
4. Copia TODO el contenido SQL (excluyendo comentarios de guía si lo prefieres)
5. Pega en `SQL Editor` de Supabase
6. Haz clic en "Run"

**Verificación:**
- ✅ Se crearon 5 tablas: `usuarios_sistema`, `centros`, `roles`, `usuarios`, `usuarios_roles`, `tareas`
- ✅ Se crearon índices (idx_*) para performance
- ✅ Se habilitaron políticas RLS (Row Level Security)
- ✅ No hay errores en el log

**Importante:** Las políticas RLS están DOCUMENTADAS en el archivo. Son PROVISIONALES en V1.
Ver `docs/DECISIONS.md` → D003 y D006 para entender por qué.

### 2.2 Insertar Roles y Centro Iniciales

1. Ve a `SQL Editor` nuevamente
2. Abre archivo `docs/SEED_DATA.sql` desde este proyecto
3. Copia TODO el contenido (hasta la línea que dice "PASO 3")
4. Pega en `SQL Editor`
5. Haz clic en "Run"

**Verificación:**
- ✅ Se creó 1 centro: "Podología y Biomecánica Rivas" (UUID: `12345678-1234-5678-1234-567812345678`)
- ✅ Se crearon 4 roles: Administrador del sistema, Administración, Podólogo, Ortopedia
- ✅ No hay errores

**IMPORTANTE:** Estos UUIDs de centro y usuario sistema son FIJOS en Fase 1. Ver `docs/DECISIONS.md` → D002 y D004.

## 3. Crear Usuarios de Prueba

Los usuarios DEBEN crearse en Supabase Auth primero, luego insertarse en la tabla `usuarios`.

### 3.1 Crear Usuario en Auth

1. Ve a `Authentication` → `Users` en Supabase
2. Haz clic en `Add user`
3. Ingresa:
   - Email: `admin@clinicos.local`
   - Password: `TuPassword123!` (guarda en lugar seguro)
4. Copia el `User ID` (UUID)

### 3.2 Insertar en tabla usuarios

1. Ve a `SQL Editor` en Supabase
2. Ejecuta (reemplaza {UUID} con el UUID del usuario):

```sql
INSERT INTO usuarios (id, email, nombre, activo, created_by) VALUES
('{UUID}', 'admin@clinicos.local', 'Administrador', TRUE, 'system');

INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES
('{UUID}', (SELECT id FROM roles WHERE nombre = 'Administrador del sistema'));
```

### 3.3 Crear más usuarios de prueba

Repite el proceso para crear usuarios con diferentes roles:

```sql
-- Staff Administrativo
INSERT INTO usuarios (id, email, nombre, activo, created_by) VALUES
('{UUID_ADMIN_STAFF}', 'staff@clinicos.local', 'Staff Administrativo', TRUE, 'system');

INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES
('{UUID_ADMIN_STAFF}', (SELECT id FROM roles WHERE nombre = 'Administración'));

-- Podólogo
INSERT INTO usuarios (id, email, nombre, activo, created_by) VALUES
('{UUID_PODO}', 'podo@clinicos.local', 'Podólogo Test', TRUE, 'system');

INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES
('{UUID_PODO}', (SELECT id FROM roles WHERE nombre = 'Podólogo'));

-- Ortopedia
INSERT INTO usuarios (id, email, nombre, activo, created_by) VALUES
('{UUID_ORTHO}', 'ortho@clinicos.local', 'Ortopedia Test', TRUE, 'system');

INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES
('{UUID_ORTHO}', (SELECT id FROM roles WHERE nombre = 'Ortopedia'));
```

## 4. Instalar Dependencias en Next.js

```bash
npm install @supabase/supabase-js @supabase/ssr
```

## 5. Verificar Conexión

1. Ejecuta el dev server:
   ```bash
   npm run dev
   ```

2. Intenta hacer login con: `admin@clinicos.local` / `TuPassword123!`

3. Verifica que no haya errores en consola

## Troubleshooting

### Error: "NEXT_PUBLIC_SUPABASE_URL is not defined"
- ✅ Verifica que `.env.local` existe y tiene las variables correctas
- ✅ Reinicia el dev server después de cambiar `.env.local`

### Error: "relation 'usuarios' does not exist"
- ✅ Verifica que ejecutaste `DATABASE_SCHEMA.sql` en Supabase SQL Editor
- ✅ Verifica que no hay errores en la ejecución

### Error: "user not found" al hacer login
- ✅ Verifica que el usuario existe en `Authentication → Users`
- ✅ Verifica que también existe en tabla `usuarios`

### Error de CORS
- ✅ Verifica `Authorized redirect URLs` en `Authentication → URL Configuration`
- ✅ Asegúrate de incluir `http://localhost:3000/**` para desarrollo

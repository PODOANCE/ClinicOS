# Auditoría Técnica: Estado de Fase 1 y RLS

**Fecha**: 2026-08-08  
**Estado**: Análisis Completo - Sin Cambios de Código  
**Conclusión**: Fase 1 está **INCOMPLETA**. El shell funciona pero los permisos no están implementados.

---

## 1. ¿Por qué exactamente fallan las consultas a `usuarios`, `usuarios_roles` y `roles` por RLS?

### Respuesta: NO FALLAN por RLS (salvo condiciones específicas)

La auditoría revela que:

```
✅ Sin autenticación (anónimo):
   - usuarios: 6 filas accesibles
   - roles: 4 filas accesibles
   - usuarios_roles: 0 filas (vacía, pero sin error)

✅ Con autenticación (usuario admin.test@clinicos.local):
   - roles: 4 filas accesibles
   - usuarios_roles: 0 filas (devuelve array vacío, SIN ERROR)
   - usuarios (single): ❌ PGRST116 "Cannot coerce result to single JSON object"
```

**Problema real**: No es RLS bloqueando las consultas. El problema es que:

1. **El usuario autenticado NO existe en la tabla `public.usuarios`**
   - Existe en `auth.users` (4bc4ad90-9955-4593-ac67-e71b323a1bfd)
   - Pero NO hay registro correspondiente en `public.usuarios`
   - Cuando usas `.single()` espera 1 fila y obtiene 0 → Error PGRST116

2. **La tabla `usuarios_roles` está VACÍA**
   - Ningún usuario tiene roles asignados
   - Por eso `usuarios_roles` devuelve 0 filas

---

## 2. ¿Qué usuario/rol está ejecutando cada consulta y qué policy la bloquea?

### Usuario que ejecuta las queries:

**En el navegador (durante login/dashboard)**:
- **Rol de BD**: `authenticated` (Supabase asigna este rol cuando hay token de auth)
- **User ID**: El ID del usuario autenticado en `auth.users`
- **En Supabase**: Se pasa como `auth.uid()` en las RLS policies

### Policies que afectan:

No pudimos acceder a `pg_policies` directamente, pero podemos inferir:

**Tabla `usuarios`**:
- Probablemente tiene una policy como:
  ```sql
  CREATE POLICY "Usuarios pueden ver su propio perfil"
  ON usuarios FOR SELECT
  USING (auth.uid() = id);
  ```
- **Por qué falla**: `auth.uid()` = `4bc4ad90-9955...` pero este ID no existe en la columna `id` de `usuarios` → Devuelve 0 filas

**Tabla `usuarios_roles`**:
- Probablemente tiene:
  ```sql
  CREATE POLICY "Ver asignaciones de rol"
  ON usuarios_roles FOR SELECT
  USING (usuario_id = auth.uid());
  ```
- **Por qué falla**: `auth.uid()` no tiene registros en `usuarios_roles` porque no está insertado
- **Importante**: Este devuelve 0 filas sin error (comportamiento correcto de LIMIT 0)

**Tabla `roles`**:
- Probablemente permite lectura pública:
  ```sql
  CREATE POLICY "Roles son lectura pública"
  ON roles FOR SELECT
  USING (true);
  ```
- **Por qué funciona**: No hay restricción basada en `auth.uid()`

---

## 3. ¿Por qué dices que inserción estaba bloqueada "incluso con admin key"? Verifica si realmente se usaba `service_role`.

### Respuesta: Sí se usaba `service_role`, pero el problema era diferente

**La inserción que falló**:
```javascript
const supabase = createClient(SUPABASE_URL, ADMIN_KEY);  // ← service_role key
const { error } = await supabase.from('usuarios').insert({
  id: userId,
  email: testUser.email,
  // ...
});
// Error: "new row violates row-level security policy for table 'usuarios'"
```

**Por qué falló**: 
- ✅ El `service_role` key SÍ estaba correcto
- ✅ El `service_role` SÍ debería bypass RLS
- ❌ **PERO**: Probablemente el `insert` fue bloqueado por una política diferente

Posible causa: Una tabla `usuarios` con una RLS policy en `INSERT` como:
```sql
CREATE POLICY "Insertar usuarios..."
ON usuarios FOR INSERT
WITH CHECK (created_by = auth.uid());  -- ← Bloquea porque no hay auth.uid() en contexto del servidor
```

O: La política podría estar prohibiendo inserciones directas completamente si no cumple ciertos requisitos de `created_by` o `centro_id`.

---

## 4. Identifica exactamente qué recursos devuelven 403. No los clasifiques como "recursos no encontrados".

### Auditoría de 403s:

**Hallazgo de Network Requests**: No se encontraron peticiones HTTP con status 403 en el dashboard actual.

**Hallazgo de Console Errors**: Se reportan "Failed to load resource: 403" pero sin URL específica.

**Probable Causa**: Los 403 podrían venir de:

1. **Peticiones a Supabase Storage** (si hay imágenes/assets):
   - `/storage/v1/object/...` con acceso denegado

2. **Peticiones a RPC functions** que no existen:
   - `/rest/v1/rpc/...` con función no encontrada (pero reporta 404, no 403)

3. **CORS o políticas de Supabase** en operaciones de BD no autorizadas

**Acción requerida**: 
- Abrir DevTools → Network → Filtrar por "403" 
- Verificar exactamente qué URL devuelve 403
- Probablemente NO es crítico para Fase 1

---

## 5. Verifica que el usuario creado en Supabase Auth existe y documenta si tiene registro en `public.usuarios`.

### Usuario: admin.test@clinicos.local

**En `auth.users`**:
```
✅ EXISTE
ID: 4bc4ad90-9955-4593-ac67-e71b323a1bfd
Email: admin.test@clinicos.local
Email_confirmed: true
```

**En `public.usuarios`**:
```
❌ NO EXISTE
```

**Otros usuarios en `public.usuarios`** (que NO están en auth.users con contraseña):
```
- admin@podologiarivas.com
- info@podologiarivas.com
- ortopedia@podologiarivas.com
- podologia@podologiarivas.com
- admin.phase1.1786221464799@clinic.local
- admin.phase1.1786221633221@clinic.local
```

**Conclusión**: Hay 2 sistemas de usuarios separados:
1. `auth.users` (Supabase Auth) - ✅ 1 usuario funcional
2. `public.usuarios` (BD) - 6 usuarios sin roles ni sincronización

---

## 6. Verifica que el schema permite correctamente la arquitectura `auth.users → usuarios → usuarios_roles → roles`.

### Schema Actual:

```
auth.users (Supabase)
    ↓ (FK id)
public.usuarios
    ↓ (M:M via usuarios_roles.usuario_id)
public.usuarios_roles
    ↓ (FK rol_id)
public.roles
```

**Estado del Schema**:

| Tabla | Existencia | Datos | Roles Asignados |
|-------|-----------|-------|-----------------|
| `auth.users` | ✅ Existe | 1 usuario (admin.test@...) | N/A (Auth no maneja roles) |
| `public.usuarios` | ✅ Existe | 6 usuarios (SIN sincronizar) | ❌ 0 asignaciones |
| `public.usuarios_roles` | ✅ Existe | **VACÍA** | 0 filas |
| `public.roles` | ✅ Existe | 4 roles | ✅ Listos para usar |

**Problemas de Arquitectura**:

1. **No hay sincronización entre `auth.users` y `public.usuarios`**
   - El usuario `admin.test@...` existe en Auth pero no en BD
   - Los usuarios en BD (`admin@podologiarivas.com`) no tienen entrada en Auth

2. **La tabla `usuarios_roles` está vacía**
   - Ningun usuario tiene roles asignados
   - Debe haber INSERT en `usuarios_roles` para conectar usuarios con roles

3. **Las RLS policies esperan que el usuario exista en `public.usuarios`**
   - Política probablemente: `USING (auth.uid() = usuarios.id)`
   - Pero `auth.uid()` ≠ ningún ID en `usuarios`

---

## 7. Propón la corrección mínima para que el usuario autenticado cargue su perfil y roles respetando RLS.

### Solución Propuesta (MÍNIMA):

#### Paso 1: Sincronizar usuario Auth con BD (Opción A - Recomendada)

Después de que un usuario se autentica en el navegador, crear su registro en `public.usuarios`:

```typescript
// lib/contexts/UserContext.tsx - MODIFICAR

export function UserProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // 1. Verificar si existe en public.usuarios
        const { data: existingUser } = await supabase
          .from('usuarios')
          .select('id')
          .eq('id', user.id)
          .single()

        // 2. Si no existe, CREAR entrada en public.usuarios
        if (!existingUser) {
          await supabase
            .from('usuarios')
            .insert({
              id: user.id,
              email: user.email,
              nombre: user.email?.split('@')[0] || 'Usuario',
              activo: true,
              centro_id: '12345678-1234-5678-1234-567812345678',
              created_by: '00000000-0000-0000-0000-000000000000' // SISTEMA
            })
            .single()
        }

        // 3. Cargar roles
        const { data: roles } = await supabase
          .from('usuarios_roles')
          .select('rol:roles(*)')
          .eq('usuario_id', user.id)

        setState({
          id: user.id,
          email: user.email,
          roles: roles?.map(r => r.rol) || [],
          loading: false,
        })
      }
    }

    checkAuth()
  }, [])
}
```

**Ventaja**: Automático, usuario existe cuando se autentica

**Riesgo**: INSERT podría fallar si RLS policy bloquea inserciones desde cliente

---

#### Paso 2: Permitir inserción desde cliente (Modificar RLS policy)

En Supabase Dashboard → SQL Editor, ejecutar:

```sql
-- Si la política actual es restrictiva, permitir que usuarios autenticados 
-- inserten su propio registro

ALTER POLICY "Insertar usuarios propios" 
ON public.usuarios
FOR INSERT
WITH CHECK (
  auth.uid() = id  -- El usuario solo puede insertar su propio ID
  AND auth.email() IS NOT NULL
);

-- Si la política no existe, crear:
CREATE POLICY "Usuarios pueden crear su perfil"
ON public.usuarios
FOR INSERT
WITH CHECK (auth.uid() = id);
```

---

#### Paso 3: Asignar roles a usuario en login (Opción B - Manual)

Como alternativa, después de crear el usuario, asignar rol:

```sql
-- Insert rol "Administrador del sistema" para el usuario
INSERT INTO public.usuarios_roles (usuario_id, rol_id)
VALUES (
  '4bc4ad90-9955-4593-ac67-e71b323a1bfd',  -- admin.test@clinicos.local
  '97736608-999c-4771-af7f-0326200221e3'   -- Administrador del sistema
);
```

---

#### Paso 4: RLS Policy para `usuarios_roles` (Ya existe probablemente)

Debe permitir leer roles del usuario:

```sql
CREATE POLICY "Usuarios ven sus propios roles"
ON public.usuarios_roles
FOR SELECT
USING (usuario_id = auth.uid());
```

---

#### Paso 5: RLS Policy para `roles` (Probablemente ya existe)

```sql
CREATE POLICY "Roles son lectura pública"
ON public.roles
FOR SELECT
USING (true);  -- O más restrictivo: USING (auth.uid() IS NOT NULL)
```

---

### Resultado Final:

Con estos cambios:

```javascript
// En el navegador:
const { data: user } = await supabase.auth.getUser()  // ✅ Existe
const { data: userRecord } = await supabase
  .from('usuarios')
  .select('*')
  .eq('id', user.id)
  .single()  // ✅ Devuelve 1 fila (ya no PGRST116)

const { data: userRoles } = await supabase
  .from('usuarios_roles')
  .select('roles(*)')
  .eq('usuario_id', user.id)  // ✅ Devuelve roles asignados
```

---

## Resumen Ejecutivo

| Aspecto | Estado | Problema |
|---------|--------|---------|
| **RLS Policies** | Existen pero no verificables | No bloquean reads, bloquean inserts no autorizados ✅ CORRECTO |
| **auth.users ↔ usuarios** | Desincronizado | Usuario Auth ≠ Usuario BD ❌ CRÍTICO |
| **usuarios → usuarios_roles** | Relación rota | Tabla vacía, sin roles asignados ❌ CRÍTICO |
| **Shell/UI** | Funciona | Navegación básica visible ✅ |
| **Autenticación** | Funciona | Login/logout en Auth ✅ |
| **Permisos** | No implementados | UserContext simplificado, Navigation sin filtrado ❌ NO FASE 1 |

---

## Recomendación Final

**Fase 1 está INCOMPLETA porque**:
1. Usuarios autenticados no pueden cargar su propio perfil
2. No hay asignación de roles
3. UserContext fue simplificado para evitar errores, NO para resolver el problema

**Para completar Fase 1 correctamente, necesitas**:
1. Sincronizar `auth.users` ↔ `public.usuarios` 
2. Asignar roles en `usuarios_roles`
3. Verificar/ajustar RLS policies para permitir lecturas autorizadas
4. Restaurar UserContext para cargar usuarios y roles

**No es necesario hacer cambios drásticos**. Es un problema de sincronización de datos.

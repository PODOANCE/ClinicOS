# 🚀 Ejecutar Migración B.4.2

## Paso 1: Ir a Supabase SQL Editor

1. Abre https://supabase.com
2. Ve a tu proyecto ClinicOS
3. Abre **SQL Editor**

## Paso 2: Copiar y ejecutar la migración

1. Abre el archivo: `supabase/migrations/20260830_bloque_b42_edicion_auditoria.sql`
2. Copia **TODO el contenido**
3. En Supabase SQL Editor, **pégalo en una nueva query**
4. Haz click en **Run** (o Cmd+Enter)

**ESPERA a que termine sin errores.**

## Paso 3: Verificar la migración

Después de ejecutar, copia y ejecuta CADA una de estas queries para verificar:

### ✅ Verificar ENUM `estado_revision`

```sql
SELECT enum_range(NULL::estado_revision) AS valores;
```

**Debe mostrar**: `{PENDIENTE_REVISION,APROBADA_MANUALMENTE,RECHAZADA}`

---

### ✅ Verificar columnas en `facturas`

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'facturas'
AND column_name IN ('estado_revision', 'revisado_por', 'revisado_en')
ORDER BY ordinal_position;
```

**Debe mostrar**: 3 filas (estado_revision, revisado_por, revisado_en)

---

### ✅ Verificar tabla `facturas_historial`

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'facturas_historial'
ORDER BY ordinal_position;
```

**Debe mostrar**: id, factura_id, usuario_id, accion, campo_modificado, datos_anteriores, datos_nuevos, creado_en

---

### ✅ Verificar índices en `facturas_historial`

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'facturas_historial'
ORDER BY indexname;
```

**Debe mostrar**: idx_historial_factura, idx_historial_usuario, idx_historial_accion, idx_historial_creado, idx_historial_factura_creado

---

### ✅ Verificar triggers

```sql
SELECT trigger_name, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'facturas_historial'
ORDER BY trigger_name;
```

**Debe mostrar**: 2 triggers (tg_historial_bloquear_update, tg_historial_bloquear_delete)

---

### ✅ Verificar RLS está habilitado

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'facturas_historial';
```

**Debe mostrar**: `facturas_historial | t` (true = RLS habilitado)

---

### ✅ Verificar RLS policies

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'facturas_historial'
ORDER BY policyname;
```

**Debe mostrar**: 4 policies (historial_select_propio_o_admin, historial_insert_propio_usuario, historial_update_bloqueado, historial_delete_bloqueado)

---

### ✅ Verificar REVOKE en la función

```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'facturas_historial'
AND grantee IN ('anon', 'authenticated', 'public');
```

**Debe estar VACÍO** (anon y authenticated no deben tener permisos en historial)

---

### ✅ Verificar que FK impide DELETE

Intenta eliminar una factura que tenga historial:

```sql
-- Primero, verifica que existe historial
SELECT COUNT(*) as num_registros FROM facturas_historial LIMIT 1;

-- Si hay registros, obtén factura_id
SELECT DISTINCT factura_id FROM facturas_historial LIMIT 1;

-- Intenta borrar esa factura (DEBE FALLAR con FK error)
DELETE FROM facturas WHERE id = '<factura_id>';
-- Resultado esperado: ERROR: update or delete on table "facturas" violates foreign key constraint
```

---

### ✅ Verificar que historial es INSERT-only

```sql
-- Intenta UPDATE en historial (DEBE FALLAR)
UPDATE facturas_historial SET accion = 'OTRO' WHERE id IS NOT NULL LIMIT 1;
-- Resultado esperado: ERROR: facturas_historial es append-only: no UPDATE ni DELETE

-- Intenta DELETE en historial (DEBE FALLAR)
DELETE FROM facturas_historial WHERE id IS NOT NULL LIMIT 1;
-- Resultado esperado: ERROR: facturas_historial es append-only: no UPDATE ni DELETE
```

---

## ✅ Resultado final

Si todas las verificaciones **pasan**, la migración está **LISTA**.

### Estado esperado:

```
Enum estado_revision     ✅
Columnas en facturas     ✅
Tabla facturas_historial ✅
Índices                  ✅
Triggers UPDATE/DELETE   ✅
RLS habilitado           ✅
4 RLS policies           ✅
REVOKE anon/authenticated ✅
FK impide DELETE         ✅
Historial INSERT-only    ✅
```

**Cuando confirmes que TODO está ✅, ponte en contacto.**

No implementes endpoints ni frontend aún.

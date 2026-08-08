# Fase 1 - Estado Actual y Plan de Corrección

**Fecha**: 2026-08-08  
**Estado**: EN PROGRESO - Bloqueador RLS  
**Prioridad**: Alta - Necesita resolución para cerrar Fase 1

---

## ✅ Logros Completados

### Arquitectura & Documentación
- ✅ DECISIONS.md: Arquitectura completa documentada
- ✅ AUDIT_REPORT.md: Diagnóstico técnico detallado
- ✅ BUILD_PLAN.md: Plan de construcción actualizado
- ✅ SCHEMA_PHASE1_FIXES.sql: Script SQL de correcciones

### Código Implementado
- ✅ UserContext: Restaurado para cargar usuarios, roles, permisos
- ✅ getEffectivePermissions(): Combina permisos de múltiples roles (OR lógico)
- ✅ Navigation.tsx: Filtra áreas según permisos reales
- ✅ Dashboard.tsx: Muestra perfil, roles, áreas accesibles
- ✅ Middleware.ts: Protege rutas con autenticación básica

### Configuración BD
- ✅ Función SQL: sync_auth_user_to_usuarios() creada
- ✅ Usuario de prueba: admin.test@clinicos.local creado en BD
- ✅ Rol asignado: admin.test tiene rol "Administrador del sistema"
- ✅ Usuarios verificados: 6 usuarios existentes + admin.test

---

## ❌ Bloqueador: RLS Query Failure

### Síntoma
```
UserContext → query usuarios donde id = auth.uid()
Error: PGRST116 - Cannot coerce result to single JSON object
Detalles: The result contains 0 rows
```

### Causa Investigada
1. ✅ Usuario SÍ existe en public.usuarios (verificado)
2. ✅ Usuario SÍ tiene rol asignado (verificado)
3. ❓ RLS policy "read_own_profile" devuelve 0 filas
4. ❓ Probablemente RLS no está habilitado en tabla usuarios
5. ❓ O la condición `auth.uid() = id` no se evalúa correctamente

### Qué se ejecutó
```sql
-- Policy creada:
CREATE POLICY "read_own_profile"
ON public.usuarios FOR SELECT
USING (auth.uid() = id);

-- Pero query devuelve 0 filas:
SELECT * FROM usuarios 
WHERE id = '4bc4ad90-9955-4593-ac67-e71b323a1bfd'
```

---

## 🔧 Plan de Corrección

### Paso 1: Verificar RLS Habilitado en Tablas

**Acción**: En Supabase Dashboard → Table Editor
- [ ] Seleccionar tabla `usuarios`
- [ ] Verificar que "Row Level Security" está **HABILITADO** (toggle verde)
- [ ] Repetir para `usuarios_roles` y `roles`

**Si NO está habilitado**:
```sql
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
```

### Paso 2: Verificar Policies Creadas

**Acción**: En SQL Editor, ejecutar:
```sql
SELECT 
  tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('usuarios', 'usuarios_roles', 'roles')
ORDER BY tablename;
```

**Resultado esperado**: 3 policies listadas
- usuarios: read_own_profile
- usuarios_roles: read_own_roles
- roles: read_all_roles

**Si faltan**: Recrearlas manualmente desde schema-phase1-fixes.sql

### Paso 3: Test de Query Directa

**Acción**: En SQL Editor, conectarse como usuario autenticado y ejecutar:
```sql
-- Como admin.test@clinicos.local (user_id = 4bc4ad90...)
SELECT id, email, nombre FROM public.usuarios;

-- Debería devolver 1 fila (solo el usuario autenticado)
```

### Paso 4: Debugging de Policy Conditions

Si Paso 3 devuelve 0 filas:

**Alternativa A - Policy más permisiva** (para debug):
```sql
DROP POLICY "read_own_profile" ON public.usuarios;
CREATE POLICY "read_own_profile_debug"
ON public.usuarios FOR SELECT
USING (true);  -- Permite todos los usuarios

-- Si esto funciona: el problema es auth.uid()
-- Si esto NO funciona: el problema es RLS general
```

**Alternativa B - Verificar auth.uid()**:
```sql
SELECT auth.uid();  -- ¿Devuelve un UUID?
SELECT session_user;  -- ¿Devuelve algún valor?
```

---

## 🧪 Test Cases Requeridos para Cerrar Fase 1

Después de resolver el bloqueador RLS, ejecutar estos tests:

### Test 1: Usuario con Administrador del sistema
**Usuario**: admin.test@clinicos.local (o podologia@podologiarivas.com con rol Podólogo)

**Validaciones**:
- [ ] Login exitoso
- [ ] UserContext carga usuario
- [ ] UserContext carga roles
- [ ] Dashboard muestra "Roles Asignados"
- [ ] Navigation muestra al menos "Dashboard" y "Hoy"
- [ ] Permisos se cargaron correctamente

### Test 2: Usuario sin roles
**Crear usuario de prueba**: 
```sql
INSERT INTO auth.users (email, password) 
VALUES ('norol@test.local', 'Test123!');

INSERT INTO public.usuarios (id, email, nombre, activo)
VALUES (user_id, 'norol@test.local', 'Sin Rol', true);
-- Sin insertar en usuarios_roles
```

**Validaciones**:
- [ ] Login exitoso
- [ ] UserContext carga usuario
- [ ] UserContext.roles es array vacío
- [ ] Dashboard muestra "Sin permisos"
- [ ] Navigation muestra solo "Dashboard" (sin otras áreas)
- [ ] UserContext.permisos es object vacío

### Test 3: Usuario con múltiples roles
**Usuario**: Crear con 2 roles

```sql
-- Usuario ya existe: admin@podologiarivas.com (1 rol Administración)
-- Insertar rol adicional (ejemplo):
INSERT INTO public.usuarios_roles (usuario_id, rol_id)
VALUES (
  (SELECT id FROM usuarios WHERE email = 'admin@podologiarivas.com'),
  (SELECT id FROM roles WHERE nombre = 'Podólogo')
);
```

**Validaciones**:
- [ ] UserContext carga 2 roles
- [ ] Dashboard muestra ambos roles
- [ ] getEffectivePermissions() combina permisos (OR)
- [ ] Si rol1 permite "Facturas.ver" y rol2 permite "Stock.ver"
  - [ ] Navigation muestra ambas áreas

### Test 4: Acceso a ruta no autorizada
**Caso**: Usuario sin permiso en área intenta acceso directo

**Validaciones**:
- [ ] GET /areas/facturas sin permiso → middleware rechaza o componente oculta
- [ ] Idealmente: middleware devuelve 403 (no implementado en turno actual)
- [ ] Al mínimo: componente oculta el link y Navigation no lo muestra

---

## 📋 Próximos Pasos Inmediatos

### Esta sesión (Usuario)

1. **Diagnóstico RLS** (30 min):
   - [ ] Verificar que RLS está habilitado en tablas
   - [ ] Verificar policies están creadas
   - [ ] Ejecutar test SQL directo
   - [ ] Documentar hallazgos

2. **Corrección** (30-60 min):
   - [ ] Habilitar RLS si es necesario
   - [ ] Recrear policies si es necesario
   - [ ] Verificar auth.uid() se evalúa correctamente
   - [ ] Hacer logout/login para refrescar sesión

3. **Tests** (60 min):
   - [ ] Ejecutar Test 1 (usuario con rol)
   - [ ] Ejecutar Test 2 (usuario sin rol)
   - [ ] Ejecutar Test 3 (múltiples roles)
   - [ ] Ejecutar Test 4 (ruta no autorizada)

### Si todo funciona
- [ ] Hacer commit: "Fase 1 - Cerrado: auth, permisos, navegación"
- [ ] Actualizar BUILD_PLAN.md: Fase 1 → ✅ COMPLETADA
- [ ] Iniciar Fase 2: Módulos de negocio

### Si problemas persisten
- [ ] Escalada: Problema es más profundo (Supabase config, auth tokens, etc)
- [ ] Alternativa: Simplificar Fase 1 para no cargar desde BD (solo auth)

---

## 🎯 Definición de "Fase 1 Completa"

Fase 1 se cierra cuando:

1. ✅ Usuario autenticado puede loguear
2. ✅ UserContext carga usuario desde public.usuarios
3. ✅ UserContext carga roles del usuario
4. ✅ UserContext calcula permisos efectivos
5. ✅ Navigation filtra áreas según permisos
6. ✅ Dashboard muestra perfil y roles
7. ✅ Los 4 test cases pasan sin errores
8. ✅ Código sin errores en consola (excepto 404 de assets)

---

## 📚 Referencia de Archivos

| Archivo | Propósito | Estado |
|---------|-----------|--------|
| DECISIONS.md | Arquitectura | ✅ Documentado |
| AUDIT_REPORT.md | Diagnóstico BD | ✅ Completo |
| schema-phase1-fixes.sql | SQL corrections | ✅ Ejecutado |
| UserContext.tsx | Session + roles | ✅ Restaurado |
| Navigation.tsx | Permission filtering | ✅ Implementado |
| Dashboard.tsx | User info display | ✅ Implementado |
| middleware.ts | Route protection | ✅ Básico |

---

## 💡 Notas

- No usar `service_role` en cliente nunca
- RLS es la capa de seguridad: debe funcionar correctamente
- Si RLS falla, toda la arquitectura de permisos falla
- Los datos de prueba están en limpio (admin.test.* y usuarios reales sincronizados)


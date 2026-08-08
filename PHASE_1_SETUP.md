# Fase 1 · Shell - Setup de Usuarios de Prueba

## Estado Actual

La **Fase 1 (Shell)** está implementada y funcional:
- ✅ Autenticación (login/logout)
- ✅ Middleware de protección de rutas
- ✅ Layout con navegación
- ✅ User Context para estado compartido
- ✅ RLS en base de datos

## Crear Usuarios de Prueba

Supabase tiene rate limit de email. Si el script de setup falla, crea manualmente:

### Opción 1: Manual en Supabase (Recomendado)

1. Ve a **Supabase Dashboard** → tu proyecto → **Authentication** → **Users**
2. Click en **Add user** (arriba a la derecha)
3. Ingresa:
   - Email: `admin@clinic.test`
   - Password: `AdminClinic123!`
   - Confirm password: `AdminClinic123!`
4. Click **Create user**
5. Copia el **User ID** (UUID de 36 caracteres)
6. Ve a **SQL Editor** y ejecuta:

```sql
INSERT INTO usuarios (id, email, nombre, activo, centro_id, created_by) VALUES
('{PASTE_USER_ID_HERE}', 'admin@clinic.test', 'Administrador', TRUE, '12345678-1234-5678-1234-567812345678', '00000000-0000-0000-0000-000000000000');

INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES
('{PASTE_USER_ID_HERE}', (SELECT id FROM roles WHERE nombre = 'Administrador del sistema'));
```

Repite para los otros usuarios (staff, podo, ortho) con sus respectivos roles.

### Opción 2: Script Automático (Cuando Supabase Rate Limit se levante)

```bash
node setup-users.js
```

## Credenciales de Prueba

```
Admin:       admin@clinic.test / AdminClinic123!
Staff:       staff@clinic.test / StaffClinic123!
Podólogo:    podo@clinic.test / PodoClinic123!
Ortopedia:   ortho@clinic.test / OrthoClinic123!
```

## Verificar que Funciona

1. Inicia el servidor:
   ```bash
   npm run dev
   ```

2. Ve a `http://localhost:3000`

3. Debería redirigir a `/login`

4. Ingresa email/password de un usuario creado

5. Si funciona, verás:
   - Header con email + botón Salir
   - Sidebar con navegación (Dashboard, Hoy)
   - Contenido del dashboard

## Troubleshooting

**Error 403/406 en login:**
- Verifica que el usuario exista en `Authentication → Users`
- Verifica que el usuario exista en tabla `usuarios` (SQL)
- Verifica que tenga un rol asignado en `usuarios_roles`

**"No se puede acceder" en localhost:3000:**
- Verifica que `npm run dev` esté ejecutando
- Verifica que no haya errores en la consola del navegador (F12)

**Rate limit de Supabase:**
- Espera 1 hora o contacta a Supabase support
- Alterna con otros emails: `test1@example.com`, `test2@example.com`, etc.

---

**Fase 1 está lista para la Fase 2 (Sistema de Diseño).**

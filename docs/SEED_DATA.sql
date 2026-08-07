-- ClinicOS Seed Data
-- Ejecutar DESPUÉS de DATABASE_SCHEMA.sql (Fase 1)
--
-- ORDEN:
-- 1. Crear centro por defecto
-- 2. Crear los 4 roles iniciales
-- 3. (Manual) Crear usuarios en Supabase Auth
-- 4. (Manual) Insertar usuarios en tabla usuarios
-- 5. (Manual) Asignar roles a usuarios

-- ============================================================================
-- PASO 1: Centro por defecto
-- ============================================================================

INSERT INTO centros (id, nombre, direccion, activo, created_by) VALUES
(
  '12345678-1234-5678-1234-567812345678', -- UUID fijo para Fase 1 (un solo centro)
  'Podología y Biomecánica Rivas',
  'Calle Principal 123, Ciudad',
  TRUE,
  '00000000-0000-0000-0000-000000000000' -- Usuario sistema
);

-- ============================================================================
-- PASO 2: Insertar roles iniciales (según 04-ROLES.md)
-- ============================================================================
INSERT INTO roles (nombre, areas_permitidas) VALUES
(
  'Administrador del sistema',
  '{
    "Hoy": {"ver": true, "ambito": "todo"},
    "Facturas": {"ver": true, "crear": true, "editar": true, "aprobar": true, "archivar": true},
    "Stock": {"ver": true, "crear": true, "editar": true, "aprobar": true, "archivar": true},
    "Leads": {"ver": true, "crear": true, "editar": true, "aprobar": true, "archivar": true},
    "Vacaciones": {"ver": true, "crear": true, "editar": true, "aprobar": true, "archivar": true},
    "Dashboard": {"ver": true},
    "Ajustes": {"ver": true, "crear": true, "editar": true}
  }'
),
(
  'Administración',
  '{
    "Hoy": {"ver": true, "ambito": "propio"},
    "Facturas": {"ver": true, "crear": true, "editar": true, "aprobar": true},
    "Stock": {"ver": true, "crear": true, "editar": true},
    "Leads": {"ver": true, "crear": true, "editar": true},
    "Vacaciones": {"ver": true, "crear": true, "editar": true, "ambito": "propio"},
    "Dashboard": {"ver": true}
  }'
),
(
  'Podólogo',
  '{
    "Hoy": {"ver": true, "ambito": "propio"},
    "Stock": {"ver": true, "crear": true, "editar": true},
    "Leads": {"ver": true, "crear": true, "editar": true},
    "Vacaciones": {"ver": true, "crear": true, "ambito": "propio"}
  }'
),
(
  'Ortopedia',
  '{
    "Hoy": {"ver": true, "ambito": "propio"},
    "Stock": {"ver": true, "crear": true, "editar": true},
    "Leads": {"ver": true, "crear": true, "editar": true},
    "Vacaciones": {"ver": true, "crear": true, "ambito": "propio"}
  }'
);

-- ============================================================================
-- PASO 3: Crear usuarios en Supabase Auth (MANUAL - UI de Supabase)
-- ============================================================================
--
-- Ve a Supabase → Authentication → Users → Add user
-- Crea 4 usuarios:
--
-- 1. admin@clinicos.local / Password123! (Administrador del sistema)
-- 2. staff@clinicos.local / Password123! (Administración)
-- 3. podo@clinicos.local / Password123! (Podólogo)
-- 4. ortho@clinicos.local / Password123! (Ortopedia)
--
-- Copia el UUID de cada usuario de auth.users

-- ============================================================================
-- PASO 4: Insertar usuarios en tabla usuarios (reemplaza {UUID} con UUIDs reales)
-- ============================================================================
--
-- INSERT INTO usuarios (id, email, nombre, activo, centro_id, created_by) VALUES
-- ('{UUID_ADMIN}', 'admin@clinicos.local', 'Administrador', TRUE,
--   '12345678-1234-5678-1234-567812345678',
--   '00000000-0000-0000-0000-000000000000'),
-- ('{UUID_ADMIN_STAFF}', 'staff@clinicos.local', 'Staff Administrativo', TRUE,
--   '12345678-1234-5678-1234-567812345678',
--   '00000000-0000-0000-0000-000000000000'),
-- ('{UUID_PODOLOGIST}', 'podo@clinicos.local', 'Podólogo Test', TRUE,
--   '12345678-1234-5678-1234-567812345678',
--   '00000000-0000-0000-0000-000000000000'),
-- ('{UUID_ORTHO}', 'ortho@clinicos.local', 'Ortopedia Test', TRUE,
--   '12345678-1234-5678-1234-567812345678',
--   '00000000-0000-0000-0000-000000000000');

-- ============================================================================
-- PASO 5: Asignar roles a usuarios
-- ============================================================================
--
-- INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES
-- ('{UUID_ADMIN}', (SELECT id FROM roles WHERE nombre = 'Administrador del sistema')),
-- ('{UUID_ADMIN_STAFF}', (SELECT id FROM roles WHERE nombre = 'Administración')),
-- ('{UUID_PODOLOGIST}', (SELECT id FROM roles WHERE nombre = 'Podólogo')),
-- ('{UUID_ORTHO}', (SELECT id FROM roles WHERE nombre = 'Ortopedia'));

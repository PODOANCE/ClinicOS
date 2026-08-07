-- ClinicOS Seed Data
-- Ejecutar DESPUÉS de DATABASE_SCHEMA.sql
-- Nota: Los usuarios deben crearse primero en Supabase Auth antes de insertar aquí

-- Insertar roles iniciales (según 04-ROLES.md)
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

-- Nota: Los usuarios deben insertarse con el ID del usuario de Supabase Auth
-- Ejemplo (reemplazar {UUID} con el UUID real de auth.users):
--
-- INSERT INTO usuarios (id, email, nombre, activo, created_by) VALUES
-- ('{UUID_ADMIN}', 'admin@clinicos.local', 'Administrador', TRUE, 'system'),
-- ('{UUID_ADMIN_STAFF}', 'staff@clinicos.local', 'Staff Administrativo', TRUE, 'system'),
-- ('{UUID_PODOLOGIST}', 'podo@clinicos.local', 'Podólogo', TRUE, 'system'),
-- ('{UUID_ORTHO}', 'ortho@clinicos.local', 'Ortopedia', TRUE, 'system');
--
-- INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES
-- ('{UUID_ADMIN}', (SELECT id FROM roles WHERE nombre = 'Administrador del sistema')),
-- ('{UUID_ADMIN_STAFF}', (SELECT id FROM roles WHERE nombre = 'Administración')),
-- ('{UUID_PODOLOGIST}', (SELECT id FROM roles WHERE nombre = 'Podólogo')),
-- ('{UUID_ORTHO}', (SELECT id FROM roles WHERE nombre = 'Ortopedia'));

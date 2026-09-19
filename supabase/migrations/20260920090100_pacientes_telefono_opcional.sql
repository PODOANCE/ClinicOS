-- Ahora se pueden guardar pacientes solo por su edad (sin teléfono usable
-- en el listado), así que teléfono deja de ser obligatorio.
ALTER TABLE public.pacientes_telefono ALTER COLUMN telefono DROP NOT NULL;

-- Vacaciones: solo Administrador del sistema (Andrés y Celia) puede crear o
-- editar periodos/festivos/días anuales. El resto de roles solo visualiza.
-- Administración tenía editar:true por error (permitía a Álvaro/Sara editar).
UPDATE public.roles
SET areas_permitidas = jsonb_set(areas_permitidas, '{Vacaciones}', '{"ver": true}'::jsonb)
WHERE nombre = 'Administración';

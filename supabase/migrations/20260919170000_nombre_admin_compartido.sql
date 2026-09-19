-- admin@podologiarivas.com es una cuenta compartida (la usan Andrés y
-- Celia, que no tienen login propio); su "nombre" tenía el nombre legal de
-- la empresa (PODOANCE SL), lo que hacía el saludo del Dashboard impersonal.
UPDATE public.usuarios SET nombre = 'Andrés y Celia' WHERE email = 'admin@podologiarivas.com';

-- La tabla nació solo para teléfonos (Recordatorios), pero el mismo
-- listado de pacientes de Organízate trae la edad — útil en Seguimiento
-- para los pacientes cuyo "Tipo" (Infantil/Adulto) no se puede deducir de
-- las revisiones.
ALTER TABLE public.pacientes_telefono ADD COLUMN edad SMALLINT;

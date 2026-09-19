-- Seguimiento: la cita futura marcada a mano necesita una fecha real (no
-- solo un booleano), para poder mostrarla y editarla si la cita se mueve.
ALTER TABLE public.seguimiento_gestion ADD COLUMN cita_futura_fecha DATE;

COMMENT ON COLUMN public.seguimiento_gestion.cita_futura_fecha IS
  'Fecha de la cita futura marcada a mano. Si cita_futura_manual es true, esta fecha debería estar rellena (no forzado por constraint, por si se migran filas antiguas).';

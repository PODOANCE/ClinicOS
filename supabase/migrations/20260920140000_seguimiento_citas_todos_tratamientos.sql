-- El export de citas de Organízate que ya se sube para Seguimiento trae
-- TODOS los tratamientos de cada paciente (Quiropodia, Papiloma, Cura...),
-- no solo biomecánica. Hasta ahora se descartaban al importar; a partir de
-- ahora se guardan todos (para poder calcular el gasto total por paciente),
-- marcando con es_seguimiento cuáles son biomecánica/plantillas/revisión —
-- lo único que debe seguir alimentando el panel de Seguimiento.
--
-- Las filas ya importadas son todas de seguimiento (es lo único que se
-- guardaba hasta ahora), así que el backfill es simplemente TRUE para todas.
ALTER TABLE public.seguimiento_citas
  ADD COLUMN es_seguimiento BOOLEAN NOT NULL DEFAULT true;

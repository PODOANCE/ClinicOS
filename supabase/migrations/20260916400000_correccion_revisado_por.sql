-- ============================================================================
-- MIGRACIÓN: Corrección — revisado_por/resuelto_por deben apuntar a la
-- persona real, no a un actor técnico
-- Fecha: 2026-09-16
--
-- conciliaciones.revisado_por e incidencias.resuelto_por apuntaban por error
-- a usuarios_sistema (actor técnico), el mismo bug ya corregido para Stock y
-- Vacaciones. El propio esquema de Facturas tiene el patrón correcto en
-- facturas.revisado_por, que sí referencia usuarios(id): estas dos columnas
-- se olvidaron al crearlas en el Bloque A.
--
-- Sin backfill: ambas tablas tienen 0 filas verificado antes de esta
-- migración, así que no hay ningún registro existente que corregir.
-- ============================================================================

ALTER TABLE public.conciliaciones
  DROP CONSTRAINT fk_conciliaciones_revisado_por,
  ADD CONSTRAINT fk_conciliaciones_revisado_por
    FOREIGN KEY (revisado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.incidencias
  DROP CONSTRAINT fk_incidencias_resuelto_por,
  ADD CONSTRAINT fk_incidencias_resuelto_por
    FOREIGN KEY (resuelto_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- ============================================================================
-- MIGRACIÓN: Leads/Llamadas — esquema
-- Fecha: 2026-09-16
--
-- Sustituye la herramienta HTML en podologiarivas.com/leads-llamadas/ (clave
-- anon de Supabase expuesta en el código, sin auth real). Un único registro
-- por llamada recibida: servicio de interés, resultado (cogió cita o no),
-- motivo si no cogió cita, cómo nos conoció y código postal. El propio
-- formulario ya calcula "reembolso" solo cuando el resultado es SEGURO.
--
-- created_by/updated_by apuntan directamente a usuarios(id) desde el
-- principio (a diferencia de Stock/Vacaciones, que hubo que corregir
-- después): esto no es un actor técnico, es la persona que registra la
-- llamada.
--
-- Borrado real (sin archived_at/activo): igual que la herramienta original,
-- que permite borrar un registro erróneo sin dejar rastro. No es una tabla
-- de auditoría financiera.
-- ============================================================================

CREATE TYPE public.leads_resultado AS ENUM (
  'CITA_NUEVO',
  'CITA_CONOCIDO',
  'NO_NUEVO',
  'NO_CONOCIDO',
  'SEGURO'
);

CREATE TABLE public.leads_llamadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha TIMESTAMP NOT NULL,
  servicio VARCHAR(200) NOT NULL,
  canal VARCHAR(200),
  localidad VARCHAR(200),
  resultado public.leads_resultado NOT NULL,
  motivo VARCHAR(300),
  reembolso VARCHAR(50),
  telefono VARCHAR(30),
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,

  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,

  CONSTRAINT leads_llamadas_servicio_not_empty CHECK (length(trim(servicio)) > 0)
);

CREATE INDEX idx_leads_llamadas_fecha ON public.leads_llamadas (fecha);
CREATE INDEX idx_leads_llamadas_resultado ON public.leads_llamadas (resultado);
CREATE INDEX idx_leads_llamadas_centro ON public.leads_llamadas (centro_id);

ALTER TABLE public.leads_llamadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY leads_llamadas_select ON public.leads_llamadas
  FOR SELECT
  USING (centro_id = get_centro_id() AND private.has_area_permission('Leads', 'ver'));

CREATE POLICY leads_llamadas_insert ON public.leads_llamadas
  FOR INSERT
  WITH CHECK (centro_id = get_centro_id() AND private.has_area_permission('Leads', 'crear'));

CREATE POLICY leads_llamadas_update ON public.leads_llamadas
  FOR UPDATE
  USING (centro_id = get_centro_id() AND private.has_area_permission('Leads', 'editar'));

CREATE POLICY leads_llamadas_delete ON public.leads_llamadas
  FOR DELETE
  USING (centro_id = get_centro_id() AND private.has_area_permission('Leads', 'editar'));

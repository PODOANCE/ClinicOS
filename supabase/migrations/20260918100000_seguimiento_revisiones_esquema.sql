-- ============================================================================
-- MIGRACIÓN: Seguimiento de revisiones (Biomecánica) — esquema
-- Fecha: 2026-09-18
--
-- Traslada a ClinicOS la lógica de la plantilla "Control de revisiones de
-- Biomecánica": detecta qué pacientes que hicieron un estudio biomecánico
-- (adulto o infantil) no tienen ninguna revisión de seguimiento agendada, o
-- llevan más tiempo del debido sin una (8 meses en niños, 14 en adultos).
--
-- Dos tablas:
--   - seguimiento_citas: histórico de citas importado de Organízate (solo
--     lectura desde el cliente; el alta va siempre por el endpoint de
--     importación con service_role, igual que movimientos_bancarios).
--   - seguimiento_gestion: una fila por paciente, con lo único que el
--     personal edita a mano (si tiene cita futura por teléfono, el estado
--     de la llamada, el próximo intento y notas). Nace vacía por cada
--     paciente nuevo detectado en una importación; nunca se sobrescribe.
--
-- El cálculo de "quién está sin cita / vencido / al día" NO vive en la base
-- de datos: es lógica determinista en lib/services/seguimiento.ts, igual
-- que las fórmulas de la plantilla original — así queda en un solo sitio,
-- legible y con tests, en vez de repartida en columnas ocultas de Excel.
-- ============================================================================

CREATE TYPE public.seguimiento_gestion_estado AS ENUM (
  'PENDIENTE',
  'LLAMADO_NO_CONTESTA',
  'CITA_AGENDADA',
  'RECHAZA',
  'VOLVER_A_LLAMAR'
);

-- ── seguimiento_citas ───────────────────────────────────────────────────
CREATE TABLE public.seguimiento_citas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  fecha DATE NOT NULL,
  hora VARCHAR(10),
  agenda VARCHAR(100),
  sala VARCHAR(100),
  paciente_raw VARCHAR(200) NOT NULL,
  paciente_clave VARCHAR(200) NOT NULL, -- TRIM(UPPER(paciente_raw)), calculado al importar
  tratamiento VARCHAR(200) NOT NULL,
  precio NUMERIC(10, 2),
  estado_cita VARCHAR(100), -- ej. "Paciente nuevo", tal cual lo trae Organízate

  huella VARCHAR(64) NOT NULL, -- hash de fecha+hora+agenda+paciente_clave+tratamiento, para no duplicar al reimportar
  archivo_importacion_id UUID,

  centro_id UUID NOT NULL REFERENCES public.centros(id),

  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id),
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios(id),
  activo BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMP,

  CONSTRAINT seguimiento_citas_huella_unica UNIQUE (huella)
);

CREATE INDEX idx_seguimiento_citas_paciente_clave ON public.seguimiento_citas (paciente_clave);
CREATE INDEX idx_seguimiento_citas_centro_activo ON public.seguimiento_citas (centro_id, activo);

COMMENT ON TABLE public.seguimiento_citas IS
  'Histórico de citas de biomecánica (estudio/revisión) importado de Organízate. Solo lectura desde el cliente: el alta va por /api/seguimiento/importar con service_role.';

-- ── seguimiento_gestion ─────────────────────────────────────────────────
CREATE TABLE public.seguimiento_gestion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  paciente_clave VARCHAR(200) NOT NULL,
  nombre_mostrar VARCHAR(200) NOT NULL,

  cita_futura_manual BOOLEAN NOT NULL DEFAULT false,
  gestion_recontacto public.seguimiento_gestion_estado NOT NULL DEFAULT 'PENDIENTE',
  proximo_intento DATE,
  notas TEXT,

  centro_id UUID NOT NULL REFERENCES public.centros(id),

  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id),
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios(id),

  CONSTRAINT seguimiento_gestion_paciente_centro_unico UNIQUE (paciente_clave, centro_id)
);

COMMENT ON TABLE public.seguimiento_gestion IS
  'Una fila por paciente con lo que el personal gestiona a mano (cita futura por teléfono, estado de recontacto, próximo intento, notas). Nace vacía al detectar un paciente nuevo en una importación; el resto de columnas (estado, prioridad, etc.) se calculan en la aplicación, no aquí.';

-- ── RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.seguimiento_citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguimiento_gestion ENABLE ROW LEVEL SECURITY;

CREATE POLICY seguimiento_citas_select ON public.seguimiento_citas
  FOR SELECT USING (private.has_area_permission('Seguimiento', 'ver'));

CREATE POLICY seguimiento_gestion_select ON public.seguimiento_gestion
  FOR SELECT USING (private.has_area_permission('Seguimiento', 'ver'));

CREATE POLICY seguimiento_gestion_insert ON public.seguimiento_gestion
  FOR INSERT WITH CHECK (private.has_area_permission('Seguimiento', 'editar'));

CREATE POLICY seguimiento_gestion_update ON public.seguimiento_gestion
  FOR UPDATE USING (private.has_area_permission('Seguimiento', 'editar'))
  WITH CHECK (private.has_area_permission('Seguimiento', 'editar'));

-- seguimiento_citas no tiene policy de INSERT/UPDATE para el cliente: el
-- alta va siempre por /api/seguimiento/importar con service_role, igual
-- que movimientos_bancarios.

-- ── Permisos: Administración, Podólogo y Administrador del sistema ─────
-- (Ortopeda queda fuera explícitamente, a petición del usuario: este
-- módulo es para quien hace/gestiona estudios y revisiones de biomecánica.)
UPDATE public.roles
SET areas_permitidas = areas_permitidas || '{"Seguimiento": {"ver": true, "editar": true}}'::jsonb
WHERE nombre IN ('Administración', 'Podólogo', 'Administrador del sistema');

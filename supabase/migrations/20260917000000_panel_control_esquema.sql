-- ============================================================================
-- MIGRACIÓN: Panel de Control 360° — esquema
-- Fecha: 2026-09-17
--
-- Sustituye la herramienta HTML "Panel de Control 360°" (clave anon de
-- Supabase expuesta, un único JSON gigante en una fila `panel_datos`, sin
-- RLS real) por tablas relacionales normales, protegidas por RLS real.
--
-- Área nueva: 'PanelControl'. No se reutiliza 'Ajustes' porque significan
-- cosas distintas (Ajustes = configuración del sistema; esto es un panel
-- financiero). Solo Administración y Administrador del sistema la tienen
-- —igual que el acceso restringido de la herramienta original—, Podólogo y
-- Ortopeda no.
--
-- created_by/updated_by apuntan directamente a usuarios(id) desde el
-- principio, no a usuarios_sistema.
-- ============================================================================

UPDATE public.roles
SET areas_permitidas = areas_permitidas || '{"PanelControl": {"ver": true, "editar": true}}'::jsonb
WHERE nombre IN ('Administración', 'Administrador del sistema');

CREATE TABLE public.panel_servicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(200) NOT NULL,
  precio NUMERIC(10,2) NOT NULL DEFAULT 0,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT panel_servicios_nombre_not_empty CHECK (length(trim(nombre)) > 0)
);

CREATE TABLE public.panel_facturacion_mensual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anio SMALLINT NOT NULL,
  mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  facturacion NUMERIC(12,2) NOT NULL DEFAULT 0,
  pacientes_nuevos INTEGER NOT NULL DEFAULT 0,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  UNIQUE (centro_id, anio, mes)
);

CREATE TABLE public.panel_servicios_realizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio VARCHAR(200) NOT NULL,
  anio SMALLINT NOT NULL,
  mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  cantidad INTEGER NOT NULL DEFAULT 0,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  UNIQUE (centro_id, servicio, anio, mes)
);

CREATE TABLE public.panel_servicios_por_profesional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio VARCHAR(200) NOT NULL,
  anio SMALLINT NOT NULL,
  mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  profesional VARCHAR(100) NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 0,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  UNIQUE (centro_id, servicio, anio, mes, profesional)
);

CREATE TABLE public.panel_gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('VARIABLE', 'FIJO')),
  concepto VARCHAR(200) NOT NULL,
  valor_anual NUMERIC(12,2) NOT NULL DEFAULT 0,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT panel_gastos_concepto_not_empty CHECK (length(trim(concepto)) > 0)
);

CREATE TABLE public.panel_equipo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  rol VARCHAR(100),
  salario_anual NUMERIC(12,2) NOT NULL DEFAULT 0,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT
);

-- Reglas de comisión: una fila por centro. Fórmula (verbatim de la
-- herramienta original, no reinterpretada):
--   comisión_tratamientos = 0 si fact_sin_plantillas < sp_base;
--     si no, sp_importe_base + floor((fsin - sp_base)/sp_tramo) * sp_incremento
--   comisión_plantillas   = misma fórmula con pl_* y total_plantillas
--   total profesional = min(tratamientos + plantillas, tope_comision)
--   Solo se calcula si la suma de fact_con_plantillas de TODOS los
--   profesionales del mes >= umbral_clinica. Bonus recepción fijo si esa
--   misma suma >= umbral_bonus.
CREATE TABLE public.panel_comisiones_reglas (
  centro_id UUID PRIMARY KEY REFERENCES public.centros(id) ON DELETE RESTRICT,
  umbral_clinica NUMERIC(12,2) NOT NULL,
  umbral_bonus NUMERIC(12,2) NOT NULL,
  tope_comision NUMERIC(10,2) NOT NULL,
  sp_base NUMERIC(12,2) NOT NULL,
  sp_importe_base NUMERIC(10,2) NOT NULL,
  sp_tramo NUMERIC(10,2) NOT NULL,
  sp_incremento NUMERIC(10,2) NOT NULL,
  pl_base NUMERIC(12,2) NOT NULL,
  pl_importe_base NUMERIC(10,2) NOT NULL,
  pl_tramo NUMERIC(10,2) NOT NULL,
  pl_incremento NUMERIC(10,2) NOT NULL,
  bonus_recepcion NUMERIC(10,2) NOT NULL,
  profesionales_comisionan TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT
);

CREATE TABLE public.panel_comisiones_mensual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anio SMALLINT NOT NULL,
  mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  profesional VARCHAR(100) NOT NULL,
  fact_con_plantillas NUMERIC(12,2) NOT NULL DEFAULT 0,
  fact_sin_plantillas NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_plantillas NUMERIC(12,2) NOT NULL DEFAULT 0,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  UNIQUE (centro_id, anio, mes, profesional)
);

-- RLS: idéntica en las 8 tablas, gateada por el área PanelControl.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'panel_servicios', 'panel_facturacion_mensual', 'panel_servicios_realizados',
    'panel_servicios_por_profesional', 'panel_gastos', 'panel_equipo',
    'panel_comisiones_reglas', 'panel_comisiones_mensual'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (centro_id = get_centro_id() AND private.has_area_permission(''PanelControl'', ''ver''))',
      t || '_select', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (centro_id = get_centro_id() AND private.has_area_permission(''PanelControl'', ''editar''))',
      t || '_insert', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (centro_id = get_centro_id() AND private.has_area_permission(''PanelControl'', ''editar''))',
      t || '_update', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (centro_id = get_centro_id() AND private.has_area_permission(''PanelControl'', ''editar''))',
      t || '_delete', t
    );
  END LOOP;
END $$;

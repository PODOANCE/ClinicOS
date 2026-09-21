-- Consentimientos informados: mismo patrón Tema -> Variante que
-- Presupuestos. El texto legal (riesgos, postoperatorio...) es fijo por
-- tema; lo único que cambia entre variantes es el título del procedimiento
-- y su descripción coloquial (ej. cuántos canales/dedos). Se imprime y
-- firma a mano (no hay firma digital todavía).
CREATE TABLE public.consentimientos_temas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(150) NOT NULL,
  titulo_documento VARCHAR(200) NOT NULL DEFAULT 'CONSENTIMIENTO PARA LA OPERACIÓN Y ANESTESIA',
  texto_alternativas TEXT NOT NULL,
  texto_consecuencias TEXT NOT NULL,
  texto_precauciones TEXT NOT NULL,
  texto_complicaciones_tipicas TEXT NOT NULL,
  texto_complicaciones_graves TEXT NOT NULL,
  texto_postoperatorio TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT consentimientos_temas_nombre_not_empty CHECK (length(trim(nombre)) > 0)
);

CREATE TABLE public.consentimientos_variantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tema_id UUID NOT NULL REFERENCES public.consentimientos_temas(id) ON DELETE CASCADE,
  nombre VARCHAR(200) NOT NULL, -- etiqueta interna, para casar con la variante de Presupuestos
  procedimiento_titulo VARCHAR(300) NOT NULL, -- ej. "Matricectomía ungueal parcial del canal peroneal de ambos hallux."
  descripcion_coloquial TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT consentimientos_variantes_nombre_not_empty CHECK (length(trim(nombre)) > 0)
);

CREATE TABLE public.consentimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL DEFAULT current_date,

  paciente_nombre VARCHAR(200) NOT NULL,
  paciente_nif VARCHAR(20),
  paciente_telefono VARCHAR(30),
  paciente_historia_clinica VARCHAR(30),
  paciente_clave VARCHAR(200),

  podologos VARCHAR(300) NOT NULL, -- quién informa, ej. "Paula Castillo Carpio y Andrés Sales Aguilar"

  tema_id UUID REFERENCES public.consentimientos_temas(id) ON DELETE SET NULL,
  variante_id UUID REFERENCES public.consentimientos_variantes(id) ON DELETE SET NULL,
  procedimiento_titulo VARCHAR(300) NOT NULL,
  descripcion_coloquial TEXT NOT NULL,

  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT
);

CREATE INDEX idx_consentimientos_variantes_tema ON public.consentimientos_variantes (tema_id);
CREATE INDEX idx_consentimientos_fecha ON public.consentimientos (centro_id, fecha DESC);

ALTER TABLE public.consentimientos_temas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consentimientos_variantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consentimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY consentimientos_temas_select ON public.consentimientos_temas
  FOR SELECT USING (centro_id = get_centro_id() AND private.has_area_permission('Consentimientos', 'ver'));
CREATE POLICY consentimientos_temas_insert ON public.consentimientos_temas
  FOR INSERT WITH CHECK (centro_id = get_centro_id() AND private.has_area_permission('Consentimientos', 'editar'));
CREATE POLICY consentimientos_temas_update ON public.consentimientos_temas
  FOR UPDATE USING (centro_id = get_centro_id() AND private.has_area_permission('Consentimientos', 'editar'));

CREATE POLICY consentimientos_variantes_select ON public.consentimientos_variantes
  FOR SELECT USING (centro_id = get_centro_id() AND private.has_area_permission('Consentimientos', 'ver'));
CREATE POLICY consentimientos_variantes_insert ON public.consentimientos_variantes
  FOR INSERT WITH CHECK (centro_id = get_centro_id() AND private.has_area_permission('Consentimientos', 'editar'));
CREATE POLICY consentimientos_variantes_update ON public.consentimientos_variantes
  FOR UPDATE USING (centro_id = get_centro_id() AND private.has_area_permission('Consentimientos', 'editar'));

CREATE POLICY consentimientos_select ON public.consentimientos
  FOR SELECT USING (centro_id = get_centro_id() AND private.has_area_permission('Consentimientos', 'ver'));
CREATE POLICY consentimientos_insert ON public.consentimientos
  FOR INSERT WITH CHECK (centro_id = get_centro_id() AND private.has_area_permission('Consentimientos', 'crear'));

-- Mismo criterio de acceso que Presupuestos, de momento.
UPDATE public.roles
SET areas_permitidas = areas_permitidas || '{"Consentimientos": {"ver": true, "crear": true, "editar": true}}'::jsonb
WHERE nombre IN ('Administración', 'Administrador del sistema');

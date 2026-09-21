-- Presupuestos: catálogo de temas/variantes (ej. Cirugía Ungueal ->
-- Unilateral 1 canal / Bilateral 1 canal cada dedo / Bilateral 4 canales)
-- + los presupuestos generados a partir de ellos. Sustituye a rellenar la
-- plantilla de Organízate a mano; el PDF con diseño propio se genera desde
-- la app (imprimir/guardar como PDF), esta tabla solo guarda los datos.
CREATE TABLE public.presupuestos_temas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(150) NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT presupuestos_temas_nombre_not_empty CHECK (length(trim(nombre)) > 0)
);

CREATE TABLE public.presupuestos_variantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tema_id UUID NOT NULL REFERENCES public.presupuestos_temas(id) ON DELETE CASCADE,
  nombre VARCHAR(200) NOT NULL, -- ej. "Cirugía Ungueal Bilateral (4 canales)"
  precio NUMERIC(10, 2) NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT presupuestos_variantes_nombre_not_empty CHECK (length(trim(nombre)) > 0),
  CONSTRAINT presupuestos_variantes_precio_no_negativo CHECK (precio >= 0)
);

CREATE TABLE public.presupuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero VARCHAR(30) NOT NULL, -- propio de ClinicOS, distinto de la numeración de Organízate
  fecha DATE NOT NULL DEFAULT current_date,

  paciente_nombre VARCHAR(200) NOT NULL,
  paciente_dni VARCHAR(20),
  paciente_direccion VARCHAR(300),
  paciente_clave VARCHAR(200), -- si casa con un paciente ya conocido, para poder enlazar su ficha

  tema_id UUID REFERENCES public.presupuestos_temas(id) ON DELETE SET NULL,
  variante_id UUID REFERENCES public.presupuestos_variantes(id) ON DELETE SET NULL,
  concepto VARCHAR(200) NOT NULL, -- copia del nombre de la variante al generar (histórico, no cambia si luego se edita el catálogo)
  precio NUMERIC(10, 2) NOT NULL,

  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,

  CONSTRAINT presupuestos_numero_unico UNIQUE (centro_id, numero),
  CONSTRAINT presupuestos_precio_no_negativo CHECK (precio >= 0)
);

CREATE INDEX idx_presupuestos_variantes_tema ON public.presupuestos_variantes (tema_id);
CREATE INDEX idx_presupuestos_fecha ON public.presupuestos (centro_id, fecha DESC);

ALTER TABLE public.presupuestos_temas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuestos_variantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY presupuestos_temas_select ON public.presupuestos_temas
  FOR SELECT USING (centro_id = get_centro_id() AND private.has_area_permission('Presupuestos', 'ver'));
CREATE POLICY presupuestos_temas_insert ON public.presupuestos_temas
  FOR INSERT WITH CHECK (centro_id = get_centro_id() AND private.has_area_permission('Presupuestos', 'editar'));
CREATE POLICY presupuestos_temas_update ON public.presupuestos_temas
  FOR UPDATE USING (centro_id = get_centro_id() AND private.has_area_permission('Presupuestos', 'editar'));

CREATE POLICY presupuestos_variantes_select ON public.presupuestos_variantes
  FOR SELECT USING (centro_id = get_centro_id() AND private.has_area_permission('Presupuestos', 'ver'));
CREATE POLICY presupuestos_variantes_insert ON public.presupuestos_variantes
  FOR INSERT WITH CHECK (centro_id = get_centro_id() AND private.has_area_permission('Presupuestos', 'editar'));
CREATE POLICY presupuestos_variantes_update ON public.presupuestos_variantes
  FOR UPDATE USING (centro_id = get_centro_id() AND private.has_area_permission('Presupuestos', 'editar'));

CREATE POLICY presupuestos_select ON public.presupuestos
  FOR SELECT USING (centro_id = get_centro_id() AND private.has_area_permission('Presupuestos', 'ver'));
CREATE POLICY presupuestos_insert ON public.presupuestos
  FOR INSERT WITH CHECK (centro_id = get_centro_id() AND private.has_area_permission('Presupuestos', 'crear'));

-- Solo Administración y Administrador del sistema, de momento (se puede
-- abrir a podólogos más adelante si hace falta que ellos mismos los generen).
UPDATE public.roles
SET areas_permitidas = areas_permitidas || '{"Presupuestos": {"ver": true, "crear": true, "editar": true}}'::jsonb
WHERE nombre IN ('Administración', 'Administrador del sistema');

-- Catálogo inicial: Cirugía Ungueal con las 3 variantes ya en uso.
WITH nuevo_tema AS (
  INSERT INTO public.presupuestos_temas (nombre, orden, centro_id, created_by)
  SELECT 'Cirugía Ungueal', 1, c.id, u.id
  FROM public.centros c, public.usuarios u
  WHERE u.email = 'admin@podologiarivas.com'
  LIMIT 1
  RETURNING id, centro_id, created_by
)
INSERT INTO public.presupuestos_variantes (tema_id, nombre, precio, orden, centro_id, created_by)
SELECT nt.id, v.nombre, v.precio, v.orden, nt.centro_id, nt.created_by
FROM nuevo_tema nt,
  (VALUES
    ('Cirugía Ungueal Unilateral (1 canal)', 350.00, 1),
    ('Cirugía Ungueal Bilateral (1 canal cada dedo)', 550.00, 2),
    ('Cirugía Ungueal Bilateral (4 canales)', 700.00, 3)
  ) AS v(nombre, precio, orden);

-- Recordatorios de citas por WhatsApp (envío manual, sin API de pago):
-- una plantilla de texto por centro que el propio personal puede editar,
-- con placeholders {nombre}/{fecha}/{hora}/{profesional} que la app
-- rellena al generar los mensajes del día siguiente.
CREATE TABLE public.recordatorios_plantilla (
  centro_id UUID PRIMARY KEY REFERENCES public.centros(id) ON DELETE RESTRICT,
  texto TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT
);

ALTER TABLE public.recordatorios_plantilla ENABLE ROW LEVEL SECURITY;

-- Reutiliza el área 'Seguimiento': mismo público (todos menos ortopeda) que
-- ya gestiona el contacto con pacientes, sin crear un área nueva para esto.
CREATE POLICY recordatorios_plantilla_select ON public.recordatorios_plantilla
  FOR SELECT USING (
    centro_id = get_centro_id() AND private.has_area_permission('Seguimiento', 'ver')
  );

CREATE POLICY recordatorios_plantilla_insert ON public.recordatorios_plantilla
  FOR INSERT WITH CHECK (
    centro_id = get_centro_id() AND private.has_area_permission('Seguimiento', 'editar')
  );

CREATE POLICY recordatorios_plantilla_update ON public.recordatorios_plantilla
  FOR UPDATE USING (
    centro_id = get_centro_id() AND private.has_area_permission('Seguimiento', 'editar')
  );

-- Plantilla genérica de arranque para el centro existente; el propio
-- personal la sustituye por el texto real desde la web en cuanto lo tenga.
INSERT INTO public.recordatorios_plantilla (centro_id, texto, updated_by)
SELECT c.id,
  'Hola {nombre} 👋, te recordamos tu cita mañana {fecha} a las {hora}h con {profesional} en Podología y Biomecánica Rivas. Si no puedes asistir, avísanos con tiempo. ¡Te esperamos!',
  u.id
FROM public.centros c
CROSS JOIN LATERAL (SELECT id FROM public.usuarios WHERE email = 'admin@podologiarivas.com' LIMIT 1) u
ON CONFLICT (centro_id) DO NOTHING;

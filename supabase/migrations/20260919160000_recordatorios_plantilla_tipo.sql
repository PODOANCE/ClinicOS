-- Segundo tipo de plantilla: recontacto de Seguimiento (pacientes sin cita
-- futura, priorizando quien lleva plantillas), distinto del recordatorio
-- de "cita de mañana". Misma tabla, clave compuesta por tipo.
ALTER TABLE public.recordatorios_plantilla DROP CONSTRAINT recordatorios_plantilla_pkey;
ALTER TABLE public.recordatorios_plantilla ADD COLUMN tipo TEXT NOT NULL DEFAULT 'CITA_MANANA';
ALTER TABLE public.recordatorios_plantilla ADD PRIMARY KEY (centro_id, tipo);

INSERT INTO public.recordatorios_plantilla (centro_id, tipo, texto, updated_by)
SELECT centro_id, 'RECONTACTO',
  'Hola {nombre} 👋, hace tiempo que no te vemos por Podología y Biomecánica Rivas para tu revisión. ¿Te viene bien que te agendemos una cita? Contesta a este mensaje y te lo organizamos. ¡Un saludo!',
  updated_by
FROM public.recordatorios_plantilla
WHERE tipo = 'CITA_MANANA'
ON CONFLICT (centro_id, tipo) DO NOTHING;

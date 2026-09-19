-- Teléfonos de pacientes, para poder generar enlaces directos de WhatsApp
-- en Recordatorios. Se importa de vez en cuando (listado de pacientes de
-- Organízate), no cada día — por eso vive separado de la generación diaria
-- de mensajes, que solo lee esta tabla por nombre.
CREATE TABLE public.pacientes_telefono (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_clave TEXT NOT NULL, -- nombre completo normalizado: mayúsculas, espacios colapsados
  nombre_mostrar TEXT NOT NULL,
  telefono TEXT NOT NULL,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  UNIQUE (centro_id, paciente_clave)
);

ALTER TABLE public.pacientes_telefono ENABLE ROW LEVEL SECURITY;

-- Reutiliza el área 'Seguimiento', mismo público que ya gestiona contacto
-- con pacientes (recordatorios_plantilla usa el mismo patrón).
CREATE POLICY pacientes_telefono_select ON public.pacientes_telefono
  FOR SELECT USING (
    centro_id = get_centro_id() AND private.has_area_permission('Seguimiento', 'ver')
  );

CREATE POLICY pacientes_telefono_insert ON public.pacientes_telefono
  FOR INSERT WITH CHECK (
    centro_id = get_centro_id() AND private.has_area_permission('Seguimiento', 'editar')
  );

CREATE POLICY pacientes_telefono_update ON public.pacientes_telefono
  FOR UPDATE USING (
    centro_id = get_centro_id() AND private.has_area_permission('Seguimiento', 'editar')
  );

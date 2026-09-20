-- Los teléfonos de pacientes solo los debe poder leer/escribir personal de
-- administración (recepción/gestión), no podólogos ni ortopedas: son ellos
-- quienes gestionan agenda y recontactos, no quien pasa consulta.
CREATE OR REPLACE FUNCTION private.es_administracion()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_roles ur
    JOIN public.roles r ON ur.rol_id = r.id
    WHERE ur.usuario_id = auth.uid()
      AND r.nombre IN ('Administración', 'Administrador del sistema')
  );
$$;

DROP POLICY pacientes_telefono_select ON public.pacientes_telefono;
CREATE POLICY pacientes_telefono_select ON public.pacientes_telefono
  FOR SELECT USING (
    centro_id = get_centro_id() AND private.has_area_permission('Seguimiento', 'ver') AND private.es_administracion()
  );

DROP POLICY pacientes_telefono_insert ON public.pacientes_telefono;
CREATE POLICY pacientes_telefono_insert ON public.pacientes_telefono
  FOR INSERT WITH CHECK (
    centro_id = get_centro_id() AND private.has_area_permission('Seguimiento', 'editar') AND private.es_administracion()
  );

DROP POLICY pacientes_telefono_update ON public.pacientes_telefono;
CREATE POLICY pacientes_telefono_update ON public.pacientes_telefono
  FOR UPDATE USING (
    centro_id = get_centro_id() AND private.has_area_permission('Seguimiento', 'editar') AND private.es_administracion()
  );

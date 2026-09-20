-- La restricción de teléfonos a administración (private.es_administracion())
-- no debe llevarse por delante la columna "edad", que sigue siendo visible
-- para cualquiera con permiso de ver Seguimiento (podólogos incluidos).
-- Como la RLS de pacientes_telefono ya exige es_administracion() para
-- SELECT, se expone la edad por una función SECURITY DEFINER que no toca
-- teléfono ni nombre_mostrar.
CREATE OR REPLACE FUNCTION public.get_edades_pacientes(p_claves TEXT[])
RETURNS TABLE (paciente_clave TEXT, edad SMALLINT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pt.paciente_clave, pt.edad
  FROM public.pacientes_telefono pt
  WHERE pt.centro_id = get_centro_id()
    AND private.has_area_permission('Seguimiento', 'ver')
    AND pt.paciente_clave = ANY (p_claves)
    AND pt.edad IS NOT NULL;
$$;

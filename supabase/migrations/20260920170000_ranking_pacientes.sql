-- Ranking de pacientes por gasto (por año o global), solo para
-- Administrador del sistema (Andrés y Celia) — pensado para detectar al
-- paciente que más se gasta, de cara a algún tipo de premio/detalle.
CREATE OR REPLACE FUNCTION private.es_administrador_sistema()
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
      AND r.nombre = 'Administrador del sistema'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_ranking_pacientes(p_anio INT DEFAULT NULL, p_limite INT DEFAULT 20)
RETURNS TABLE (paciente_clave TEXT, gasto NUMERIC, num_visitas BIGINT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sc.paciente_clave, SUM(sc.precio) AS gasto, count(*) AS num_visitas
  FROM public.seguimiento_citas sc
  WHERE sc.activo = true
    AND sc.centro_id = get_centro_id()
    AND private.es_administrador_sistema()
    AND sc.precio IS NOT NULL
    AND (p_anio IS NULL OR EXTRACT(YEAR FROM sc.fecha)::int = p_anio)
  GROUP BY sc.paciente_clave
  ORDER BY gasto DESC
  LIMIT p_limite;
$$;

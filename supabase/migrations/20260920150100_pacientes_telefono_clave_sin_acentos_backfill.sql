-- Mismo motivo que la migración anterior (seguimiento_citas/gestion), pero
-- aquí sí hay colisiones reales: 11 pacientes ya estaban duplicados en el
-- listado importado (una vez con acento, otra sin) — probablemente por
-- errores de escritura al dar de alta al paciente en Organízate en
-- distintos momentos. Se fusionan en una sola fila por paciente,
-- quedándose con el teléfono/edad que no sea NULL.
WITH grupos AS (
  SELECT
    centro_id,
    translate(paciente_clave, 'ÁÉÍÓÚÑÜ', 'AEIOUNU') AS nueva_clave,
    array_agg(id ORDER BY (telefono IS NULL), (edad IS NULL), created_at) AS ids,
    (array_agg(telefono ORDER BY telefono IS NULL))[1] AS telefono_final,
    (array_agg(edad ORDER BY edad IS NULL))[1] AS edad_final
  FROM public.pacientes_telefono
  GROUP BY 1, 2
  HAVING count(*) > 1
),
borrados AS (
  DELETE FROM public.pacientes_telefono p
  USING grupos g
  WHERE p.id = ANY (g.ids[2:])
  RETURNING p.id
)
UPDATE public.pacientes_telefono p
SET paciente_clave = g.nueva_clave, telefono = g.telefono_final, edad = g.edad_final
FROM grupos g
WHERE p.id = g.ids[1];

-- El resto (sin colisión) se normaliza directamente.
UPDATE public.pacientes_telefono
SET paciente_clave = translate(paciente_clave, 'ÁÉÍÓÚÑÜ', 'AEIOUNU')
WHERE paciente_clave ~ '[ÁÉÍÓÚÑÜ]';

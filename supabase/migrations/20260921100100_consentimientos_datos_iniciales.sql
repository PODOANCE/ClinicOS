-- Tema inicial: Cirugía Ungueal (Matricectomía) — texto legal calcado del
-- consentimiento en papel ya en uso (firmado por Amparo Pla Sánchez,
-- 17/09/2026: "canal peroneal de ambos hallux" = un canal en cada uno de
-- los dos dedos gordos), con 3 variantes que casan con las de Presupuestos.
-- OJO: solo la variante "Bilateral (1 canal cada dedo)" es una copia exacta
-- de ese documento real firmado; las otras dos (unilateral / 4 canales)
-- están adaptadas cambiando el número de canales/dedos sobre ese mismo
-- texto — hay que revisarlas antes de usarlas con un paciente real.
WITH nuevo_tema AS (
  INSERT INTO public.consentimientos_temas (
    nombre, titulo_documento,
    texto_alternativas, texto_consecuencias, texto_precauciones,
    texto_complicaciones_tipicas, texto_complicaciones_graves, texto_postoperatorio,
    orden, centro_id, created_by
  )
  SELECT
    'Cirugía Ungueal (Matricectomía)',
    'CONSENTIMIENTO PARA LA OPERACIÓN Y ANESTESIA',
    'Acudir regularmente a consulta para "quitar" el pico de uña según va creciendo, para que no se "clave" en el borde de la piel del dedo. Esto es lo que usted ha venido haciendo.',
    'La uña del borde del dedo no volverá a salir. La uña quedará más estrecha.',
    E'A.- (Táchese lo que proceda).\n- En su caso, el dentista ya le ha puesto anestesia y no tuvo problemas.\n- Se le han hecho las pruebas de alergia al anestésico y han dado negativas.\n\nB.- Si no está segura de no estar embarazada, si hay duda o no puede asegurarlo, la intervención se pospondrá.',
    E'Su intervención quirúrgica en la actualidad es segura, aunque en ocasiones pueden presentarse algunas complicaciones, en pequeños porcentajes, siendo las más significativas:\n- Que se infecte la herida y tomaría antibióticos.\n- Que haya un retraso de cicatrización, y en vez de cicatrizar alrededor de los 15 días que cicatrice alrededor de los 20-25 días.',
    'Que el borde de la uña operada volviera a salir, eso significa que quedó algún resto de "raíz" (matriz ungueal) que estaría más profundo de lo normal. Si esto sucediera, se volvería a intervenir para quitar el resto de "raíz" (matriz ungueal) sin coste alguno para el paciente.',
    E'- Anestesia local. Se duerme solo el dedo a intervenir.\n- Durante la intervención no sentirá ningún dolor. Posteriormente, cuando se pase el efecto de la anestesia, tomará un calmante, y en el 99% de los casos los pacientes no tienen dolor.\n- Terminada la intervención saldrá caminando a su casa, con el mismo zapato que trajo. (El día de la intervención traiga el zapato más ancho de todos los que normalmente usa).\n- En casa podrá caminar para ir al baño, al salón, ver televisión, etc.\n- Si todo va bien, incluso podrá caminar aún más.\n- Al 3º día regresará a consulta para realizar la primera cura.\n- Posteriormente, se realizarán revisiones periódicas según evolución, hasta el alta.\n- No puede mojarse el pie hasta que no se dé el alta.',
    1, c.id, u.id
  FROM public.centros c, public.usuarios u
  WHERE u.email = 'admin@podologiarivas.com'
  LIMIT 1
  RETURNING id, centro_id, created_by
)
INSERT INTO public.consentimientos_variantes (tema_id, nombre, procedimiento_titulo, descripcion_coloquial, orden, centro_id, created_by)
SELECT nt.id, v.nombre, v.procedimiento_titulo, v.descripcion_coloquial, v.orden, nt.centro_id, nt.created_by
FROM nuevo_tema nt,
  (VALUES
    (
      'Cirugía Ungueal Unilateral (1 canal)',
      'Matricectomía ungueal parcial de un canal.',
      'Quitar mediante procedimiento químico parte de la uña del dedo del pie para que no vuelva a salir.',
      1
    ),
    (
      'Cirugía Ungueal Bilateral (1 canal cada dedo)',
      'Matricectomía ungueal parcial del canal peroneal de ambos hallux.',
      'Quitar mediante procedimiento químico parte de la uña del dedo gordo del pie para que no vuelva a salir.',
      2
    ),
    (
      'Cirugía Ungueal Bilateral (4 canales)',
      'Matricectomía ungueal parcial de ambos canales (peroneal y tibial) de ambos hallux.',
      'Quitar mediante procedimiento químico parte de la uña a ambos lados del dedo gordo de los dos pies para que no vuelva a salir.',
      3
    )
  ) AS v(nombre, procedimiento_titulo, descripcion_coloquial, orden);

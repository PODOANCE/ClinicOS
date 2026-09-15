-- ============================================================================
-- MIGRACIÓN: Vacaciones — datos iniciales (7 trabajadores, 14 festivos, 75 períodos)
-- Fecha: 2026-09-16
--
-- Fuente: proyecto Supabase del sistema antiguo (/vacaciones2026/), leído
-- en solo lectura. Mismo guard de idempotencia por identidad exacta que la
-- migración de datos de Stock: vacío -> migra; completo y coherente -> no
-- hace nada; cualquier otro estado -> aborta explícitamente.
-- ============================================================================

DO $$
DECLARE
  v_centro  UUID;
  v_actor   UUID;

  -- IDs deterministas de los 7 trabajadores esperados
  v_trab_ids UUID[] := ARRAY[
    '39d32de2-8994-5497-8325-93d7872cecdd'::uuid,
    'd4a6f622-e007-5a67-8290-6abb2b69dcc9'::uuid,
    'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e'::uuid,
    '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid,
    '0fac149e-1430-5359-93b0-6cf1c60cdf85'::uuid,
    'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5'::uuid,
    '5c035986-3412-5369-8dfd-d279b8e9662b'::uuid
  ];

  -- IDs deterministas de los 14 festivos esperados
  v_fest_ids UUID[] := ARRAY[
    '56655835-2487-5b4c-85b9-8cd5aa333ae5'::uuid,
    'd7fc90e7-0a8b-52aa-a8a8-e712c5cf9980'::uuid,
    '44a380b9-7202-539e-825c-2211f495ecf9'::uuid,
    'bd4671f1-118a-527d-b0e3-44e97ca08da2'::uuid,
    'f202c1f1-6d52-52d0-9a76-e223ea1310fc'::uuid,
    '5afbd440-729c-5781-ad07-0859bd9a1408'::uuid,
    '7b548e58-c0de-571e-a48e-47bb7725736d'::uuid,
    '69c5e2c2-8e2e-5a69-9bfe-d801beaa2416'::uuid,
    '3e7b8fbd-87d1-5075-87a5-5690b95da8f4'::uuid,
    'f1739156-df80-5491-a764-32f65a4928a8'::uuid,
    'e01f0898-ef4f-5ca4-a4db-728d2b9c1df5'::uuid,
    'd36a7f6e-b1a4-5bbc-833b-83743e8ad58c'::uuid,
    'b62541d8-75dc-50e6-9686-e04f93222249'::uuid,
    '8495f126-2e40-5a06-8513-453d54166472'::uuid
  ];

  -- IDs deterministas de los 75 períodos esperados
  v_per_ids UUID[] := ARRAY[
    'd5247899-26d8-5024-afe9-eb4b1a928de9'::uuid,
    '749273f8-e630-5c2a-a4ee-b50b27cb40d1'::uuid,
    'fee3089b-83c5-5aba-a10e-f76810d7989e'::uuid,
    '890b2e1c-5454-5b7b-b8d1-f2af2139922c'::uuid,
    '3e2227d8-8c8c-5194-bf05-9e943caa835f'::uuid,
    '40873a92-dcf2-57d7-aa7c-aeebf2113a37'::uuid,
    '2bc1f0ff-b393-56b0-934b-54ebb366e5c1'::uuid,
    'f63ab11f-6343-5b44-b2d1-6cf5d41e334d'::uuid,
    '880e82a7-562e-5fcd-8db7-f3d054228983'::uuid,
    'edc96055-1e33-5a63-b1e6-afd7035ef05f'::uuid,
    '6b710f87-b346-5eab-9790-b4005db6a95d'::uuid,
    '80e487b0-eaf8-58c6-aa4e-5049d064f4a1'::uuid,
    'b6aa67f6-c4ca-546b-a33b-217a216275fc'::uuid,
    '1cdeb2ef-47fa-50e4-b880-171ac9e0ccef'::uuid,
    '4d4b6c48-c192-5cfc-823a-9d296eb4f0b9'::uuid,
    '4f55a3bc-e229-562b-828c-8a0e15c4a46f'::uuid,
    '58cb1a7f-9bb2-5f98-9eb8-3872cdbe7543'::uuid,
    '4e582d53-707c-5df2-aeb6-faa09721cc37'::uuid,
    'a6df9925-0c45-5190-9f97-15131a5b1d5e'::uuid,
    '8aed9c68-a037-5ad1-aedc-b6bcd021306e'::uuid,
    '90eb426c-e929-54a0-93b0-3722f67756d7'::uuid,
    '0888ded0-bbe9-596a-8f8a-2cd9e8deec56'::uuid,
    '6615913b-7a68-510f-add0-76160cb77c97'::uuid,
    '95fd738a-f3e2-5a5c-a81e-b71042cce60e'::uuid,
    '5cf08232-0dc2-575d-8312-96523685a064'::uuid,
    '02913cc6-ad9e-5555-8739-9bea4ab6b7fc'::uuid,
    '961d6039-26d9-5423-8e3a-aedd7c1af8b5'::uuid,
    '66210d39-d8ac-574b-adb1-b38b36dc7ba9'::uuid,
    'fbfc4608-bfe6-5e2f-b64e-70043b9b7ce6'::uuid,
    '8019114c-25e0-5a2a-8be8-5098879a79a2'::uuid,
    '1f5d8077-4b59-5f1f-bc26-39871487f74c'::uuid,
    'da4a28a5-805c-5b9f-abed-648a1e2be6bd'::uuid,
    '87d6b58e-bdb6-5d30-b5ce-60dc161e0d5b'::uuid,
    '60cff98b-0c44-5fd4-86e8-10cf765c2d76'::uuid,
    '99ef5785-b569-5b18-ac0c-935e761e3815'::uuid,
    '163b8f03-4ec5-536b-ba88-34cf14a63b92'::uuid,
    'a599a493-b94c-5aab-93db-04307e8bb409'::uuid,
    '923ba2af-2835-55cc-8dac-0c92b6acae54'::uuid,
    'afe7a189-0177-5320-8db1-9395498644ed'::uuid,
    '5fd69597-6450-567d-8432-25713e2165f2'::uuid,
    '56ef8482-9ec8-5719-8745-15f5b1e52345'::uuid,
    'aa3cc464-4f8a-53e5-a609-4089ef3514df'::uuid,
    '6f157940-e8ec-54d0-aa45-03c5996657bd'::uuid,
    '0ce5b3dd-1771-5ccf-a444-51d941e40079'::uuid,
    '2c15ccff-2d75-560b-89e4-b6bfcfe39605'::uuid,
    '4587b4de-46e0-59e4-bca9-3b90945759fd'::uuid,
    '88fbf591-a1d1-5da1-b60e-df42e0440b48'::uuid,
    '2f57436a-b7dc-5428-b398-859a7dd57819'::uuid,
    'b0644dee-c3c6-5365-b63c-d7dcf77012ab'::uuid,
    '9ae5cf86-c15c-5d0e-80b7-9963f014d071'::uuid,
    '7f505b86-30da-50f3-94bd-b2c5a4476464'::uuid,
    '5c1b7dc6-3fac-5b68-b4af-a114244a1a6b'::uuid,
    'b223e93c-c6ed-5197-bc3b-177324cfe6e1'::uuid,
    'e57c8827-4c9f-506c-b62a-26da9bb1b7c8'::uuid,
    'f5fefb60-ad14-5586-aa1f-958f2c9ce304'::uuid,
    'd9dcb546-b4d5-5365-8f98-4338b2d0dccc'::uuid,
    'd84780cd-3e10-55cb-9148-4388bf200a69'::uuid,
    '24158e38-85df-5272-b5f9-123e42df92fa'::uuid,
    'ffca87cd-ef82-5373-ab0e-9f0e70794109'::uuid,
    'c37167af-c239-5090-addb-ac2ef52b3273'::uuid,
    '6a7e27b6-4aaa-57d2-935c-928f92f8f7c8'::uuid,
    '538ad5d9-801b-5604-8d45-a10e1c2818d1'::uuid,
    '15c926d6-8dc1-5eed-a82d-bead507fe066'::uuid,
    'a401f265-8fb7-59a2-9610-4b5158a04da3'::uuid,
    'dba00e1f-d772-5ae3-89de-07348592b5ba'::uuid,
    '72b220c6-0b6f-5424-b6e5-a522f60fdbac'::uuid,
    '2cff2329-9bff-5a49-8b9a-a1f5a784be16'::uuid,
    'ebf1e4ee-15a8-574f-ad04-f9a52aa8ce95'::uuid,
    '157f3b7f-96e2-5f18-bc04-56c4794bf193'::uuid,
    '43ceeff7-15c7-51a0-8687-9b7b609ec6f4'::uuid,
    '7a272758-f2bb-596e-b80a-4afcfccdeb7a'::uuid,
    'e53467e4-259d-5927-b863-281e050de44e'::uuid,
    '34af1fe2-6095-5a70-aa55-be14ee9cc881'::uuid,
    'b20b3e7c-c943-590a-a1bc-796fd7e1295d'::uuid,
    '13253607-7d67-5658-81a6-693a71b64f67'::uuid
  ];

  v_existing_trab INT; v_existing_fest INT; v_existing_per INT;
  v_trab_mismatch INT; v_fest_mismatch INT; v_per_mismatch INT;
  v_trab_n INT; v_fest_n INT; v_per_n INT;
BEGIN
  SELECT id INTO v_centro FROM public.centros WHERE nombre = 'Podología y Biomecánica Rivas';
  SELECT id INTO v_actor  FROM public.usuarios_sistema WHERE nombre = 'SISTEMA_CRON';

  IF v_centro IS NULL THEN RAISE EXCEPTION 'MIGRACION_VACACIONES: no se encuentra el centro'; END IF;
  IF v_actor  IS NULL THEN RAISE EXCEPTION 'MIGRACION_VACACIONES: no se encuentra el actor SISTEMA_CRON'; END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- GUARD: identidad exacta por ID determinista.
  -- ══════════════════════════════════════════════════════════════════════
  SELECT COUNT(*) INTO v_existing_trab FROM public.vacaciones_trabajadores WHERE id = ANY(v_trab_ids);
  SELECT COUNT(*) INTO v_existing_fest FROM public.vacaciones_festivos     WHERE id = ANY(v_fest_ids);
  SELECT COUNT(*) INTO v_existing_per  FROM public.vacaciones_periodos    WHERE id = ANY(v_per_ids);

  IF v_existing_trab = 0 AND v_existing_fest = 0 AND v_existing_per = 0 THEN
    -- Caso A: nada de este dataset existe todavía. Continúa más abajo.
    NULL;

  ELSIF v_existing_trab = 7 AND v_existing_fest = 14 AND v_existing_per = 75 THEN

    WITH esperado(id, nombre, color, dias_anuales, usuario_id) AS (VALUES
      ('39d32de2-8994-5497-8325-93d7872cecdd'::uuid, 'Andrés', '#183B5F', 25, 'dd87f885-8b49-4b25-9592-a5e49c08c746'::uuid),
      ('d4a6f622-e007-5a67-8290-6abb2b69dcc9'::uuid, 'Celia', '#F18852', 25, 'dd87f885-8b49-4b25-9592-a5e49c08c746'::uuid),
      ('b46e7620-0ce4-5c34-b0fd-984fb3d68e6e'::uuid, 'Sara', '#94C0D4', 25, 'e2179d43-1e03-42a1-a97e-31e18fea574f'::uuid),
      ('50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, 'Paula', '#F5CA77', 25, 'cbfd01b3-c706-4b49-8ea3-38d4e0ed327d'::uuid),
      ('0fac149e-1430-5359-93b0-6cf1c60cdf85'::uuid, 'Belén', '#7BA05B', 25, '278ac8f4-7e96-47fb-8fd7-6da911e6e4d0'::uuid),
      ('a4b0fb70-c31e-5196-b62a-ae24e2e35ea5'::uuid, 'Álvaro', '#B86BB0', 21, '1b434a7d-1031-4325-af57-a8d7c64f6c48'::uuid),
      ('5c035986-3412-5369-8dfd-d279b8e9662b'::uuid, 'Patricia', '#E0607E', 15, 'afb7958e-c069-45fc-a819-d2fff7d2e529'::uuid)
    )
    SELECT COUNT(*) INTO v_trab_mismatch
    FROM esperado e
    JOIN public.vacaciones_trabajadores r ON r.id = e.id
    WHERE r.nombre IS DISTINCT FROM e.nombre
       OR r.color IS DISTINCT FROM e.color
       OR r.dias_anuales IS DISTINCT FROM e.dias_anuales
       OR r.usuario_id IS DISTINCT FROM e.usuario_id
       OR r.centro_id IS DISTINCT FROM v_centro;

    WITH esperado(id, fecha, nombre, tipo) AS (VALUES
      ('56655835-2487-5b4c-85b9-8cd5aa333ae5'::uuid, DATE '2026-01-01', 'Año Nuevo', 'NACIONAL'::public.vacaciones_festivo_tipo),
      ('d7fc90e7-0a8b-52aa-a8a8-e712c5cf9980'::uuid, DATE '2026-01-06', 'Epifanía / Reyes', 'NACIONAL'::public.vacaciones_festivo_tipo),
      ('44a380b9-7202-539e-825c-2211f495ecf9'::uuid, DATE '2026-04-02', 'Jueves Santo', 'AUTONOMICO'::public.vacaciones_festivo_tipo),
      ('bd4671f1-118a-527d-b0e3-44e97ca08da2'::uuid, DATE '2026-04-03', 'Viernes Santo', 'NACIONAL'::public.vacaciones_festivo_tipo),
      ('f202c1f1-6d52-52d0-9a76-e223ea1310fc'::uuid, DATE '2026-05-01', 'Día del Trabajo', 'NACIONAL'::public.vacaciones_festivo_tipo),
      ('5afbd440-729c-5781-ad07-0859bd9a1408'::uuid, DATE '2026-05-02', 'Día de la Comunidad de Madrid', 'AUTONOMICO'::public.vacaciones_festivo_tipo),
      ('7b548e58-c0de-571e-a48e-47bb7725736d'::uuid, DATE '2026-05-14', 'Fiestas de Rivas', 'CLINICA'::public.vacaciones_festivo_tipo),
      ('69c5e2c2-8e2e-5a69-9bfe-d801beaa2416'::uuid, DATE '2026-05-15', 'San Isidro', 'LOCAL'::public.vacaciones_festivo_tipo),
      ('3e7b8fbd-87d1-5075-87a5-5690b95da8f4'::uuid, DATE '2026-08-15', 'Asunción de la Virgen', 'NACIONAL'::public.vacaciones_festivo_tipo),
      ('f1739156-df80-5491-a764-32f65a4928a8'::uuid, DATE '2026-10-12', 'Fiesta Nacional', 'NACIONAL'::public.vacaciones_festivo_tipo),
      ('e01f0898-ef4f-5ca4-a4db-728d2b9c1df5'::uuid, DATE '2026-11-02', 'Todos los Santos', 'AUTONOMICO'::public.vacaciones_festivo_tipo),
      ('d36a7f6e-b1a4-5bbc-833b-83743e8ad58c'::uuid, DATE '2026-12-07', 'Día de la Constitución', 'AUTONOMICO'::public.vacaciones_festivo_tipo),
      ('b62541d8-75dc-50e6-9686-e04f93222249'::uuid, DATE '2026-12-08', 'Inmaculada Concepción', 'NACIONAL'::public.vacaciones_festivo_tipo),
      ('8495f126-2e40-5a06-8513-453d54166472'::uuid, DATE '2026-12-25', 'Navidad', 'NACIONAL'::public.vacaciones_festivo_tipo)
    )
    SELECT COUNT(*) INTO v_fest_mismatch
    FROM esperado e
    JOIN public.vacaciones_festivos r ON r.id = e.id
    WHERE r.fecha IS DISTINCT FROM e.fecha
       OR r.nombre IS DISTINCT FROM e.nombre
       OR r.tipo IS DISTINCT FROM e.tipo
       OR r.centro_id IS DISTINCT FROM v_centro;

    WITH esperado(id, trabajador_id, fecha_inicio, fecha_fin, tipo) AS (VALUES
      ('d5247899-26d8-5024-afe9-eb4b1a928de9'::uuid, 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5'::uuid, DATE '2026-04-10', DATE '2026-04-10', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('749273f8-e630-5c2a-a4ee-b50b27cb40d1'::uuid, 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5'::uuid, DATE '2026-04-14', DATE '2026-04-14', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('fee3089b-83c5-5aba-a10e-f76810d7989e'::uuid, 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5'::uuid, DATE '2026-04-29', DATE '2026-04-30', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('890b2e1c-5454-5b7b-b8d1-f2af2139922c'::uuid, '0fac149e-1430-5359-93b0-6cf1c60cdf85'::uuid, DATE '2026-05-08', DATE '2026-05-08', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('3e2227d8-8c8c-5194-bf05-9e943caa835f'::uuid, 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e'::uuid, DATE '2026-05-18', DATE '2026-05-22', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('40873a92-dcf2-57d7-aa7c-aeebf2113a37'::uuid, 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5'::uuid, DATE '2026-06-02', DATE '2026-06-02', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('2bc1f0ff-b393-56b0-934b-54ebb366e5c1'::uuid, '39d32de2-8994-5497-8325-93d7872cecdd'::uuid, DATE '2026-06-18', DATE '2026-06-18', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('f63ab11f-6343-5b44-b2d1-6cf5d41e334d'::uuid, 'd4a6f622-e007-5a67-8290-6abb2b69dcc9'::uuid, DATE '2026-06-18', DATE '2026-06-18', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('880e82a7-562e-5fcd-8db7-f3d054228983'::uuid, '39d32de2-8994-5497-8325-93d7872cecdd'::uuid, DATE '2026-06-19', DATE '2026-06-19', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('edc96055-1e33-5a63-b1e6-afd7035ef05f'::uuid, 'd4a6f622-e007-5a67-8290-6abb2b69dcc9'::uuid, DATE '2026-06-19', DATE '2026-06-19', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('6b710f87-b346-5eab-9790-b4005db6a95d'::uuid, '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, DATE '2026-06-26', DATE '2026-06-26', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('80e487b0-eaf8-58c6-aa4e-5049d064f4a1'::uuid, '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, DATE '2026-06-29', DATE '2026-06-29', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('b6aa67f6-c4ca-546b-a33b-217a216275fc'::uuid, '5c035986-3412-5369-8dfd-d279b8e9662b'::uuid, DATE '2026-06-29', DATE '2026-06-29', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('1cdeb2ef-47fa-50e4-b880-171ac9e0ccef'::uuid, '5c035986-3412-5369-8dfd-d279b8e9662b'::uuid, DATE '2026-06-30', DATE '2026-06-30', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('4d4b6c48-c192-5cfc-823a-9d296eb4f0b9'::uuid, '5c035986-3412-5369-8dfd-d279b8e9662b'::uuid, DATE '2026-07-01', DATE '2026-07-01', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('4f55a3bc-e229-562b-828c-8a0e15c4a46f'::uuid, 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e'::uuid, DATE '2026-07-01', DATE '2026-07-01', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('58cb1a7f-9bb2-5f98-9eb8-3872cdbe7543'::uuid, '5c035986-3412-5369-8dfd-d279b8e9662b'::uuid, DATE '2026-07-02', DATE '2026-07-02', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('4e582d53-707c-5df2-aeb6-faa09721cc37'::uuid, '0fac149e-1430-5359-93b0-6cf1c60cdf85'::uuid, DATE '2026-07-02', DATE '2026-07-02', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('a6df9925-0c45-5190-9f97-15131a5b1d5e'::uuid, '0fac149e-1430-5359-93b0-6cf1c60cdf85'::uuid, DATE '2026-07-03', DATE '2026-07-03', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('8aed9c68-a037-5ad1-aedc-b6bcd021306e'::uuid, '0fac149e-1430-5359-93b0-6cf1c60cdf85'::uuid, DATE '2026-07-06', DATE '2026-07-07', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('90eb426c-e929-54a0-93b0-3722f67756d7'::uuid, 'd4a6f622-e007-5a67-8290-6abb2b69dcc9'::uuid, DATE '2026-07-09', DATE '2026-07-09', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('0888ded0-bbe9-596a-8f8a-2cd9e8deec56'::uuid, '39d32de2-8994-5497-8325-93d7872cecdd'::uuid, DATE '2026-07-09', DATE '2026-07-09', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('6615913b-7a68-510f-add0-76160cb77c97'::uuid, 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e'::uuid, DATE '2026-07-10', DATE '2026-07-10', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('95fd738a-f3e2-5a5c-a81e-b71042cce60e'::uuid, '39d32de2-8994-5497-8325-93d7872cecdd'::uuid, DATE '2026-07-10', DATE '2026-07-10', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('5cf08232-0dc2-575d-8312-96523685a064'::uuid, 'd4a6f622-e007-5a67-8290-6abb2b69dcc9'::uuid, DATE '2026-07-10', DATE '2026-07-10', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('02913cc6-ad9e-5555-8739-9bea4ab6b7fc'::uuid, '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, DATE '2026-07-13', DATE '2026-07-17', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('961d6039-26d9-5423-8e3a-aedd7c1af8b5'::uuid, '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, DATE '2026-07-20', DATE '2026-07-24', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('66210d39-d8ac-574b-adb1-b38b36dc7ba9'::uuid, '39d32de2-8994-5497-8325-93d7872cecdd'::uuid, DATE '2026-07-27', DATE '2026-07-27', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('fbfc4608-bfe6-5e2f-b64e-70043b9b7ce6'::uuid, 'd4a6f622-e007-5a67-8290-6abb2b69dcc9'::uuid, DATE '2026-07-27', DATE '2026-07-27', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('8019114c-25e0-5a2a-8be8-5098879a79a2'::uuid, '39d32de2-8994-5497-8325-93d7872cecdd'::uuid, DATE '2026-07-28', DATE '2026-07-28', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('1f5d8077-4b59-5f1f-bc26-39871487f74c'::uuid, 'd4a6f622-e007-5a67-8290-6abb2b69dcc9'::uuid, DATE '2026-07-28', DATE '2026-07-28', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('da4a28a5-805c-5b9f-abed-648a1e2be6bd'::uuid, 'd4a6f622-e007-5a67-8290-6abb2b69dcc9'::uuid, DATE '2026-07-29', DATE '2026-07-29', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('87d6b58e-bdb6-5d30-b5ce-60dc161e0d5b'::uuid, '39d32de2-8994-5497-8325-93d7872cecdd'::uuid, DATE '2026-07-29', DATE '2026-07-29', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('60cff98b-0c44-5fd4-86e8-10cf765c2d76'::uuid, 'd4a6f622-e007-5a67-8290-6abb2b69dcc9'::uuid, DATE '2026-07-30', DATE '2026-07-30', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('99ef5785-b569-5b18-ac0c-935e761e3815'::uuid, '39d32de2-8994-5497-8325-93d7872cecdd'::uuid, DATE '2026-07-30', DATE '2026-07-30', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('163b8f03-4ec5-536b-ba88-34cf14a63b92'::uuid, 'd4a6f622-e007-5a67-8290-6abb2b69dcc9'::uuid, DATE '2026-07-31', DATE '2026-07-31', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('a599a493-b94c-5aab-93db-04307e8bb409'::uuid, '39d32de2-8994-5497-8325-93d7872cecdd'::uuid, DATE '2026-07-31', DATE '2026-07-31', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('923ba2af-2835-55cc-8dac-0c92b6acae54'::uuid, 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e'::uuid, DATE '2026-08-03', DATE '2026-08-07', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('afe7a189-0177-5320-8db1-9395498644ed'::uuid, '0fac149e-1430-5359-93b0-6cf1c60cdf85'::uuid, DATE '2026-08-07', DATE '2026-08-07', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('5fd69597-6450-567d-8432-25713e2165f2'::uuid, '0fac149e-1430-5359-93b0-6cf1c60cdf85'::uuid, DATE '2026-08-10', DATE '2026-08-14', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('56ef8482-9ec8-5719-8745-15f5b1e52345'::uuid, '0fac149e-1430-5359-93b0-6cf1c60cdf85'::uuid, DATE '2026-08-17', DATE '2026-08-21', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('aa3cc464-4f8a-53e5-a609-4089ef3514df'::uuid, 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5'::uuid, DATE '2026-08-19', DATE '2026-08-21', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('6f157940-e8ec-54d0-aa45-03c5996657bd'::uuid, '0fac149e-1430-5359-93b0-6cf1c60cdf85'::uuid, DATE '2026-08-24', DATE '2026-08-25', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('0ce5b3dd-1771-5ccf-a444-51d941e40079'::uuid, 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5'::uuid, DATE '2026-08-24', DATE '2026-08-28', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('2c15ccff-2d75-560b-89e4-b6bfcfe39605'::uuid, 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e'::uuid, DATE '2026-08-28', DATE '2026-08-28', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('4587b4de-46e0-59e4-bca9-3b90945759fd'::uuid, '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, DATE '2026-08-28', DATE '2026-08-28', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('88fbf591-a1d1-5da1-b60e-df42e0440b48'::uuid, '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, DATE '2026-08-31', DATE '2026-08-31', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('2f57436a-b7dc-5428-b398-859a7dd57819'::uuid, '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, DATE '2026-09-10', DATE '2026-09-10', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('b0644dee-c3c6-5365-b63c-d7dcf77012ab'::uuid, '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, DATE '2026-10-15', DATE '2026-10-15', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('9ae5cf86-c15c-5d0e-80b7-9963f014d071'::uuid, 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e'::uuid, DATE '2026-11-06', DATE '2026-11-06', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('7f505b86-30da-50f3-94bd-b2c5a4476464'::uuid, '0fac149e-1430-5359-93b0-6cf1c60cdf85'::uuid, DATE '2026-11-09', DATE '2026-11-09', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('5c1b7dc6-3fac-5b68-b4af-a114244a1a6b'::uuid, '0fac149e-1430-5359-93b0-6cf1c60cdf85'::uuid, DATE '2026-11-10', DATE '2026-11-10', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('b223e93c-c6ed-5197-bc3b-177324cfe6e1'::uuid, 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e'::uuid, DATE '2026-11-13', DATE '2026-11-13', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('e57c8827-4c9f-506c-b62a-26da9bb1b7c8'::uuid, 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e'::uuid, DATE '2026-11-16', DATE '2026-11-16', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('f5fefb60-ad14-5586-aa1f-958f2c9ce304'::uuid, 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e'::uuid, DATE '2026-11-17', DATE '2026-11-17', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('d9dcb546-b4d5-5365-8f98-4338b2d0dccc'::uuid, '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, DATE '2026-11-19', DATE '2026-11-19', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('d84780cd-3e10-55cb-9148-4388bf200a69'::uuid, '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, DATE '2026-12-09', DATE '2026-12-09', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('24158e38-85df-5272-b5f9-123e42df92fa'::uuid, '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, DATE '2026-12-10', DATE '2026-12-10', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('ffca87cd-ef82-5373-ab0e-9f0e70794109'::uuid, '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, DATE '2026-12-11', DATE '2026-12-11', 'FORMACION'::public.vacaciones_periodo_tipo),
      ('c37167af-c239-5090-addb-ac2ef52b3273'::uuid, 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e'::uuid, DATE '2026-12-21', DATE '2026-12-24', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('6a7e27b6-4aaa-57d2-935c-928f92f8f7c8'::uuid, 'd4a6f622-e007-5a67-8290-6abb2b69dcc9'::uuid, DATE '2026-12-21', DATE '2026-12-21', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('538ad5d9-801b-5604-8d45-a10e1c2818d1'::uuid, '39d32de2-8994-5497-8325-93d7872cecdd'::uuid, DATE '2026-12-21', DATE '2026-12-21', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('15c926d6-8dc1-5eed-a82d-bead507fe066'::uuid, '39d32de2-8994-5497-8325-93d7872cecdd'::uuid, DATE '2026-12-22', DATE '2026-12-22', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('a401f265-8fb7-59a2-9610-4b5158a04da3'::uuid, 'd4a6f622-e007-5a67-8290-6abb2b69dcc9'::uuid, DATE '2026-12-22', DATE '2026-12-22', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('dba00e1f-d772-5ae3-89de-07348592b5ba'::uuid, 'd4a6f622-e007-5a67-8290-6abb2b69dcc9'::uuid, DATE '2026-12-23', DATE '2026-12-23', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('72b220c6-0b6f-5424-b6e5-a522f60fdbac'::uuid, '39d32de2-8994-5497-8325-93d7872cecdd'::uuid, DATE '2026-12-23', DATE '2026-12-23', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('2cff2329-9bff-5a49-8b9a-a1f5a784be16'::uuid, '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, DATE '2026-12-24', DATE '2026-12-24', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('ebf1e4ee-15a8-574f-ad04-f9a52aa8ce95'::uuid, '0fac149e-1430-5359-93b0-6cf1c60cdf85'::uuid, DATE '2026-12-24', DATE '2026-12-24', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('157f3b7f-96e2-5f18-bc04-56c4794bf193'::uuid, 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5'::uuid, DATE '2026-12-24', DATE '2026-12-24', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('43ceeff7-15c7-51a0-8687-9b7b609ec6f4'::uuid, '5c035986-3412-5369-8dfd-d279b8e9662b'::uuid, DATE '2026-12-24', DATE '2026-12-24', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('7a272758-f2bb-596e-b80a-4afcfccdeb7a'::uuid, 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5'::uuid, DATE '2026-12-28', DATE '2026-12-31', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('e53467e4-259d-5927-b863-281e050de44e'::uuid, '0fac149e-1430-5359-93b0-6cf1c60cdf85'::uuid, DATE '2026-12-28', DATE '2026-12-31', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('34af1fe2-6095-5a70-aa55-be14ee9cc881'::uuid, '50ec7d41-b17f-553e-bb20-69ec996448c1'::uuid, DATE '2026-12-28', DATE '2026-12-31', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('b20b3e7c-c943-590a-a1bc-796fd7e1295d'::uuid, '5c035986-3412-5369-8dfd-d279b8e9662b'::uuid, DATE '2026-12-31', DATE '2026-12-31', 'VACACIONES'::public.vacaciones_periodo_tipo),
      ('13253607-7d67-5658-81a6-693a71b64f67'::uuid, 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e'::uuid, DATE '2026-12-31', DATE '2026-12-31', 'VACACIONES'::public.vacaciones_periodo_tipo)
    )
    SELECT COUNT(*) INTO v_per_mismatch
    FROM esperado e
    JOIN public.vacaciones_periodos r ON r.id = e.id
    WHERE r.trabajador_id IS DISTINCT FROM e.trabajador_id
       OR r.fecha_inicio IS DISTINCT FROM e.fecha_inicio
       OR r.fecha_fin IS DISTINCT FROM e.fecha_fin
       OR r.tipo IS DISTINCT FROM e.tipo
       OR r.centro_id IS DISTINCT FROM v_centro;

    IF v_trab_mismatch = 0 AND v_fest_mismatch = 0 AND v_per_mismatch = 0 THEN
      RAISE NOTICE 'Vacaciones ya migrado; no se hace nada';
      RETURN;
    ELSE
      RAISE EXCEPTION 'MIGRACION_VACACIONES_ESTADO_INCONSISTENTE: los IDs esperados existen pero los datos no coinciden (trabajadores incoherentes=%, festivos incoherentes=%, periodos incoherentes=%). Revisar manualmente.',
        v_trab_mismatch, v_fest_mismatch, v_per_mismatch;
    END IF;

  ELSE
    RAISE EXCEPTION 'MIGRACION_VACACIONES_ESTADO_INCONSISTENTE: estado parcial (trabajadores %/7, festivos %/14, periodos %/75 IDs esperados presentes). Revisar manualmente: no se ejecuta ni se asume nada.',
      v_existing_trab, v_existing_fest, v_existing_per;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- Caso A: migración completa
  -- ══════════════════════════════════════════════════════════════════════

  -- ── Trabajadores ────────────────────────────────────────────────────
  INSERT INTO public.vacaciones_trabajadores (id, nombre, color, dias_anuales, orden, usuario_id, centro_id, created_by, updated_by)
    VALUES ('39d32de2-8994-5497-8325-93d7872cecdd', 'Andrés', '#183B5F', 25, 1, 'dd87f885-8b49-4b25-9592-a5e49c08c746', v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_trabajadores (id, nombre, color, dias_anuales, orden, usuario_id, centro_id, created_by, updated_by)
    VALUES ('d4a6f622-e007-5a67-8290-6abb2b69dcc9', 'Celia', '#F18852', 25, 2, 'dd87f885-8b49-4b25-9592-a5e49c08c746', v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_trabajadores (id, nombre, color, dias_anuales, orden, usuario_id, centro_id, created_by, updated_by)
    VALUES ('b46e7620-0ce4-5c34-b0fd-984fb3d68e6e', 'Sara', '#94C0D4', 25, 3, 'e2179d43-1e03-42a1-a97e-31e18fea574f', v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_trabajadores (id, nombre, color, dias_anuales, orden, usuario_id, centro_id, created_by, updated_by)
    VALUES ('50ec7d41-b17f-553e-bb20-69ec996448c1', 'Paula', '#F5CA77', 25, 4, 'cbfd01b3-c706-4b49-8ea3-38d4e0ed327d', v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_trabajadores (id, nombre, color, dias_anuales, orden, usuario_id, centro_id, created_by, updated_by)
    VALUES ('0fac149e-1430-5359-93b0-6cf1c60cdf85', 'Belén', '#7BA05B', 25, 5, '278ac8f4-7e96-47fb-8fd7-6da911e6e4d0', v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_trabajadores (id, nombre, color, dias_anuales, orden, usuario_id, centro_id, created_by, updated_by)
    VALUES ('a4b0fb70-c31e-5196-b62a-ae24e2e35ea5', 'Álvaro', '#B86BB0', 21, 6, '1b434a7d-1031-4325-af57-a8d7c64f6c48', v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_trabajadores (id, nombre, color, dias_anuales, orden, usuario_id, centro_id, created_by, updated_by)
    VALUES ('5c035986-3412-5369-8dfd-d279b8e9662b', 'Patricia', '#E0607E', 15, 7, 'afb7958e-c069-45fc-a819-d2fff7d2e529', v_centro, v_actor, v_actor);

  -- ── Festivos ────────────────────────────────────────────────────────
  INSERT INTO public.vacaciones_festivos (id, fecha, nombre, tipo, centro_id, created_by, updated_by)
    VALUES ('56655835-2487-5b4c-85b9-8cd5aa333ae5', DATE '2026-01-01', 'Año Nuevo', 'NACIONAL'::public.vacaciones_festivo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_festivos (id, fecha, nombre, tipo, centro_id, created_by, updated_by)
    VALUES ('d7fc90e7-0a8b-52aa-a8a8-e712c5cf9980', DATE '2026-01-06', 'Epifanía / Reyes', 'NACIONAL'::public.vacaciones_festivo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_festivos (id, fecha, nombre, tipo, centro_id, created_by, updated_by)
    VALUES ('44a380b9-7202-539e-825c-2211f495ecf9', DATE '2026-04-02', 'Jueves Santo', 'AUTONOMICO'::public.vacaciones_festivo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_festivos (id, fecha, nombre, tipo, centro_id, created_by, updated_by)
    VALUES ('bd4671f1-118a-527d-b0e3-44e97ca08da2', DATE '2026-04-03', 'Viernes Santo', 'NACIONAL'::public.vacaciones_festivo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_festivos (id, fecha, nombre, tipo, centro_id, created_by, updated_by)
    VALUES ('f202c1f1-6d52-52d0-9a76-e223ea1310fc', DATE '2026-05-01', 'Día del Trabajo', 'NACIONAL'::public.vacaciones_festivo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_festivos (id, fecha, nombre, tipo, centro_id, created_by, updated_by)
    VALUES ('5afbd440-729c-5781-ad07-0859bd9a1408', DATE '2026-05-02', 'Día de la Comunidad de Madrid', 'AUTONOMICO'::public.vacaciones_festivo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_festivos (id, fecha, nombre, tipo, centro_id, created_by, updated_by)
    VALUES ('7b548e58-c0de-571e-a48e-47bb7725736d', DATE '2026-05-14', 'Fiestas de Rivas', 'CLINICA'::public.vacaciones_festivo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_festivos (id, fecha, nombre, tipo, centro_id, created_by, updated_by)
    VALUES ('69c5e2c2-8e2e-5a69-9bfe-d801beaa2416', DATE '2026-05-15', 'San Isidro', 'LOCAL'::public.vacaciones_festivo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_festivos (id, fecha, nombre, tipo, centro_id, created_by, updated_by)
    VALUES ('3e7b8fbd-87d1-5075-87a5-5690b95da8f4', DATE '2026-08-15', 'Asunción de la Virgen', 'NACIONAL'::public.vacaciones_festivo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_festivos (id, fecha, nombre, tipo, centro_id, created_by, updated_by)
    VALUES ('f1739156-df80-5491-a764-32f65a4928a8', DATE '2026-10-12', 'Fiesta Nacional', 'NACIONAL'::public.vacaciones_festivo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_festivos (id, fecha, nombre, tipo, centro_id, created_by, updated_by)
    VALUES ('e01f0898-ef4f-5ca4-a4db-728d2b9c1df5', DATE '2026-11-02', 'Todos los Santos', 'AUTONOMICO'::public.vacaciones_festivo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_festivos (id, fecha, nombre, tipo, centro_id, created_by, updated_by)
    VALUES ('d36a7f6e-b1a4-5bbc-833b-83743e8ad58c', DATE '2026-12-07', 'Día de la Constitución', 'AUTONOMICO'::public.vacaciones_festivo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_festivos (id, fecha, nombre, tipo, centro_id, created_by, updated_by)
    VALUES ('b62541d8-75dc-50e6-9686-e04f93222249', DATE '2026-12-08', 'Inmaculada Concepción', 'NACIONAL'::public.vacaciones_festivo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_festivos (id, fecha, nombre, tipo, centro_id, created_by, updated_by)
    VALUES ('8495f126-2e40-5a06-8513-453d54166472', DATE '2026-12-25', 'Navidad', 'NACIONAL'::public.vacaciones_festivo_tipo, v_centro, v_actor, v_actor);

  -- ── Períodos (75) ───────────────────────────────────────────────────
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('d5247899-26d8-5024-afe9-eb4b1a928de9', 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5', DATE '2026-04-10', DATE '2026-04-10', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('749273f8-e630-5c2a-a4ee-b50b27cb40d1', 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5', DATE '2026-04-14', DATE '2026-04-14', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('fee3089b-83c5-5aba-a10e-f76810d7989e', 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5', DATE '2026-04-29', DATE '2026-04-30', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('890b2e1c-5454-5b7b-b8d1-f2af2139922c', '0fac149e-1430-5359-93b0-6cf1c60cdf85', DATE '2026-05-08', DATE '2026-05-08', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('3e2227d8-8c8c-5194-bf05-9e943caa835f', 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e', DATE '2026-05-18', DATE '2026-05-22', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('40873a92-dcf2-57d7-aa7c-aeebf2113a37', 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5', DATE '2026-06-02', DATE '2026-06-02', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('2bc1f0ff-b393-56b0-934b-54ebb366e5c1', '39d32de2-8994-5497-8325-93d7872cecdd', DATE '2026-06-18', DATE '2026-06-18', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('f63ab11f-6343-5b44-b2d1-6cf5d41e334d', 'd4a6f622-e007-5a67-8290-6abb2b69dcc9', DATE '2026-06-18', DATE '2026-06-18', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('880e82a7-562e-5fcd-8db7-f3d054228983', '39d32de2-8994-5497-8325-93d7872cecdd', DATE '2026-06-19', DATE '2026-06-19', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('edc96055-1e33-5a63-b1e6-afd7035ef05f', 'd4a6f622-e007-5a67-8290-6abb2b69dcc9', DATE '2026-06-19', DATE '2026-06-19', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('6b710f87-b346-5eab-9790-b4005db6a95d', '50ec7d41-b17f-553e-bb20-69ec996448c1', DATE '2026-06-26', DATE '2026-06-26', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('80e487b0-eaf8-58c6-aa4e-5049d064f4a1', '50ec7d41-b17f-553e-bb20-69ec996448c1', DATE '2026-06-29', DATE '2026-06-29', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('b6aa67f6-c4ca-546b-a33b-217a216275fc', '5c035986-3412-5369-8dfd-d279b8e9662b', DATE '2026-06-29', DATE '2026-06-29', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('1cdeb2ef-47fa-50e4-b880-171ac9e0ccef', '5c035986-3412-5369-8dfd-d279b8e9662b', DATE '2026-06-30', DATE '2026-06-30', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('4d4b6c48-c192-5cfc-823a-9d296eb4f0b9', '5c035986-3412-5369-8dfd-d279b8e9662b', DATE '2026-07-01', DATE '2026-07-01', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('4f55a3bc-e229-562b-828c-8a0e15c4a46f', 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e', DATE '2026-07-01', DATE '2026-07-01', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('58cb1a7f-9bb2-5f98-9eb8-3872cdbe7543', '5c035986-3412-5369-8dfd-d279b8e9662b', DATE '2026-07-02', DATE '2026-07-02', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('4e582d53-707c-5df2-aeb6-faa09721cc37', '0fac149e-1430-5359-93b0-6cf1c60cdf85', DATE '2026-07-02', DATE '2026-07-02', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('a6df9925-0c45-5190-9f97-15131a5b1d5e', '0fac149e-1430-5359-93b0-6cf1c60cdf85', DATE '2026-07-03', DATE '2026-07-03', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('8aed9c68-a037-5ad1-aedc-b6bcd021306e', '0fac149e-1430-5359-93b0-6cf1c60cdf85', DATE '2026-07-06', DATE '2026-07-07', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('90eb426c-e929-54a0-93b0-3722f67756d7', 'd4a6f622-e007-5a67-8290-6abb2b69dcc9', DATE '2026-07-09', DATE '2026-07-09', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('0888ded0-bbe9-596a-8f8a-2cd9e8deec56', '39d32de2-8994-5497-8325-93d7872cecdd', DATE '2026-07-09', DATE '2026-07-09', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('6615913b-7a68-510f-add0-76160cb77c97', 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e', DATE '2026-07-10', DATE '2026-07-10', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('95fd738a-f3e2-5a5c-a81e-b71042cce60e', '39d32de2-8994-5497-8325-93d7872cecdd', DATE '2026-07-10', DATE '2026-07-10', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('5cf08232-0dc2-575d-8312-96523685a064', 'd4a6f622-e007-5a67-8290-6abb2b69dcc9', DATE '2026-07-10', DATE '2026-07-10', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('02913cc6-ad9e-5555-8739-9bea4ab6b7fc', '50ec7d41-b17f-553e-bb20-69ec996448c1', DATE '2026-07-13', DATE '2026-07-17', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('961d6039-26d9-5423-8e3a-aedd7c1af8b5', '50ec7d41-b17f-553e-bb20-69ec996448c1', DATE '2026-07-20', DATE '2026-07-24', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('66210d39-d8ac-574b-adb1-b38b36dc7ba9', '39d32de2-8994-5497-8325-93d7872cecdd', DATE '2026-07-27', DATE '2026-07-27', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('fbfc4608-bfe6-5e2f-b64e-70043b9b7ce6', 'd4a6f622-e007-5a67-8290-6abb2b69dcc9', DATE '2026-07-27', DATE '2026-07-27', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('8019114c-25e0-5a2a-8be8-5098879a79a2', '39d32de2-8994-5497-8325-93d7872cecdd', DATE '2026-07-28', DATE '2026-07-28', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('1f5d8077-4b59-5f1f-bc26-39871487f74c', 'd4a6f622-e007-5a67-8290-6abb2b69dcc9', DATE '2026-07-28', DATE '2026-07-28', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('da4a28a5-805c-5b9f-abed-648a1e2be6bd', 'd4a6f622-e007-5a67-8290-6abb2b69dcc9', DATE '2026-07-29', DATE '2026-07-29', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('87d6b58e-bdb6-5d30-b5ce-60dc161e0d5b', '39d32de2-8994-5497-8325-93d7872cecdd', DATE '2026-07-29', DATE '2026-07-29', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('60cff98b-0c44-5fd4-86e8-10cf765c2d76', 'd4a6f622-e007-5a67-8290-6abb2b69dcc9', DATE '2026-07-30', DATE '2026-07-30', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('99ef5785-b569-5b18-ac0c-935e761e3815', '39d32de2-8994-5497-8325-93d7872cecdd', DATE '2026-07-30', DATE '2026-07-30', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('163b8f03-4ec5-536b-ba88-34cf14a63b92', 'd4a6f622-e007-5a67-8290-6abb2b69dcc9', DATE '2026-07-31', DATE '2026-07-31', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('a599a493-b94c-5aab-93db-04307e8bb409', '39d32de2-8994-5497-8325-93d7872cecdd', DATE '2026-07-31', DATE '2026-07-31', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('923ba2af-2835-55cc-8dac-0c92b6acae54', 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e', DATE '2026-08-03', DATE '2026-08-07', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('afe7a189-0177-5320-8db1-9395498644ed', '0fac149e-1430-5359-93b0-6cf1c60cdf85', DATE '2026-08-07', DATE '2026-08-07', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('5fd69597-6450-567d-8432-25713e2165f2', '0fac149e-1430-5359-93b0-6cf1c60cdf85', DATE '2026-08-10', DATE '2026-08-14', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('56ef8482-9ec8-5719-8745-15f5b1e52345', '0fac149e-1430-5359-93b0-6cf1c60cdf85', DATE '2026-08-17', DATE '2026-08-21', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('aa3cc464-4f8a-53e5-a609-4089ef3514df', 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5', DATE '2026-08-19', DATE '2026-08-21', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('6f157940-e8ec-54d0-aa45-03c5996657bd', '0fac149e-1430-5359-93b0-6cf1c60cdf85', DATE '2026-08-24', DATE '2026-08-25', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('0ce5b3dd-1771-5ccf-a444-51d941e40079', 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5', DATE '2026-08-24', DATE '2026-08-28', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('2c15ccff-2d75-560b-89e4-b6bfcfe39605', 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e', DATE '2026-08-28', DATE '2026-08-28', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('4587b4de-46e0-59e4-bca9-3b90945759fd', '50ec7d41-b17f-553e-bb20-69ec996448c1', DATE '2026-08-28', DATE '2026-08-28', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('88fbf591-a1d1-5da1-b60e-df42e0440b48', '50ec7d41-b17f-553e-bb20-69ec996448c1', DATE '2026-08-31', DATE '2026-08-31', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('2f57436a-b7dc-5428-b398-859a7dd57819', '50ec7d41-b17f-553e-bb20-69ec996448c1', DATE '2026-09-10', DATE '2026-09-10', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('b0644dee-c3c6-5365-b63c-d7dcf77012ab', '50ec7d41-b17f-553e-bb20-69ec996448c1', DATE '2026-10-15', DATE '2026-10-15', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('9ae5cf86-c15c-5d0e-80b7-9963f014d071', 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e', DATE '2026-11-06', DATE '2026-11-06', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('7f505b86-30da-50f3-94bd-b2c5a4476464', '0fac149e-1430-5359-93b0-6cf1c60cdf85', DATE '2026-11-09', DATE '2026-11-09', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('5c1b7dc6-3fac-5b68-b4af-a114244a1a6b', '0fac149e-1430-5359-93b0-6cf1c60cdf85', DATE '2026-11-10', DATE '2026-11-10', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('b223e93c-c6ed-5197-bc3b-177324cfe6e1', 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e', DATE '2026-11-13', DATE '2026-11-13', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('e57c8827-4c9f-506c-b62a-26da9bb1b7c8', 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e', DATE '2026-11-16', DATE '2026-11-16', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('f5fefb60-ad14-5586-aa1f-958f2c9ce304', 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e', DATE '2026-11-17', DATE '2026-11-17', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('d9dcb546-b4d5-5365-8f98-4338b2d0dccc', '50ec7d41-b17f-553e-bb20-69ec996448c1', DATE '2026-11-19', DATE '2026-11-19', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('d84780cd-3e10-55cb-9148-4388bf200a69', '50ec7d41-b17f-553e-bb20-69ec996448c1', DATE '2026-12-09', DATE '2026-12-09', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('24158e38-85df-5272-b5f9-123e42df92fa', '50ec7d41-b17f-553e-bb20-69ec996448c1', DATE '2026-12-10', DATE '2026-12-10', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('ffca87cd-ef82-5373-ab0e-9f0e70794109', '50ec7d41-b17f-553e-bb20-69ec996448c1', DATE '2026-12-11', DATE '2026-12-11', 'FORMACION'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('c37167af-c239-5090-addb-ac2ef52b3273', 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e', DATE '2026-12-21', DATE '2026-12-24', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('6a7e27b6-4aaa-57d2-935c-928f92f8f7c8', 'd4a6f622-e007-5a67-8290-6abb2b69dcc9', DATE '2026-12-21', DATE '2026-12-21', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('538ad5d9-801b-5604-8d45-a10e1c2818d1', '39d32de2-8994-5497-8325-93d7872cecdd', DATE '2026-12-21', DATE '2026-12-21', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('15c926d6-8dc1-5eed-a82d-bead507fe066', '39d32de2-8994-5497-8325-93d7872cecdd', DATE '2026-12-22', DATE '2026-12-22', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('a401f265-8fb7-59a2-9610-4b5158a04da3', 'd4a6f622-e007-5a67-8290-6abb2b69dcc9', DATE '2026-12-22', DATE '2026-12-22', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('dba00e1f-d772-5ae3-89de-07348592b5ba', 'd4a6f622-e007-5a67-8290-6abb2b69dcc9', DATE '2026-12-23', DATE '2026-12-23', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('72b220c6-0b6f-5424-b6e5-a522f60fdbac', '39d32de2-8994-5497-8325-93d7872cecdd', DATE '2026-12-23', DATE '2026-12-23', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('2cff2329-9bff-5a49-8b9a-a1f5a784be16', '50ec7d41-b17f-553e-bb20-69ec996448c1', DATE '2026-12-24', DATE '2026-12-24', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('ebf1e4ee-15a8-574f-ad04-f9a52aa8ce95', '0fac149e-1430-5359-93b0-6cf1c60cdf85', DATE '2026-12-24', DATE '2026-12-24', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('157f3b7f-96e2-5f18-bc04-56c4794bf193', 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5', DATE '2026-12-24', DATE '2026-12-24', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('43ceeff7-15c7-51a0-8687-9b7b609ec6f4', '5c035986-3412-5369-8dfd-d279b8e9662b', DATE '2026-12-24', DATE '2026-12-24', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('7a272758-f2bb-596e-b80a-4afcfccdeb7a', 'a4b0fb70-c31e-5196-b62a-ae24e2e35ea5', DATE '2026-12-28', DATE '2026-12-31', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('e53467e4-259d-5927-b863-281e050de44e', '0fac149e-1430-5359-93b0-6cf1c60cdf85', DATE '2026-12-28', DATE '2026-12-31', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('34af1fe2-6095-5a70-aa55-be14ee9cc881', '50ec7d41-b17f-553e-bb20-69ec996448c1', DATE '2026-12-28', DATE '2026-12-31', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('b20b3e7c-c943-590a-a1bc-796fd7e1295d', '5c035986-3412-5369-8dfd-d279b8e9662b', DATE '2026-12-31', DATE '2026-12-31', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);
  INSERT INTO public.vacaciones_periodos (id, trabajador_id, fecha_inicio, fecha_fin, tipo, centro_id, created_by, updated_by)
    VALUES ('13253607-7d67-5658-81a6-693a71b64f67', 'b46e7620-0ce4-5c34-b0fd-984fb3d68e6e', DATE '2026-12-31', DATE '2026-12-31', 'VACACIONES'::public.vacaciones_periodo_tipo, v_centro, v_actor, v_actor);

  -- ── Verificación dentro de la misma transacción ────────────────────────
  SELECT COUNT(*) INTO v_trab_n FROM public.vacaciones_trabajadores WHERE id = ANY(v_trab_ids);
  SELECT COUNT(*) INTO v_fest_n FROM public.vacaciones_festivos     WHERE id = ANY(v_fest_ids);
  SELECT COUNT(*) INTO v_per_n  FROM public.vacaciones_periodos    WHERE id = ANY(v_per_ids);

  IF v_trab_n <> 7 THEN RAISE EXCEPTION 'MIGRACION_VACACIONES: se esperaban 7 trabajadores, hay %', v_trab_n; END IF;
  IF v_fest_n <> 14 THEN RAISE EXCEPTION 'MIGRACION_VACACIONES: se esperaban 14 festivos, hay %', v_fest_n; END IF;
  IF v_per_n  <> 75 THEN RAISE EXCEPTION 'MIGRACION_VACACIONES: se esperaban 75 periodos, hay %', v_per_n; END IF;

  RAISE NOTICE 'Vacaciones migrado: % trabajadores, % festivos, % periodos.', v_trab_n, v_fest_n, v_per_n;
END $$;

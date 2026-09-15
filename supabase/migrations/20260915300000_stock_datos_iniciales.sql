-- ============================================================================
-- MIGRACIÓN: Stock — datos iniciales (inventario del sistema antiguo)
-- Fecha: 2026-09-15
--
-- Traslada el inventario real de /controlstock/ a ClinicOS:
--   2 categorías de nivel 1 · 8 de nivel 2 · 43 productos · 148 unidades
--
-- El stock NO se inserta como columna: los productos nacen con stock_actual = 0
-- y el saldo entra mediante registrar_movimiento_stock() con AJUSTE_POSITIVO y
-- motivo INVENTARIO_INICIAL_MIGRACION. La protección de Fase 1 impide
-- cualquier atajo (no hay INSERT directo en stock_movimientos).
--
-- IDS DETERMINISTAS
-- ------------------
-- Cada categoría y producto usa un UUID calculado con uuid5 sobre un
-- namespace fijo del proyecto y el id ORIGINAL del sistema antiguo
-- (ej. 'gasas', 'g_esteril', 'consulta' — verificados únicos: 43/43 y 10/10
-- sin colisiones). Son reproducibles: recalcularlos con el mismo seed
-- siempre da el mismo UUID. Esto permite un guard de idempotencia exacto,
-- por identidad de fila, no por recuento genérico.
--
-- GUARD DE IDEMPOTENCIA — tres casos
-- ------------------------------------
--   A) Ninguno de los 53 IDs esperados existe        -> migrar
--   B) Los 53 existen Y sus datos + movimientos       -> ya migrado, no hacer nada
--      coinciden exactamente con lo esperado
--   C) Cualquier otra combinación (parcial, o IDs        -> ABORTAR
--      presentes con datos que no coinciden)             STOCK_MIGRACION_ESTADO_INCONSISTENTE
--
-- No se asume "hay datos, luego ya se migró": se verifica que son
-- EXACTAMENTE estos datos.
-- ============================================================================

DO $$
DECLARE
  v_centro  UUID;
  v_actor   UUID;
  v_usuario UUID;

  -- IDs deterministas de las 10 categorías esperadas
  v_cat_ids UUID[] := ARRAY[
    '3fef637f-c6c5-5c9b-9479-b45e6c8c45c1'::uuid,
    '02a2e11e-88da-5a88-992f-a8e645533e20'::uuid,
    'c3c7ddd3-c18c-5e7c-b809-4afb74c0faca'::uuid,
    '5034352c-3f0b-5fe9-b8fb-22d7014fd6b9'::uuid,
    'df06a762-d45b-586c-86d8-23c8bd34ebe3'::uuid,
    '7ae2958a-abe0-5f17-a719-3bbe535b7fe8'::uuid,
    'acb801fc-5db8-51d9-a2f7-35452be3ba6a'::uuid,
    '6fa81a79-2725-513b-bcec-6782cae00748'::uuid,
    '9fc37c07-d708-5768-8d47-77e6436b7036'::uuid,
    'a9052895-d369-5954-bb81-f0ef3d3f3577'::uuid
  ];

  -- IDs deterministas de los 43 productos esperados
  v_prod_ids UUID[] := ARRAY[
    '85119868-4741-5f80-9df4-2e57c2f662e0'::uuid,
    '19222d0f-9248-5b50-bfc0-a8cebaddb07d'::uuid,
    '165dd7ac-6cbf-5de4-b4b0-6e7c012598f1'::uuid,
    'b82437c1-29b9-5370-a282-6d4ece28f33c'::uuid,
    'b1a14346-eb86-53ce-9ccb-ac80ce3a677a'::uuid,
    '624ba746-2480-591f-bbc9-b3c29c51a651'::uuid,
    '53bd7bcd-34f8-538d-a2f1-10e89c5bd1b8'::uuid,
    '0cb1f95f-a22b-561d-80e9-aed07f7fb88e'::uuid,
    'db3aac15-3e70-5f2c-b011-b1ff13be8c5b'::uuid,
    '78abefa0-e724-59ea-a652-b72b7a5e4bbf'::uuid,
    'a01d4932-62c4-552e-b1ce-e1fe85be05aa'::uuid,
    'ef035cc0-815e-565b-adad-58ce72b967c2'::uuid,
    'c6fdba66-9e02-5136-b139-9541737bc3fe'::uuid,
    '0fe09b7f-0cad-5291-94ea-fb670b778bb4'::uuid,
    'c6824051-2ea1-5b6f-a8d3-de6a6709cd15'::uuid,
    '9bbe6152-4ab8-5faa-9d84-e51455be8d5b'::uuid,
    '2cecac23-7be0-57b8-ba1e-8ad2caf63186'::uuid,
    'b6246acd-77a7-58d2-ae54-80f00d52ad26'::uuid,
    '44bf3407-9666-5df3-9dc3-da510c73175e'::uuid,
    '7b312a94-159c-5076-bdd3-438a2e05c4fc'::uuid,
    '8218b90b-3086-5cea-ac7d-9b2f06ddd5aa'::uuid,
    '3d848533-2d4b-57a5-8c79-98abb01b89d5'::uuid,
    'd5742b62-f4b5-5693-9794-f3aa80566b22'::uuid,
    'b65129c6-8673-57bb-89c8-f6f28622c74e'::uuid,
    '75cd7d7d-1581-5a9c-9fc0-abf016f97db8'::uuid,
    'f24027a1-cd78-5da6-afbf-f9c782bc636b'::uuid,
    '3904d696-288a-5aff-9409-4dd1b37ca11a'::uuid,
    '1ab80956-a525-5560-97d6-c85f84f1c555'::uuid,
    'beb2401a-14ed-534e-becf-d1be55f667b3'::uuid,
    '46466fd4-ce51-5f87-961b-8ace838e75fd'::uuid,
    'e29b347f-bdfb-5fe1-9758-4b0d0bd5575c'::uuid,
    '4901830d-bb2d-5b35-bd9e-3d19d3704795'::uuid,
    '34af5e1a-52b6-5889-95d5-ec20748b5978'::uuid,
    'fd668100-9b95-582e-9268-82759df28bd4'::uuid,
    'c2df7d67-2dbc-56b6-8208-4e5337de2445'::uuid,
    '087e634e-98ad-5300-95bb-028062969d84'::uuid,
    'e939c0e8-3ded-5734-8bdd-0082f7794065'::uuid,
    'f85314d7-d631-5547-9094-2addd0d96e29'::uuid,
    'b030d502-37ec-5e14-acd0-61cf1eb124f0'::uuid,
    'e38385e9-9997-5ba9-a0d1-5ea43c282054'::uuid,
    'f28a3ab4-3d2f-5f73-98e8-c78514dcee31'::uuid,
    'd70e6eed-6aaf-5436-89ec-34589134b47a'::uuid,
    '742a387e-f38f-5082-a0d0-cc8dbc9f257d'::uuid
  ];

  v_existing_cats  INT;
  v_existing_prods INT;
  v_cat_mismatch   INT;
  v_prod_mismatch  INT;
  v_mov_mismatch   INT;
  v_stock_sum      INT;
  v_cat_n INT; v_prod_n INT; v_mov_n INT;
BEGIN
  -- ── Maestros (resueltos por valor, sin UUID inventados) ────────────────
  SELECT id INTO v_centro  FROM public.centros          WHERE nombre = 'Podología y Biomecánica Rivas';
  SELECT id INTO v_actor   FROM public.usuarios_sistema WHERE nombre = 'SISTEMA_CRON';
  SELECT id INTO v_usuario FROM public.usuarios         WHERE email  = 'admin@podologiarivas.com' AND activo;

  IF v_centro  IS NULL THEN RAISE EXCEPTION 'MIGRACION_STOCK: no se encuentra el centro'; END IF;
  IF v_actor   IS NULL THEN RAISE EXCEPTION 'MIGRACION_STOCK: no se encuentra el actor SISTEMA_CRON'; END IF;
  IF v_usuario IS NULL THEN RAISE EXCEPTION 'MIGRACION_STOCK: no se encuentra el usuario administrador'; END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- GUARD: identidad exacta por ID determinista, no COUNT(*) genérico.
  -- ══════════════════════════════════════════════════════════════════════
  SELECT COUNT(*) INTO v_existing_cats  FROM public.stock_categorias WHERE id = ANY(v_cat_ids);
  SELECT COUNT(*) INTO v_existing_prods FROM public.stock_productos  WHERE id = ANY(v_prod_ids);

  IF v_existing_cats = 0 AND v_existing_prods = 0 THEN
    -- Caso A: nada de este dataset existe todavía. Continúa más abajo.
    NULL;

  ELSIF v_existing_cats = 10 AND v_existing_prods = 43 THEN
    -- Caso B candidato: los 53 IDs existen. Verificar que los datos
    -- coinciden EXACTAMENTE antes de darlo por migrado.

    WITH esperado(id, nombre, nivel, padre_id) AS (VALUES
      ('3fef637f-c6c5-5c9b-9479-b45e6c8c45c1'::uuid, 'Consulta', 1, NULL::uuid),
      ('02a2e11e-88da-5a88-992f-a8e645533e20'::uuid, 'Esterilización', 2, '3fef637f-c6c5-5c9b-9479-b45e6c8c45c1'::uuid),
      ('c3c7ddd3-c18c-5e7c-b809-4afb74c0faca'::uuid, 'Material clínico', 2, '3fef637f-c6c5-5c9b-9479-b45e6c8c45c1'::uuid),
      ('5034352c-3f0b-5fe9-b8fb-22d7014fd6b9'::uuid, 'Tratamientos y curas', 2, '3fef637f-c6c5-5c9b-9479-b45e6c8c45c1'::uuid),
      ('df06a762-d45b-586c-86d8-23c8bd34ebe3'::uuid, 'Higiene y recepción', 2, '3fef637f-c6c5-5c9b-9479-b45e6c8c45c1'::uuid),
      ('7ae2958a-abe0-5f17-a719-3bbe535b7fe8'::uuid, 'Taller', 1, NULL::uuid),
      ('acb801fc-5db8-51d9-a2f7-35452be3ba6a'::uuid, 'Materiales base', 2, '7ae2958a-abe0-5f17-a719-3bbe535b7fe8'::uuid),
      ('6fa81a79-2725-513b-bcec-6782cae00748'::uuid, 'Forros y acabados', 2, '7ae2958a-abe0-5f17-a719-3bbe535b7fe8'::uuid),
      ('9fc37c07-d708-5768-8d47-77e6436b7036'::uuid, 'Silicona y órtesis', 2, '7ae2958a-abe0-5f17-a719-3bbe535b7fe8'::uuid),
      ('a9052895-d369-5954-bb81-f0ef3d3f3577'::uuid, 'Consumibles taller', 2, '7ae2958a-abe0-5f17-a719-3bbe535b7fe8'::uuid)
    )
    SELECT COUNT(*) INTO v_cat_mismatch
    FROM esperado e
    JOIN public.stock_categorias r ON r.id = e.id
    WHERE r.nombre    IS DISTINCT FROM e.nombre
       OR r.nivel      IS DISTINCT FROM e.nivel
       OR r.padre_id   IS DISTINCT FROM e.padre_id
       OR r.centro_id  IS DISTINCT FROM v_centro;

    WITH esperado(id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, stock_esperado) AS (VALUES
      ('85119868-4741-5f80-9df4-2e57c2f662e0'::uuid, 'Gasas', 'paquetes', '02a2e11e-88da-5a88-992f-a8e645533e20'::uuid, 5, 2, 'Suministros médicos', 8),
      ('19222d0f-9248-5b50-bfc0-a8cebaddb07d'::uuid, 'Guantes talla S', 'cajas', '02a2e11e-88da-5a88-992f-a8e645533e20'::uuid, 2, 1, 'Suministros médicos', 1),
      ('165dd7ac-6cbf-5de4-b4b0-6e7c012598f1'::uuid, 'Guantes talla M', 'cajas', '02a2e11e-88da-5a88-992f-a8e645533e20'::uuid, 2, 1, 'Suministros médicos', 3),
      ('b82437c1-29b9-5370-a282-6d4ece28f33c'::uuid, 'Guantes talla L', 'cajas', '02a2e11e-88da-5a88-992f-a8e645533e20'::uuid, 2, 1, 'Suministros médicos', 2),
      ('b1a14346-eb86-53ce-9ccb-ac80ce3a677a'::uuid, 'Bolsas esterilización', 'rollos', '02a2e11e-88da-5a88-992f-a8e645533e20'::uuid, 2, 1, 'Autoclave supplies', 2),
      ('624ba746-2480-591f-bbc9-b3c29c51a651'::uuid, 'Tiras control autoclave', 'cajas', '02a2e11e-88da-5a88-992f-a8e645533e20'::uuid, 2, 1, 'Autoclave supplies', 1),
      ('53bd7bcd-34f8-538d-a2f1-10e89c5bd1b8'::uuid, 'Indicadores biológicos', 'unidades', '02a2e11e-88da-5a88-992f-a8e645533e20'::uuid, 3, 1, 'Autoclave supplies', 4),
      ('0cb1f95f-a22b-561d-80e9-aed07f7fb88e'::uuid, 'Líquido ultrasonidos', 'litros', '02a2e11e-88da-5a88-992f-a8e645533e20'::uuid, 2, 1, 'Autoclave supplies', 1),
      ('db3aac15-3e70-5f2c-b011-b1ff13be8c5b'::uuid, 'Agua destilada autoclave', 'garrafas', '02a2e11e-88da-5a88-992f-a8e645533e20'::uuid, 2, 1, 'Supermercado', 2),
      ('78abefa0-e724-59ea-a652-b72b7a5e4bbf'::uuid, 'Hojas bisturí nº23', 'cajas', 'c3c7ddd3-c18c-5e7c-b809-4afb74c0faca'::uuid, 2, 1, 'Suministros médicos', 3),
      ('a01d4932-62c4-552e-b1ce-e1fe85be05aa'::uuid, 'Hojas bisturí nº15', 'cajas', 'c3c7ddd3-c18c-5e7c-b809-4afb74c0faca'::uuid, 2, 1, 'Suministros médicos', 2),
      ('ef035cc0-815e-565b-adad-58ce72b967c2'::uuid, 'Jeringuillas 5ml', 'cajas', 'c3c7ddd3-c18c-5e7c-b809-4afb74c0faca'::uuid, 2, 1, 'Suministros médicos', 1),
      ('c6fdba66-9e02-5136-b139-9541737bc3fe'::uuid, 'Agujas 23G', 'cajas', 'c3c7ddd3-c18c-5e7c-b809-4afb74c0faca'::uuid, 2, 1, 'Suministros médicos', 2),
      ('0fe09b7f-0cad-5291-94ea-fb670b778bb4'::uuid, 'Botes cultivo (tapa roja)', 'unidades', 'c3c7ddd3-c18c-5e7c-b809-4afb74c0faca'::uuid, 5, 2, 'IPMICRO', 6),
      ('c6824051-2ea1-5b6f-a8d3-de6a6709cd15'::uuid, 'Sobres envío TIPSA', 'unidades', 'c3c7ddd3-c18c-5e7c-b809-4afb74c0faca'::uuid, 4, 1, 'TIPSA', 3),
      ('9bbe6152-4ab8-5faa-9d84-e51455be8d5b'::uuid, 'Ácido nítrico', 'unidades', '5034352c-3f0b-5fe9-b8fb-22d7014fd6b9'::uuid, 2, 1, 'Proveedor químico', 2),
      ('2cecac23-7be0-57b8-ba1e-8ad2caf63186'::uuid, 'Alcohol 70º', 'litros', '5034352c-3f0b-5fe9-b8fb-22d7014fd6b9'::uuid, 2, 1, 'Suministros médicos', 3),
      ('b6246acd-77a7-58d2-ae54-80f00d52ad26'::uuid, 'Povidona yodada', 'unidades', '5034352c-3f0b-5fe9-b8fb-22d7014fd6b9'::uuid, 2, 1, 'Suministros médicos', 2),
      ('44bf3407-9666-5df3-9dc3-da510c73175e'::uuid, 'Esparadrapo microporoso', 'rollos', '5034352c-3f0b-5fe9-b8fb-22d7014fd6b9'::uuid, 3, 1, 'Suministros médicos', 4),
      ('7b312a94-159c-5076-bdd3-438a2e05c4fc'::uuid, 'Venda cohesiva', 'unidades', '5034352c-3f0b-5fe9-b8fb-22d7014fd6b9'::uuid, 4, 2, 'Suministros médicos', 5),
      ('8218b90b-3086-5cea-ac7d-9b2f06ddd5aa'::uuid, 'Papel higiénico', 'paquetes', 'df06a762-d45b-586c-86d8-23c8bd34ebe3'::uuid, 3, 1, 'Supermercado', 4),
      ('3d848533-2d4b-57a5-8c79-98abb01b89d5'::uuid, 'Jabón de manos', 'unidades', 'df06a762-d45b-586c-86d8-23c8bd34ebe3'::uuid, 2, 1, 'Supermercado', 3),
      ('d5742b62-f4b5-5693-9794-f3aa80566b22'::uuid, 'Toallas papel gabinete', 'paquetes', 'df06a762-d45b-586c-86d8-23c8bd34ebe3'::uuid, 3, 1, 'Supermercado', 2),
      ('b65129c6-8673-57bb-89c8-f6f28622c74e'::uuid, 'EVA baja densidad', 'láminas', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a'::uuid, 6, 3, 'Laboratorio ortopédico', 8),
      ('75cd7d7d-1581-5a9c-9fc0-abf016f97db8'::uuid, 'EVA media densidad', 'láminas', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a'::uuid, 6, 3, 'Laboratorio ortopédico', 4),
      ('f24027a1-cd78-5da6-afbf-f9c782bc636b'::uuid, 'EVA alta densidad', 'láminas', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a'::uuid, 6, 3, 'Laboratorio ortopédico', 6),
      ('3904d696-288a-5aff-9409-4dd1b37ca11a'::uuid, 'Polipropileno 3mm', 'láminas', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a'::uuid, 4, 2, 'Laboratorio ortopédico', 3),
      ('1ab80956-a525-5560-97d6-c85f84f1c555'::uuid, 'Polipropileno 5mm', 'láminas', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a'::uuid, 4, 2, 'Laboratorio ortopédico', 5),
      ('beb2401a-14ed-534e-becf-d1be55f667b3'::uuid, 'Resina', 'kg', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a'::uuid, 2, 1, 'Proveedor taller', 2),
      ('46466fd4-ce51-5f87-961b-8ace838e75fd'::uuid, 'Fibra de vidrio', 'rollos', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a'::uuid, 2, 1, 'Proveedor taller', 1),
      ('e29b347f-bdfb-5fe1-9758-4b0d0bd5575c'::uuid, 'Fibra de carbono', 'rollos', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a'::uuid, 2, 1, 'Proveedor taller', 2),
      ('4901830d-bb2d-5b35-bd9e-3d19d3704795'::uuid, 'Espuma poliuretano', 'láminas', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a'::uuid, 3, 1, 'Proveedor taller', 3),
      ('34af5e1a-52b6-5889-95d5-ec20748b5978'::uuid, 'Forro cuero', 'láminas', '6fa81a79-2725-513b-bcec-6782cae00748'::uuid, 4, 2, 'Laboratorio ortopédico', 5),
      ('fd668100-9b95-582e-9268-82759df28bd4'::uuid, 'Forro tejido sport', 'láminas', '6fa81a79-2725-513b-bcec-6782cae00748'::uuid, 4, 2, 'Laboratorio ortopédico', 3),
      ('c2df7d67-2dbc-56b6-8208-4e5337de2445'::uuid, 'Forro pelite', 'láminas', '6fa81a79-2725-513b-bcec-6782cae00748'::uuid, 4, 2, 'Laboratorio ortopédico', 6),
      ('087e634e-98ad-5300-95bb-028062969d84'::uuid, 'Pegamento de contacto', 'botes', '6fa81a79-2725-513b-bcec-6782cae00748'::uuid, 2, 1, 'Ferretería', 2),
      ('e939c0e8-3ded-5734-8bdd-0082f7794065'::uuid, 'Papel lija (surtido)', 'paquetes', '6fa81a79-2725-513b-bcec-6782cae00748'::uuid, 2, 1, 'Ferretería', 1),
      ('f85314d7-d631-5547-9094-2addd0d96e29'::uuid, 'Silicona blanda (pasta A)', 'kits', '9fc37c07-d708-5768-8d47-77e6436b7036'::uuid, 2, 1, 'Proveedor silicona', 2),
      ('b030d502-37ec-5e14-acd0-61cf1eb124f0'::uuid, 'Catalizador líquido (Celia)', 'unidades', '9fc37c07-d708-5768-8d47-77e6436b7036'::uuid, 2, 1, 'Proveedor silicona', 2),
      ('e38385e9-9997-5ba9-a0d1-5ea43c282054'::uuid, 'Catalizador pasta (Andrés)', 'unidades', '9fc37c07-d708-5768-8d47-77e6436b7036'::uuid, 2, 1, 'Proveedor silicona', 1),
      ('f28a3ab4-3d2f-5f73-98e8-c78514dcee31'::uuid, 'Fresas desbaste taller', 'unidades', 'a9052895-d369-5954-bb81-f0ef3d3f3577'::uuid, 4, 2, 'Proveedor taller', 4),
      ('d70e6eed-6aaf-5436-89ec-34589134b47a'::uuid, 'Pegatinas identificación', 'rollos', 'a9052895-d369-5954-bb81-f0ef3d3f3577'::uuid, 2, 1, 'Papelería', 2),
      ('742a387e-f38f-5082-a0d0-cc8dbc9f257d'::uuid, 'Bolsas entrega plantillas', 'unidades', 'a9052895-d369-5954-bb81-f0ef3d3f3577'::uuid, 15, 5, 'Papelería', 20)
    )
    SELECT COUNT(*) INTO v_prod_mismatch
    FROM esperado e
    JOIN public.stock_productos r ON r.id = e.id
    WHERE r.nombre          IS DISTINCT FROM e.nombre
       OR r.unidad           IS DISTINCT FROM e.unidad
       OR r.categoria_id     IS DISTINCT FROM e.categoria_id
       OR r.stock_minimo     IS DISTINCT FROM e.stock_minimo
       OR r.stock_critico    IS DISTINCT FROM e.stock_critico
       OR r.proveedor_texto  IS DISTINCT FROM e.proveedor_texto
       OR r.centro_id        IS DISTINCT FROM v_centro
       OR r.stock_actual     IS DISTINCT FROM e.stock_esperado;

    WITH esperado(producto_id, cantidad_esperada) AS (VALUES
      ('85119868-4741-5f80-9df4-2e57c2f662e0'::uuid, 8),
      ('19222d0f-9248-5b50-bfc0-a8cebaddb07d'::uuid, 1),
      ('165dd7ac-6cbf-5de4-b4b0-6e7c012598f1'::uuid, 3),
      ('b82437c1-29b9-5370-a282-6d4ece28f33c'::uuid, 2),
      ('b1a14346-eb86-53ce-9ccb-ac80ce3a677a'::uuid, 2),
      ('624ba746-2480-591f-bbc9-b3c29c51a651'::uuid, 1),
      ('53bd7bcd-34f8-538d-a2f1-10e89c5bd1b8'::uuid, 4),
      ('0cb1f95f-a22b-561d-80e9-aed07f7fb88e'::uuid, 1),
      ('db3aac15-3e70-5f2c-b011-b1ff13be8c5b'::uuid, 2),
      ('78abefa0-e724-59ea-a652-b72b7a5e4bbf'::uuid, 3),
      ('a01d4932-62c4-552e-b1ce-e1fe85be05aa'::uuid, 2),
      ('ef035cc0-815e-565b-adad-58ce72b967c2'::uuid, 1),
      ('c6fdba66-9e02-5136-b139-9541737bc3fe'::uuid, 2),
      ('0fe09b7f-0cad-5291-94ea-fb670b778bb4'::uuid, 6),
      ('c6824051-2ea1-5b6f-a8d3-de6a6709cd15'::uuid, 3),
      ('9bbe6152-4ab8-5faa-9d84-e51455be8d5b'::uuid, 2),
      ('2cecac23-7be0-57b8-ba1e-8ad2caf63186'::uuid, 3),
      ('b6246acd-77a7-58d2-ae54-80f00d52ad26'::uuid, 2),
      ('44bf3407-9666-5df3-9dc3-da510c73175e'::uuid, 4),
      ('7b312a94-159c-5076-bdd3-438a2e05c4fc'::uuid, 5),
      ('8218b90b-3086-5cea-ac7d-9b2f06ddd5aa'::uuid, 4),
      ('3d848533-2d4b-57a5-8c79-98abb01b89d5'::uuid, 3),
      ('d5742b62-f4b5-5693-9794-f3aa80566b22'::uuid, 2),
      ('b65129c6-8673-57bb-89c8-f6f28622c74e'::uuid, 8),
      ('75cd7d7d-1581-5a9c-9fc0-abf016f97db8'::uuid, 4),
      ('f24027a1-cd78-5da6-afbf-f9c782bc636b'::uuid, 6),
      ('3904d696-288a-5aff-9409-4dd1b37ca11a'::uuid, 3),
      ('1ab80956-a525-5560-97d6-c85f84f1c555'::uuid, 5),
      ('beb2401a-14ed-534e-becf-d1be55f667b3'::uuid, 2),
      ('46466fd4-ce51-5f87-961b-8ace838e75fd'::uuid, 1),
      ('e29b347f-bdfb-5fe1-9758-4b0d0bd5575c'::uuid, 2),
      ('4901830d-bb2d-5b35-bd9e-3d19d3704795'::uuid, 3),
      ('34af5e1a-52b6-5889-95d5-ec20748b5978'::uuid, 5),
      ('fd668100-9b95-582e-9268-82759df28bd4'::uuid, 3),
      ('c2df7d67-2dbc-56b6-8208-4e5337de2445'::uuid, 6),
      ('087e634e-98ad-5300-95bb-028062969d84'::uuid, 2),
      ('e939c0e8-3ded-5734-8bdd-0082f7794065'::uuid, 1),
      ('f85314d7-d631-5547-9094-2addd0d96e29'::uuid, 2),
      ('b030d502-37ec-5e14-acd0-61cf1eb124f0'::uuid, 2),
      ('e38385e9-9997-5ba9-a0d1-5ea43c282054'::uuid, 1),
      ('f28a3ab4-3d2f-5f73-98e8-c78514dcee31'::uuid, 4),
      ('d70e6eed-6aaf-5436-89ec-34589134b47a'::uuid, 2),
      ('742a387e-f38f-5082-a0d0-cc8dbc9f257d'::uuid, 20)
    ),
    real_mov AS (
      SELECT producto_id, COUNT(*) AS n, SUM(cantidad) AS suma
      FROM public.stock_movimientos
      WHERE producto_id = ANY(v_prod_ids)
        AND tipo = 'AJUSTE_POSITIVO'
        AND motivo = 'INVENTARIO_INICIAL_MIGRACION'
      GROUP BY producto_id
    )
    SELECT COUNT(*) INTO v_mov_mismatch
    FROM esperado e
    LEFT JOIN real_mov r ON r.producto_id = e.producto_id
    WHERE r.producto_id IS NULL
       OR r.n <> 1
       OR r.suma IS DISTINCT FROM e.cantidad_esperada;

    SELECT COALESCE(SUM(stock_actual),0) INTO v_stock_sum
    FROM public.stock_productos WHERE id = ANY(v_prod_ids);

    IF v_cat_mismatch = 0 AND v_prod_mismatch = 0 AND v_mov_mismatch = 0 AND v_stock_sum = 148 THEN
      RAISE NOTICE 'Stock inicial ya migrado; no se hace nada';
      RETURN;
    ELSE
      RAISE EXCEPTION 'STOCK_MIGRACION_ESTADO_INCONSISTENTE: los % IDs de categoría y % de producto esperados existen, pero los datos no coinciden con el dataset de origen (categorías incoherentes=%, productos incoherentes=%, movimientos incoherentes=%, suma stock=%/148). Revisar manualmente antes de continuar.',
        v_existing_cats, v_existing_prods, v_cat_mismatch, v_prod_mismatch, v_mov_mismatch, v_stock_sum;
    END IF;

  ELSE
    -- Caso C: estado parcial. Ni vacío ni completo: no se puede decidir con
    -- seguridad si continuar. Aborta explícitamente en vez de asumir nada.
    RAISE EXCEPTION 'STOCK_MIGRACION_ESTADO_INCONSISTENTE: estado parcial del dataset de migración (categorías %/10, productos %/43 IDs esperados presentes). Puede haber datos ajenos o una ejecución previa interrumpida. Revisar manualmente: no se ejecuta ni se asume nada.',
      v_existing_cats, v_existing_prods;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- Caso A: migración completa
  -- ══════════════════════════════════════════════════════════════════════

  -- ── Categorías ──────────────────────────────────────────────────────
  INSERT INTO public.stock_categorias (id, nombre, nivel, padre_id, orden, centro_id, created_by, updated_by)
    VALUES ('3fef637f-c6c5-5c9b-9479-b45e6c8c45c1', 'Consulta', 1, NULL, 0, v_centro, v_actor, v_actor);
  INSERT INTO public.stock_categorias (id, nombre, nivel, padre_id, orden, centro_id, created_by, updated_by)
    VALUES ('02a2e11e-88da-5a88-992f-a8e645533e20', 'Esterilización', 2, '3fef637f-c6c5-5c9b-9479-b45e6c8c45c1', 0, v_centro, v_actor, v_actor);
  INSERT INTO public.stock_categorias (id, nombre, nivel, padre_id, orden, centro_id, created_by, updated_by)
    VALUES ('c3c7ddd3-c18c-5e7c-b809-4afb74c0faca', 'Material clínico', 2, '3fef637f-c6c5-5c9b-9479-b45e6c8c45c1', 1, v_centro, v_actor, v_actor);
  INSERT INTO public.stock_categorias (id, nombre, nivel, padre_id, orden, centro_id, created_by, updated_by)
    VALUES ('5034352c-3f0b-5fe9-b8fb-22d7014fd6b9', 'Tratamientos y curas', 2, '3fef637f-c6c5-5c9b-9479-b45e6c8c45c1', 2, v_centro, v_actor, v_actor);
  INSERT INTO public.stock_categorias (id, nombre, nivel, padre_id, orden, centro_id, created_by, updated_by)
    VALUES ('df06a762-d45b-586c-86d8-23c8bd34ebe3', 'Higiene y recepción', 2, '3fef637f-c6c5-5c9b-9479-b45e6c8c45c1', 3, v_centro, v_actor, v_actor);
  INSERT INTO public.stock_categorias (id, nombre, nivel, padre_id, orden, centro_id, created_by, updated_by)
    VALUES ('7ae2958a-abe0-5f17-a719-3bbe535b7fe8', 'Taller', 1, NULL, 1, v_centro, v_actor, v_actor);
  INSERT INTO public.stock_categorias (id, nombre, nivel, padre_id, orden, centro_id, created_by, updated_by)
    VALUES ('acb801fc-5db8-51d9-a2f7-35452be3ba6a', 'Materiales base', 2, '7ae2958a-abe0-5f17-a719-3bbe535b7fe8', 0, v_centro, v_actor, v_actor);
  INSERT INTO public.stock_categorias (id, nombre, nivel, padre_id, orden, centro_id, created_by, updated_by)
    VALUES ('6fa81a79-2725-513b-bcec-6782cae00748', 'Forros y acabados', 2, '7ae2958a-abe0-5f17-a719-3bbe535b7fe8', 1, v_centro, v_actor, v_actor);
  INSERT INTO public.stock_categorias (id, nombre, nivel, padre_id, orden, centro_id, created_by, updated_by)
    VALUES ('9fc37c07-d708-5768-8d47-77e6436b7036', 'Silicona y órtesis', 2, '7ae2958a-abe0-5f17-a719-3bbe535b7fe8', 2, v_centro, v_actor, v_actor);
  INSERT INTO public.stock_categorias (id, nombre, nivel, padre_id, orden, centro_id, created_by, updated_by)
    VALUES ('a9052895-d369-5954-bb81-f0ef3d3f3577', 'Consumibles taller', 2, '7ae2958a-abe0-5f17-a719-3bbe535b7fe8', 3, v_centro, v_actor, v_actor);

  -- ── Productos (stock_actual = 0) + inventario inicial vía RPC ─────────

  -- Consulta › Esterilización
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('85119868-4741-5f80-9df4-2e57c2f662e0', 'Gasas', 'paquetes', '02a2e11e-88da-5a88-992f-a8e645533e20', 5, 2, 'Suministros médicos', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('85119868-4741-5f80-9df4-2e57c2f662e0'::uuid, 'AJUSTE_POSITIVO', 8, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('19222d0f-9248-5b50-bfc0-a8cebaddb07d', 'Guantes talla S', 'cajas', '02a2e11e-88da-5a88-992f-a8e645533e20', 2, 1, 'Suministros médicos', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('19222d0f-9248-5b50-bfc0-a8cebaddb07d'::uuid, 'AJUSTE_POSITIVO', 1, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('165dd7ac-6cbf-5de4-b4b0-6e7c012598f1', 'Guantes talla M', 'cajas', '02a2e11e-88da-5a88-992f-a8e645533e20', 2, 1, 'Suministros médicos', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('165dd7ac-6cbf-5de4-b4b0-6e7c012598f1'::uuid, 'AJUSTE_POSITIVO', 3, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('b82437c1-29b9-5370-a282-6d4ece28f33c', 'Guantes talla L', 'cajas', '02a2e11e-88da-5a88-992f-a8e645533e20', 2, 1, 'Suministros médicos', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('b82437c1-29b9-5370-a282-6d4ece28f33c'::uuid, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('b1a14346-eb86-53ce-9ccb-ac80ce3a677a', 'Bolsas esterilización', 'rollos', '02a2e11e-88da-5a88-992f-a8e645533e20', 2, 1, 'Autoclave supplies', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('b1a14346-eb86-53ce-9ccb-ac80ce3a677a'::uuid, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('624ba746-2480-591f-bbc9-b3c29c51a651', 'Tiras control autoclave', 'cajas', '02a2e11e-88da-5a88-992f-a8e645533e20', 2, 1, 'Autoclave supplies', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('624ba746-2480-591f-bbc9-b3c29c51a651'::uuid, 'AJUSTE_POSITIVO', 1, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('53bd7bcd-34f8-538d-a2f1-10e89c5bd1b8', 'Indicadores biológicos', 'unidades', '02a2e11e-88da-5a88-992f-a8e645533e20', 3, 1, 'Autoclave supplies', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('53bd7bcd-34f8-538d-a2f1-10e89c5bd1b8'::uuid, 'AJUSTE_POSITIVO', 4, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('0cb1f95f-a22b-561d-80e9-aed07f7fb88e', 'Líquido ultrasonidos', 'litros', '02a2e11e-88da-5a88-992f-a8e645533e20', 2, 1, 'Autoclave supplies', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('0cb1f95f-a22b-561d-80e9-aed07f7fb88e'::uuid, 'AJUSTE_POSITIVO', 1, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('db3aac15-3e70-5f2c-b011-b1ff13be8c5b', 'Agua destilada autoclave', 'garrafas', '02a2e11e-88da-5a88-992f-a8e645533e20', 2, 1, 'Supermercado', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('db3aac15-3e70-5f2c-b011-b1ff13be8c5b'::uuid, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');

  -- Consulta › Material clínico
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('78abefa0-e724-59ea-a652-b72b7a5e4bbf', 'Hojas bisturí nº23', 'cajas', 'c3c7ddd3-c18c-5e7c-b809-4afb74c0faca', 2, 1, 'Suministros médicos', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('78abefa0-e724-59ea-a652-b72b7a5e4bbf'::uuid, 'AJUSTE_POSITIVO', 3, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('a01d4932-62c4-552e-b1ce-e1fe85be05aa', 'Hojas bisturí nº15', 'cajas', 'c3c7ddd3-c18c-5e7c-b809-4afb74c0faca', 2, 1, 'Suministros médicos', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('a01d4932-62c4-552e-b1ce-e1fe85be05aa'::uuid, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('ef035cc0-815e-565b-adad-58ce72b967c2', 'Jeringuillas 5ml', 'cajas', 'c3c7ddd3-c18c-5e7c-b809-4afb74c0faca', 2, 1, 'Suministros médicos', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('ef035cc0-815e-565b-adad-58ce72b967c2'::uuid, 'AJUSTE_POSITIVO', 1, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('c6fdba66-9e02-5136-b139-9541737bc3fe', 'Agujas 23G', 'cajas', 'c3c7ddd3-c18c-5e7c-b809-4afb74c0faca', 2, 1, 'Suministros médicos', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('c6fdba66-9e02-5136-b139-9541737bc3fe'::uuid, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('0fe09b7f-0cad-5291-94ea-fb670b778bb4', 'Botes cultivo (tapa roja)', 'unidades', 'c3c7ddd3-c18c-5e7c-b809-4afb74c0faca', 5, 2, 'IPMICRO', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('0fe09b7f-0cad-5291-94ea-fb670b778bb4'::uuid, 'AJUSTE_POSITIVO', 6, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('c6824051-2ea1-5b6f-a8d3-de6a6709cd15', 'Sobres envío TIPSA', 'unidades', 'c3c7ddd3-c18c-5e7c-b809-4afb74c0faca', 4, 1, 'TIPSA', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('c6824051-2ea1-5b6f-a8d3-de6a6709cd15'::uuid, 'AJUSTE_POSITIVO', 3, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');

  -- Consulta › Tratamientos y curas
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('9bbe6152-4ab8-5faa-9d84-e51455be8d5b', 'Ácido nítrico', 'unidades', '5034352c-3f0b-5fe9-b8fb-22d7014fd6b9', 2, 1, 'Proveedor químico', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('9bbe6152-4ab8-5faa-9d84-e51455be8d5b'::uuid, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('2cecac23-7be0-57b8-ba1e-8ad2caf63186', 'Alcohol 70º', 'litros', '5034352c-3f0b-5fe9-b8fb-22d7014fd6b9', 2, 1, 'Suministros médicos', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('2cecac23-7be0-57b8-ba1e-8ad2caf63186'::uuid, 'AJUSTE_POSITIVO', 3, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('b6246acd-77a7-58d2-ae54-80f00d52ad26', 'Povidona yodada', 'unidades', '5034352c-3f0b-5fe9-b8fb-22d7014fd6b9', 2, 1, 'Suministros médicos', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('b6246acd-77a7-58d2-ae54-80f00d52ad26'::uuid, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('44bf3407-9666-5df3-9dc3-da510c73175e', 'Esparadrapo microporoso', 'rollos', '5034352c-3f0b-5fe9-b8fb-22d7014fd6b9', 3, 1, 'Suministros médicos', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('44bf3407-9666-5df3-9dc3-da510c73175e'::uuid, 'AJUSTE_POSITIVO', 4, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('7b312a94-159c-5076-bdd3-438a2e05c4fc', 'Venda cohesiva', 'unidades', '5034352c-3f0b-5fe9-b8fb-22d7014fd6b9', 4, 2, 'Suministros médicos', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('7b312a94-159c-5076-bdd3-438a2e05c4fc'::uuid, 'AJUSTE_POSITIVO', 5, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');

  -- Consulta › Higiene y recepción
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('8218b90b-3086-5cea-ac7d-9b2f06ddd5aa', 'Papel higiénico', 'paquetes', 'df06a762-d45b-586c-86d8-23c8bd34ebe3', 3, 1, 'Supermercado', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('8218b90b-3086-5cea-ac7d-9b2f06ddd5aa'::uuid, 'AJUSTE_POSITIVO', 4, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('3d848533-2d4b-57a5-8c79-98abb01b89d5', 'Jabón de manos', 'unidades', 'df06a762-d45b-586c-86d8-23c8bd34ebe3', 2, 1, 'Supermercado', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('3d848533-2d4b-57a5-8c79-98abb01b89d5'::uuid, 'AJUSTE_POSITIVO', 3, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('d5742b62-f4b5-5693-9794-f3aa80566b22', 'Toallas papel gabinete', 'paquetes', 'df06a762-d45b-586c-86d8-23c8bd34ebe3', 3, 1, 'Supermercado', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('d5742b62-f4b5-5693-9794-f3aa80566b22'::uuid, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');

  -- Taller › Materiales base
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('b65129c6-8673-57bb-89c8-f6f28622c74e', 'EVA baja densidad', 'láminas', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a', 6, 3, 'Laboratorio ortopédico', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('b65129c6-8673-57bb-89c8-f6f28622c74e'::uuid, 'AJUSTE_POSITIVO', 8, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('75cd7d7d-1581-5a9c-9fc0-abf016f97db8', 'EVA media densidad', 'láminas', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a', 6, 3, 'Laboratorio ortopédico', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('75cd7d7d-1581-5a9c-9fc0-abf016f97db8'::uuid, 'AJUSTE_POSITIVO', 4, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('f24027a1-cd78-5da6-afbf-f9c782bc636b', 'EVA alta densidad', 'láminas', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a', 6, 3, 'Laboratorio ortopédico', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('f24027a1-cd78-5da6-afbf-f9c782bc636b'::uuid, 'AJUSTE_POSITIVO', 6, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('3904d696-288a-5aff-9409-4dd1b37ca11a', 'Polipropileno 3mm', 'láminas', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a', 4, 2, 'Laboratorio ortopédico', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('3904d696-288a-5aff-9409-4dd1b37ca11a'::uuid, 'AJUSTE_POSITIVO', 3, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('1ab80956-a525-5560-97d6-c85f84f1c555', 'Polipropileno 5mm', 'láminas', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a', 4, 2, 'Laboratorio ortopédico', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('1ab80956-a525-5560-97d6-c85f84f1c555'::uuid, 'AJUSTE_POSITIVO', 5, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('beb2401a-14ed-534e-becf-d1be55f667b3', 'Resina', 'kg', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a', 2, 1, 'Proveedor taller', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('beb2401a-14ed-534e-becf-d1be55f667b3'::uuid, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('46466fd4-ce51-5f87-961b-8ace838e75fd', 'Fibra de vidrio', 'rollos', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a', 2, 1, 'Proveedor taller', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('46466fd4-ce51-5f87-961b-8ace838e75fd'::uuid, 'AJUSTE_POSITIVO', 1, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('e29b347f-bdfb-5fe1-9758-4b0d0bd5575c', 'Fibra de carbono', 'rollos', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a', 2, 1, 'Proveedor taller', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('e29b347f-bdfb-5fe1-9758-4b0d0bd5575c'::uuid, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('4901830d-bb2d-5b35-bd9e-3d19d3704795', 'Espuma poliuretano', 'láminas', 'acb801fc-5db8-51d9-a2f7-35452be3ba6a', 3, 1, 'Proveedor taller', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('4901830d-bb2d-5b35-bd9e-3d19d3704795'::uuid, 'AJUSTE_POSITIVO', 3, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');

  -- Taller › Forros y acabados
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('34af5e1a-52b6-5889-95d5-ec20748b5978', 'Forro cuero', 'láminas', '6fa81a79-2725-513b-bcec-6782cae00748', 4, 2, 'Laboratorio ortopédico', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('34af5e1a-52b6-5889-95d5-ec20748b5978'::uuid, 'AJUSTE_POSITIVO', 5, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('fd668100-9b95-582e-9268-82759df28bd4', 'Forro tejido sport', 'láminas', '6fa81a79-2725-513b-bcec-6782cae00748', 4, 2, 'Laboratorio ortopédico', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('fd668100-9b95-582e-9268-82759df28bd4'::uuid, 'AJUSTE_POSITIVO', 3, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('c2df7d67-2dbc-56b6-8208-4e5337de2445', 'Forro pelite', 'láminas', '6fa81a79-2725-513b-bcec-6782cae00748', 4, 2, 'Laboratorio ortopédico', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('c2df7d67-2dbc-56b6-8208-4e5337de2445'::uuid, 'AJUSTE_POSITIVO', 6, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('087e634e-98ad-5300-95bb-028062969d84', 'Pegamento de contacto', 'botes', '6fa81a79-2725-513b-bcec-6782cae00748', 2, 1, 'Ferretería', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('087e634e-98ad-5300-95bb-028062969d84'::uuid, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('e939c0e8-3ded-5734-8bdd-0082f7794065', 'Papel lija (surtido)', 'paquetes', '6fa81a79-2725-513b-bcec-6782cae00748', 2, 1, 'Ferretería', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('e939c0e8-3ded-5734-8bdd-0082f7794065'::uuid, 'AJUSTE_POSITIVO', 1, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');

  -- Taller › Silicona y órtesis
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('f85314d7-d631-5547-9094-2addd0d96e29', 'Silicona blanda (pasta A)', 'kits', '9fc37c07-d708-5768-8d47-77e6436b7036', 2, 1, 'Proveedor silicona', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('f85314d7-d631-5547-9094-2addd0d96e29'::uuid, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('b030d502-37ec-5e14-acd0-61cf1eb124f0', 'Catalizador líquido (Celia)', 'unidades', '9fc37c07-d708-5768-8d47-77e6436b7036', 2, 1, 'Proveedor silicona', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('b030d502-37ec-5e14-acd0-61cf1eb124f0'::uuid, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('e38385e9-9997-5ba9-a0d1-5ea43c282054', 'Catalizador pasta (Andrés)', 'unidades', '9fc37c07-d708-5768-8d47-77e6436b7036', 2, 1, 'Proveedor silicona', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('e38385e9-9997-5ba9-a0d1-5ea43c282054'::uuid, 'AJUSTE_POSITIVO', 1, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');

  -- Taller › Consumibles taller
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('f28a3ab4-3d2f-5f73-98e8-c78514dcee31', 'Fresas desbaste taller', 'unidades', 'a9052895-d369-5954-bb81-f0ef3d3f3577', 4, 2, 'Proveedor taller', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('f28a3ab4-3d2f-5f73-98e8-c78514dcee31'::uuid, 'AJUSTE_POSITIVO', 4, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('d70e6eed-6aaf-5436-89ec-34589134b47a', 'Pegatinas identificación', 'rollos', 'a9052895-d369-5954-bb81-f0ef3d3f3577', 2, 1, 'Papelería', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('d70e6eed-6aaf-5436-89ec-34589134b47a'::uuid, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');
  INSERT INTO public.stock_productos
    (id, nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
    VALUES ('742a387e-f38f-5082-a0d0-cc8dbc9f257d', 'Bolsas entrega plantillas', 'unidades', 'a9052895-d369-5954-bb81-f0ef3d3f3577', 15, 5, 'Papelería', v_centro, v_actor, v_actor);
  PERFORM public.registrar_movimiento_stock('742a387e-f38f-5082-a0d0-cc8dbc9f257d'::uuid, 'AJUSTE_POSITIVO', 20, v_usuario, v_centro, 'INVENTARIO_INICIAL_MIGRACION');

  -- ── Verificación dentro de la misma transacción ────────────────────────
  SELECT COUNT(*) INTO v_cat_n  FROM public.stock_categorias WHERE id = ANY(v_cat_ids);
  SELECT COUNT(*) INTO v_prod_n FROM public.stock_productos  WHERE id = ANY(v_prod_ids);
  SELECT COUNT(*) INTO v_mov_n  FROM public.stock_movimientos
    WHERE producto_id = ANY(v_prod_ids) AND motivo = 'INVENTARIO_INICIAL_MIGRACION';
  SELECT COALESCE(SUM(stock_actual),0) INTO v_stock_sum FROM public.stock_productos WHERE id = ANY(v_prod_ids);

  IF v_cat_n  <> 10 THEN RAISE EXCEPTION 'MIGRACION_STOCK: se esperaban 10 categorías, hay %', v_cat_n;  END IF;
  IF v_prod_n <> 43 THEN RAISE EXCEPTION 'MIGRACION_STOCK: se esperaban 43 productos, hay %', v_prod_n; END IF;
  IF v_mov_n  <> 43 THEN RAISE EXCEPTION 'MIGRACION_STOCK: se esperaban 43 movimientos, hay %', v_mov_n; END IF;
  IF v_stock_sum <> 148 THEN RAISE EXCEPTION 'MIGRACION_STOCK: suma de stock % <> 148', v_stock_sum; END IF;

  RAISE NOTICE 'Inventario inicial migrado: % categorías, % productos, % movimientos, % unidades.',
    v_cat_n, v_prod_n, v_mov_n, v_stock_sum;
END $$;

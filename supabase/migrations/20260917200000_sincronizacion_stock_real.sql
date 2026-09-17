-- ============================================================================
-- MIGRACIÓN: Stock — sincronización con el inventario real (/controlstock/)
-- Fecha: 2026-09-17
--
-- El inventario de /controlstock/ (fuente real, usada a diario) ha divergido
-- del que se migró el 2026-09-15, porque el bug de
-- stock_productos_updated_by_fkey (corregido en
-- 20260917100000_correccion_updated_by_stock_movimiento.sql) impedía tocar
-- el stock desde ClinicOS: el personal ha seguido usando la herramienta
-- antigua en su lugar. Esta migración pone ClinicOS al día:
--
--   1) Nueva categoría "Materiales descargas y posteos" (Taller).
--   2) 4 productos de "Materiales base" que la herramienta antigua reutilizó
--      con otro nombre/proveedor/unidad (mismo hueco, material distinto).
--   3) 5 productos que ya no existen en la herramienta antigua -> archivar.
--   4) Ajuste de stock_actual en 7 productos existentes al valor real actual.
--   5) 11 productos nuevos (4 en Materiales base + 7 en el grupo nuevo).
--
-- Los 11 productos nuevos tienen en el origen un campo "unidad" corrupto
-- (un número suelto en vez de texto, ej. unidad="2"). Se usa "Planchas" por
-- analogía con productos hermanos del mismo grupo/proveedor
-- (Resina Marrón Flux, Polipropileno). Fácilmente corregible después.
--
-- Cada paso es idempotente: comprueba el estado antes de escribir, así que
-- volver a aplicar esta migración sobre un estado ya sincronizado no hace
-- nada (ni duplica movimientos de stock ni relanza inserts).
-- ============================================================================

DO $$
DECLARE
  v_centro         UUID;
  v_usuario        UUID;
  v_cat_taller     UUID := '7ae2958a-abe0-5f17-a719-3bbe535b7fe8';
  v_cat_base       UUID := 'acb801fc-5db8-51d9-a2f7-35452be3ba6a';
  v_cat_descargas  UUID;
  v_stock_actual   INT;
  v_prod_id        UUID;
BEGIN
  SELECT id INTO v_centro  FROM public.centros WHERE nombre = 'Podología y Biomecánica Rivas';
  SELECT id INTO v_usuario FROM public.usuarios WHERE email = 'admin@podologiarivas.com' AND activo;

  IF v_centro  IS NULL THEN RAISE EXCEPTION 'SYNC_STOCK: no se encuentra el centro'; END IF;
  IF v_usuario IS NULL THEN RAISE EXCEPTION 'SYNC_STOCK: no se encuentra el usuario administrador'; END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- 1. Categoría nueva: Taller › Materiales descargas y posteos
  -- ══════════════════════════════════════════════════════════════════════
  SELECT id INTO v_cat_descargas
    FROM public.stock_categorias
    WHERE nombre = 'Materiales descargas y posteos' AND padre_id = v_cat_taller;

  IF v_cat_descargas IS NULL THEN
    INSERT INTO public.stock_categorias (nombre, nivel, padre_id, orden, centro_id, created_by, updated_by)
    VALUES ('Materiales descargas y posteos', 2, v_cat_taller, 4, v_centro, v_usuario, v_usuario)
    RETURNING id INTO v_cat_descargas;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- 2. Productos reutilizados con otro material (mismo hueco en el origen)
  -- ══════════════════════════════════════════════════════════════════════
  UPDATE public.stock_productos
  SET nombre = 'Polipropileno 2mm', unidad = 'Planchas', stock_minimo = 1, stock_critico = 1,
      proveedor_texto = 'Ortoplast', updated_by = v_usuario, updated_at = now()
  WHERE id = '3904d696-288a-5aff-9409-4dd1b37ca11a'
    AND (nombre, unidad, stock_minimo, stock_critico, proveedor_texto)
      IS DISTINCT FROM ('Polipropileno 2mm', 'Planchas', 1, 1, 'Ortoplast');

  UPDATE public.stock_productos
  SET nombre = 'Resina Marrón Flux 1.2mm', unidad = 'Planchas', stock_minimo = 2, stock_critico = 1,
      proveedor_texto = 'Podiatech', updated_by = v_usuario, updated_at = now()
  WHERE id = 'beb2401a-14ed-534e-becf-d1be55f667b3'
    AND (nombre, unidad, stock_minimo, stock_critico, proveedor_texto)
      IS DISTINCT FROM ('Resina Marrón Flux 1.2mm', 'Planchas', 2, 1, 'Podiatech');

  UPDATE public.stock_productos
  SET nombre = 'Resina Marrón Flux 1mm', unidad = 'Planchas', stock_minimo = 2, stock_critico = 1,
      proveedor_texto = 'Podiatech', updated_by = v_usuario, updated_at = now()
  WHERE id = '46466fd4-ce51-5f87-961b-8ace838e75fd'
    AND (nombre, unidad, stock_minimo, stock_critico, proveedor_texto)
      IS DISTINCT FROM ('Resina Marrón Flux 1mm', 'Planchas', 2, 1, 'Podiatech');

  UPDATE public.stock_productos
  SET nombre = 'Resina Azul Flex 1.9mm', unidad = 'Planchas', stock_minimo = 2, stock_critico = 1,
      proveedor_texto = 'Podiatech', updated_by = v_usuario, updated_at = now()
  WHERE id = '4901830d-bb2d-5b35-bd9e-3d19d3704795'
    AND (nombre, unidad, stock_minimo, stock_critico, proveedor_texto)
      IS DISTINCT FROM ('Resina Azul Flex 1.9mm', 'Planchas', 2, 1, 'Podiatech');

  -- ══════════════════════════════════════════════════════════════════════
  -- 3. Productos que ya no existen en la herramienta antigua -> archivar
  -- ══════════════════════════════════════════════════════════════════════
  UPDATE public.stock_productos
  SET activo = false, archived_at = now(), updated_by = v_usuario, updated_at = now()
  WHERE id IN (
    'b65129c6-8673-57bb-89c8-f6f28622c74e', -- EVA baja densidad
    '75cd7d7d-1581-5a9c-9fc0-abf016f97db8', -- EVA media densidad
    'f24027a1-cd78-5da6-afbf-f9c782bc636b', -- EVA alta densidad
    '1ab80956-a525-5560-97d6-c85f84f1c555', -- Polipropileno 5mm
    'e29b347f-bdfb-5fe1-9758-4b0d0bd5575c'  -- Fibra de carbono
  ) AND activo = true;

  -- ══════════════════════════════════════════════════════════════════════
  -- 4. Ajuste de stock_actual al valor real actual (7 productos existentes)
  -- ══════════════════════════════════════════════════════════════════════
  SELECT stock_actual INTO v_stock_actual FROM public.stock_productos WHERE id = '85119868-4741-5f80-9df4-2e57c2f662e0'; -- Gasas
  IF v_stock_actual <> 2 THEN
    PERFORM public.registrar_movimiento_stock('85119868-4741-5f80-9df4-2e57c2f662e0'::uuid, 'AJUSTE_NEGATIVO', v_stock_actual - 2, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  SELECT stock_actual INTO v_stock_actual FROM public.stock_productos WHERE id = 'b82437c1-29b9-5370-a282-6d4ece28f33c'; -- Guantes talla L
  IF v_stock_actual <> 10 THEN
    PERFORM public.registrar_movimiento_stock('b82437c1-29b9-5370-a282-6d4ece28f33c'::uuid, 'AJUSTE_POSITIVO', 10 - v_stock_actual, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  SELECT stock_actual INTO v_stock_actual FROM public.stock_productos WHERE id = 'b1a14346-eb86-53ce-9ccb-ac80ce3a677a'; -- Bolsas esterilización
  IF v_stock_actual <> 12 THEN
    PERFORM public.registrar_movimiento_stock('b1a14346-eb86-53ce-9ccb-ac80ce3a677a'::uuid, 'AJUSTE_POSITIVO', 12 - v_stock_actual, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  SELECT stock_actual INTO v_stock_actual FROM public.stock_productos WHERE id = 'db3aac15-3e70-5f2c-b011-b1ff13be8c5b'; -- Agua destilada autoclave
  IF v_stock_actual <> 5 THEN
    PERFORM public.registrar_movimiento_stock('db3aac15-3e70-5f2c-b011-b1ff13be8c5b'::uuid, 'AJUSTE_POSITIVO', 5 - v_stock_actual, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  SELECT stock_actual INTO v_stock_actual FROM public.stock_productos WHERE id = 'beb2401a-14ed-534e-becf-d1be55f667b3'; -- Resina Marrón Flux 1.2mm
  IF v_stock_actual <> 1 THEN
    PERFORM public.registrar_movimiento_stock('beb2401a-14ed-534e-becf-d1be55f667b3'::uuid, 'AJUSTE_NEGATIVO', v_stock_actual - 1, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  SELECT stock_actual INTO v_stock_actual FROM public.stock_productos WHERE id = '4901830d-bb2d-5b35-bd9e-3d19d3704795'; -- Resina Azul Flex 1.9mm
  IF v_stock_actual <> 2 THEN
    PERFORM public.registrar_movimiento_stock('4901830d-bb2d-5b35-bd9e-3d19d3704795'::uuid, 'AJUSTE_NEGATIVO', v_stock_actual - 2, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  SELECT stock_actual INTO v_stock_actual FROM public.stock_productos WHERE id = '742a387e-f38f-5082-a0d0-cc8dbc9f257d'; -- Bolsas entrega plantillas
  IF v_stock_actual <> 16 THEN
    PERFORM public.registrar_movimiento_stock('742a387e-f38f-5082-a0d0-cc8dbc9f257d'::uuid, 'AJUSTE_NEGATIVO', v_stock_actual - 16, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- 5. Productos nuevos (11): nacen en 0 y reciben el stock real vía RPC
  -- ══════════════════════════════════════════════════════════════════════

  -- Taller › Materiales base
  IF NOT EXISTS (SELECT 1 FROM public.stock_productos WHERE nombre = 'Resina Black 1.2mm' AND categoria_id = v_cat_base) THEN
    INSERT INTO public.stock_productos (nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
      VALUES ('Resina Black 1.2mm', 'Planchas', v_cat_base, 1, 1, 'Podiatech', v_centro, v_usuario, v_usuario) RETURNING id INTO v_prod_id;
    PERFORM public.registrar_movimiento_stock(v_prod_id, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stock_productos WHERE nombre = 'Podiaflex Color 1.3mm' AND categoria_id = v_cat_base) THEN
    INSERT INTO public.stock_productos (nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
      VALUES ('Podiaflex Color 1.3mm', 'Planchas', v_cat_base, 1, 1, 'Podiatech', v_centro, v_usuario, v_usuario);
    -- stock real = 0: nace en 0, no requiere movimiento
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stock_productos WHERE nombre = 'Podiaflex Carbone 1.3mm' AND categoria_id = v_cat_base) THEN
    INSERT INTO public.stock_productos (nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
      VALUES ('Podiaflex Carbone 1.3mm', 'Planchas', v_cat_base, 1, 1, 'Podiatech', v_centro, v_usuario, v_usuario) RETURNING id INTO v_prod_id;
    PERFORM public.registrar_movimiento_stock(v_prod_id, 'AJUSTE_POSITIVO', 1, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stock_productos WHERE nombre = 'Transflux 1mm' AND categoria_id = v_cat_base) THEN
    INSERT INTO public.stock_productos (nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
      VALUES ('Transflux 1mm', 'Planchas', v_cat_base, 1, 1, 'Podiatech', v_centro, v_usuario, v_usuario) RETURNING id INTO v_prod_id;
    PERFORM public.registrar_movimiento_stock(v_prod_id, 'AJUSTE_POSITIVO', 1, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  -- Taller › Materiales descargas y posteos (grupo nuevo)
  IF NOT EXISTS (SELECT 1 FROM public.stock_productos WHERE nombre = 'Lucvan 3mm' AND categoria_id = v_cat_descargas) THEN
    INSERT INTO public.stock_productos (nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
      VALUES ('Lucvan 3mm', 'Planchas', v_cat_descargas, 1, 1, 'Junquera y Diz', v_centro, v_usuario, v_usuario) RETURNING id INTO v_prod_id;
    PERFORM public.registrar_movimiento_stock(v_prod_id, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stock_productos WHERE nombre = 'Lucvan 2mm' AND categoria_id = v_cat_descargas) THEN
    INSERT INTO public.stock_productos (nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
      VALUES ('Lucvan 2mm', 'Planchas', v_cat_descargas, 1, 1, 'Junquera y Diz', v_centro, v_usuario, v_usuario) RETURNING id INTO v_prod_id;
    PERFORM public.registrar_movimiento_stock(v_prod_id, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stock_productos WHERE nombre = 'Contformic 3mm' AND categoria_id = v_cat_descargas) THEN
    INSERT INTO public.stock_productos (nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
      VALUES ('Contformic 3mm', 'Planchas', v_cat_descargas, 1, 1, 'Podiatech', v_centro, v_usuario, v_usuario) RETURNING id INTO v_prod_id;
    PERFORM public.registrar_movimiento_stock(v_prod_id, 'AJUSTE_POSITIVO', 1, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stock_productos WHERE nombre = 'Contformic 2mm' AND categoria_id = v_cat_descargas) THEN
    INSERT INTO public.stock_productos (nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
      VALUES ('Contformic 2mm', 'Planchas', v_cat_descargas, 1, 1, 'Podiatech', v_centro, v_usuario, v_usuario);
    -- stock real = 0: nace en 0, no requiere movimiento
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stock_productos WHERE nombre = 'Podieva 2mm' AND categoria_id = v_cat_descargas) THEN
    INSERT INTO public.stock_productos (nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
      VALUES ('Podieva 2mm', 'Planchas', v_cat_descargas, 1, 1, 'Podiatech y otros', v_centro, v_usuario, v_usuario) RETURNING id INTO v_prod_id;
    PERFORM public.registrar_movimiento_stock(v_prod_id, 'AJUSTE_POSITIVO', 2, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stock_productos WHERE nombre = 'Podieva 3mm' AND categoria_id = v_cat_descargas) THEN
    INSERT INTO public.stock_productos (nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
      VALUES ('Podieva 3mm', 'Planchas', v_cat_descargas, 1, 1, 'Podiatech', v_centro, v_usuario, v_usuario) RETURNING id INTO v_prod_id;
    PERFORM public.registrar_movimiento_stock(v_prod_id, 'AJUSTE_POSITIVO', 1, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stock_productos WHERE nombre = 'Podieva 1mm' AND categoria_id = v_cat_descargas) THEN
    INSERT INTO public.stock_productos (nombre, unidad, categoria_id, stock_minimo, stock_critico, proveedor_texto, centro_id, created_by, updated_by)
      VALUES ('Podieva 1mm', 'Planchas', v_cat_descargas, 1, 1, 'Podiatech', v_centro, v_usuario, v_usuario) RETURNING id INTO v_prod_id;
    PERFORM public.registrar_movimiento_stock(v_prod_id, 'AJUSTE_POSITIVO', 1, v_usuario, v_centro, 'SINCRONIZACION_INVENTARIO_REAL');
  END IF;

END $$;

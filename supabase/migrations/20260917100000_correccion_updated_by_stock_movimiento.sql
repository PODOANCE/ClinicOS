-- ============================================================================
-- MIGRACIÓN: Corrección — registrar_movimiento_stock() escribía el actor
-- técnico en stock_productos.updated_by
-- Fecha: 2026-09-17
--
-- La corrección 20260916200000 repuntó created_by/updated_by de
-- stock_productos a usuarios(id) (persona real), pero esta función seguía
-- escribiendo v_actor (SISTEMA_CRON, de usuarios_sistema) en
-- stock_productos.updated_by al actualizar stock_actual. Como ese id no
-- existe en usuarios, cualquier +/- de cantidad violaba la FK y el ajuste
-- fallaba en producción.
--
-- Único cambio: stock_productos.updated_by pasa a usar p_usuario_id (la
-- persona real que llama a la RPC, ya validada contra auth.uid() más
-- arriba en la propia función), igual que ya se usa para stock_movimientos
-- .usuario_id. stock_movimientos.created_by sigue usando v_actor a
-- propósito: ese sí es un actor técnico legítimo (el registro de qué
-- automatismo escribió el movimiento), separado de quién lo pidió.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.registrar_movimiento_stock(
  p_producto_id UUID,
  p_tipo public.stock_movimiento_tipo,
  p_cantidad INTEGER,
  p_usuario_id UUID,
  p_centro_id UUID,
  p_motivo VARCHAR DEFAULT NULL,
  p_coste_unitario NUMERIC DEFAULT NULL
)
RETURNS TABLE(
  exitoso BOOLEAN,
  movimiento_id UUID,
  stock_anterior INTEGER,
  stock_nuevo INTEGER,
  mensaje VARCHAR
)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_producto RECORD;
  v_delta INTEGER;
  v_nuevo INTEGER;
  v_movimiento_id UUID;
  v_actor UUID;
  v_auth UUID;
BEGIN
  -- 0. Identidad: solo comprobable cuando la llamada viene autenticada.
  v_auth := auth.uid();
  IF v_auth IS NOT NULL AND p_usuario_id IS DISTINCT FROM v_auth THEN
    RAISE EXCEPTION 'USUARIO_NO_AUTORIZADO: no se puede registrar un movimiento a nombre de otro usuario (% vs %)', p_usuario_id, v_auth;
  END IF;

  -- 1. Cantidad
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'CANTIDAD_INVALIDA: debe ser un entero mayor que cero (recibido: %)', p_cantidad;
  END IF;

  -- 2. Motivo obligatorio en ajustes
  IF p_tipo IN ('AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO')
     AND (p_motivo IS NULL OR length(trim(p_motivo)) = 0) THEN
    RAISE EXCEPTION 'MOTIVO_REQUERIDO: los ajustes exigen un motivo no vacío';
  END IF;

  -- 3. Coste solo en entradas y nunca negativo
  IF p_coste_unitario IS NOT NULL THEN
    IF p_tipo <> 'ENTRADA' THEN
      RAISE EXCEPTION 'COSTE_NO_PERMITIDO: coste_unitario solo admitido en ENTRADA (tipo: %)', p_tipo;
    END IF;
    IF p_coste_unitario < 0 THEN
      RAISE EXCEPTION 'COSTE_INVALIDO: no se admiten costes negativos (recibido: %)', p_coste_unitario;
    END IF;
  END IF;

  -- 4. Bloqueo pesimista: serializa operaciones concurrentes sobre el producto
  SELECT id, stock_actual, centro_id, activo, archived_at
  INTO v_producto
  FROM public.stock_productos
  WHERE id = p_producto_id
  FOR UPDATE;

  -- 5. Existencia
  IF v_producto IS NULL THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO: %', p_producto_id;
  END IF;

  -- 6. Activo
  IF v_producto.archived_at IS NOT NULL OR v_producto.activo = false THEN
    RAISE EXCEPTION 'PRODUCTO_ARCHIVADO: no se admiten movimientos sobre un producto archivado';
  END IF;

  -- 7. Centro
  IF v_producto.centro_id <> p_centro_id THEN
    RAISE EXCEPTION 'CENTRO_NO_COINCIDE: el producto pertenece a otro centro';
  END IF;

  -- 8. Delta según tipo
  v_delta := CASE p_tipo
    WHEN 'ENTRADA'         THEN  p_cantidad
    WHEN 'AJUSTE_POSITIVO' THEN  p_cantidad
    WHEN 'CONSUMO'         THEN -p_cantidad
    WHEN 'AJUSTE_NEGATIVO' THEN -p_cantidad
  END;

  v_nuevo := v_producto.stock_actual + v_delta;

  -- 9. Nunca stock negativo
  IF v_nuevo < 0 THEN
    RAISE EXCEPTION 'STOCK_INSUFICIENTE: hay % y se intentan retirar % unidades',
      v_producto.stock_actual, p_cantidad;
  END IF;

  SELECT id INTO v_actor FROM public.usuarios_sistema LIMIT 1;

  -- 10. Token de un solo uso para ESTE movimiento y ESTA transacción
  v_movimiento_id := gen_random_uuid();
  PERFORM set_config('app.stock_mov_token',
                     txid_current()::text || ':' || v_movimiento_id::text,
                     true);

  INSERT INTO public.stock_movimientos (
    id, producto_id, tipo, cantidad, stock_resultante,
    motivo, coste_unitario, usuario_id, centro_id, created_by
  ) VALUES (
    v_movimiento_id, p_producto_id, p_tipo, p_cantidad, v_nuevo,
    NULLIF(trim(COALESCE(p_motivo, '')), ''), p_coste_unitario,
    p_usuario_id, p_centro_id, v_actor
  );

  -- 11. Stock materializado (amparado por el mismo token). updated_by es la
  -- persona real (p_usuario_id), no el actor técnico: stock_productos no
  -- tiene una columna aparte para la persona real como sí tiene
  -- stock_movimientos.usuario_id.
  UPDATE public.stock_productos
  SET stock_actual = v_nuevo,
      updated_at = now(),
      updated_by = p_usuario_id
  WHERE id = p_producto_id;

  -- 12. Invalidar el token: fuera de aquí no autoriza nada
  PERFORM set_config('app.stock_mov_token', '', true);

  RETURN QUERY SELECT
    true,
    v_movimiento_id,
    v_producto.stock_actual,
    v_nuevo,
    ('Movimiento registrado: ' || p_tipo::text)::VARCHAR;
END;
$function$;

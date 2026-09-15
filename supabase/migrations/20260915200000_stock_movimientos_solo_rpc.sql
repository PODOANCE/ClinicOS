-- ============================================================================
-- MIGRACIÓN: Stock — stock_movimientos solo vía RPC
-- Fecha: 2026-09-15
--
-- Cierra el último bypass: con service_role todavía era posible hacer
-- INSERT INTO stock_movimientos sin pasar por registrar_movimiento_stock(),
-- creando un movimiento fantasma que descuadraba el saldo.
--
-- Decisión arquitectónica definitiva:
--   registrar_movimiento_stock() es la ÚNICA vía legítima para crear
--   registros en stock_movimientos, para cualquier rol.
--
-- MECANISMO — token de un solo uso
-- --------------------------------
-- El GUC LOCAL no guarda un simple 'on': guarda "<txid>:<uuid del movimiento>".
-- El trigger exige coincidencia EXACTA con la transacción en curso y con la
-- fila que se está insertando. Consecuencias:
--   · no sirve un token heredado de otra transacción (el txid no coincide);
--   · no es reutilizable para un segundo movimiento (el uuid no coincide);
--   · la RPC lo invalida en cuanto termina de escribir.
-- Para falsificarlo haría falta ejecutar SQL arbitrario, algo que PostgREST
-- no permite: no se pueden fijar GUCs desde el payload ni desde headers.
-- ============================================================================

-- ============================================================================
-- 1. TRIGGER: INSERT solo desde la RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_movimiento_solo_rpc()
RETURNS TRIGGER AS $$
DECLARE
  v_token TEXT;
BEGIN
  v_token := current_setting('app.stock_mov_token', true);

  IF v_token IS DISTINCT FROM (txid_current()::text || ':' || NEW.id::text) THEN
    RAISE EXCEPTION 'MOVIMIENTO_SOLO_RPC: los movimientos de stock solo pueden crearse mediante registrar_movimiento_stock()';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_stock_movimientos_solo_rpc
BEFORE INSERT ON public.stock_movimientos
FOR EACH ROW
EXECUTE FUNCTION public.fn_movimiento_solo_rpc();

COMMENT ON FUNCTION public.fn_movimiento_solo_rpc IS
  'Bloquea cualquier INSERT en stock_movimientos que no proceda de registrar_movimiento_stock(), incluido service_role. El token es de un solo uso: va ligado al txid y al id de la fila.';

-- ============================================================================
-- 2. Protección de stock_actual sobre el mismo token
-- Se alinea con el mecanismo anterior: en vez de un flag 'on' reutilizable,
-- exige que haya una operación de la RPC viva en esta misma transacción.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_proteger_stock_actual()
RETURNS TRIGGER AS $$
DECLARE
  v_token TEXT;
BEGIN
  v_token := current_setting('app.stock_mov_token', true);

  -- Escritura autorizada: hay un movimiento de la RPC en curso en esta transacción
  IF v_token IS NOT NULL AND v_token LIKE (txid_current()::text || ':%') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.stock_actual <> 0 THEN
      RAISE EXCEPTION 'STOCK_ACTUAL_PROTEGIDO: un producto nace con stock 0. Registra una ENTRADA o un AJUSTE_POSITIVO con registrar_movimiento_stock() (recibido: %)', NEW.stock_actual;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.stock_actual IS DISTINCT FROM OLD.stock_actual THEN
    RAISE EXCEPTION 'STOCK_ACTUAL_PROTEGIDO: stock_actual solo puede modificarse mediante registrar_movimiento_stock() (intento: % -> %)', OLD.stock_actual, NEW.stock_actual;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. RPC: genera el id por adelantado y emite el token
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

  -- 11. Stock materializado (amparado por el mismo token)
  UPDATE public.stock_productos
  SET stock_actual = v_nuevo,
      updated_at = now(),
      updated_by = v_actor
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

COMMENT ON FUNCTION public.registrar_movimiento_stock IS
  'Única vía autorizada para crear movimientos de stock y alterar stock_productos.stock_actual. Atómica, con FOR UPDATE sobre el producto y token de un solo uso para los triggers de integridad.';

-- ============================================================================
-- 4. PRIVILEGIOS
-- Convención del proyecto (b42_rpc_transaccional, b3_idempotencia_rpc):
-- las RPC de negocio se revocan de PUBLIC/anon/authenticated y el backend
-- accede mediante service_role, que no requiere grant explícito.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.registrar_movimiento_stock(
  UUID, public.stock_movimiento_tipo, INTEGER, UUID, UUID, VARCHAR, NUMERIC
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.registrar_movimiento_stock(
  UUID, public.stock_movimiento_tipo, INTEGER, UUID, UUID, VARCHAR, NUMERIC
) FROM anon;

REVOKE EXECUTE ON FUNCTION public.registrar_movimiento_stock(
  UUID, public.stock_movimiento_tipo, INTEGER, UUID, UUID, VARCHAR, NUMERIC
) FROM authenticated;

-- El backend accede mediante service_role (no requiere grant explícito)

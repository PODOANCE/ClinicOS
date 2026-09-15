-- ============================================================================
-- MIGRACIÓN: Stock — Fase 1, correcciones de integridad
-- Fecha: 2026-09-15
--
-- Cierra tres vías por las que era posible alterar el stock sin pasar por
-- registrar_movimiento_stock(), contradiciendo la decisión arquitectónica de
-- que stock_movimientos es la única fuente de verdad:
--
--   1. UPDATE stock_productos SET stock_actual = ...   (descuadraba el saldo)
--   2. INSERT INTO stock_movimientos ...               (movimiento fantasma)
--   3. INSERT INTO stock_productos (stock_actual)      (producto nace con saldo)
--
-- Todas eran explotables incluso con service_role.
-- ============================================================================

-- ============================================================================
-- 1. PROTECCIÓN DE stock_actual
--
-- Una policy de UPDATE no puede restringir columnas concretas, así que la
-- protección tiene que ser un trigger. La RPC señaliza su propia escritura
-- mediante un GUC LOCAL a la transacción: PostgREST no permite fijar GUCs
-- arbitrarios desde el payload, por lo que no es activable vía HTTP, y al ser
-- local se descarta al terminar la transacción (no puede quedar "pegado").
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_proteger_stock_actual()
RETURNS TRIGGER AS $$
BEGIN
  -- Escritura autorizada: procede de registrar_movimiento_stock()
  IF current_setting('app.stock_movimiento_autorizado', true) = 'on' THEN
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

CREATE TRIGGER tg_stock_productos_proteger_stock_actual
BEFORE INSERT OR UPDATE ON public.stock_productos
FOR EACH ROW
EXECUTE FUNCTION public.fn_proteger_stock_actual();

COMMENT ON FUNCTION public.fn_proteger_stock_actual IS
  'Impide alterar stock_productos.stock_actual fuera de registrar_movimiento_stock(), incluso bajo service_role. El resto de columnas administrativas siguen siendo editables con normalidad.';

-- ============================================================================
-- 2. SIN INSERT DIRECTO EN stock_movimientos
--
-- La RPC la ejecuta el backend con service_role, que ignora RLS: no necesita
-- policy. Un usuario autenticado que intente insertar por PostgREST —o que
-- llame a la RPC directamente— queda bloqueado por ausencia de policy.
-- La tabla conserva únicamente SELECT.
-- ============================================================================

DROP POLICY IF EXISTS stock_movimientos_insert ON public.stock_movimientos;

-- ============================================================================
-- 3. RPC: validación defensiva de identidad + señalización de escritura
--
-- Se mantiene p_usuario_id como parámetro (los endpoints usan service_role,
-- donde auth.uid() es NULL). Pero si la llamada SÍ viene autenticada, el
-- usuario declarado debe coincidir con el del token: así un usuario no puede
-- atribuir una operación a otro.
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
  --    Con service_role auth.uid() es NULL y se confía en el backend.
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

  -- 10. Movimiento
  INSERT INTO public.stock_movimientos (
    producto_id, tipo, cantidad, stock_resultante,
    motivo, coste_unitario, usuario_id, centro_id, created_by
  ) VALUES (
    p_producto_id, p_tipo, p_cantidad, v_nuevo,
    NULLIF(trim(COALESCE(p_motivo, '')), ''), p_coste_unitario,
    p_usuario_id, p_centro_id, v_actor
  )
  RETURNING id INTO v_movimiento_id;

  -- 11. Stock materializado. El GUC es LOCAL: vive solo en esta transacción.
  PERFORM set_config('app.stock_movimiento_autorizado', 'on', true);

  UPDATE public.stock_productos
  SET stock_actual = v_nuevo,
      updated_at = now(),
      updated_by = v_actor
  WHERE id = p_producto_id;

  PERFORM set_config('app.stock_movimiento_autorizado', 'off', true);

  -- 12. Resultado
  RETURN QUERY SELECT
    true,
    v_movimiento_id,
    v_producto.stock_actual,
    v_nuevo,
    ('Movimiento registrado: ' || p_tipo::text)::VARCHAR;
END;
$function$;

COMMENT ON FUNCTION public.registrar_movimiento_stock IS
  'Única vía autorizada para alterar stock_productos.stock_actual. Atómica: inserta el movimiento y actualiza el saldo en la misma transacción, con FOR UPDATE sobre el producto. Valida la identidad cuando la llamada viene autenticada.';

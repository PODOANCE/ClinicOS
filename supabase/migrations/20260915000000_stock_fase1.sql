-- ============================================================================
-- MIGRACIÓN: Stock — Fase 1 (base de datos)
-- Fecha: 2026-09-15
-- Objetivo: Infraestructura de control de stock: categorías (2 niveles),
--           productos y movimientos append-only con operación transaccional.
--
-- Fuente de verdad del stock: stock_movimientos.
-- stock_productos.stock_actual es un valor MATERIALIZADO, mantenido
-- exclusivamente por registrar_movimiento_stock(). Ningún endpoint debe
-- actualizarlo directamente.
-- ============================================================================

-- ============================================================================
-- 1. ENUM
-- ============================================================================

CREATE TYPE public.stock_movimiento_tipo AS ENUM (
  'ENTRADA',
  'CONSUMO',
  'AJUSTE_POSITIVO',
  'AJUSTE_NEGATIVO'
);

-- ============================================================================
-- 2. TABLA: stock_categorias
-- Jerarquía de exactamente 2 niveles (ej. Consulta > Esterilización).
-- El CHECK de nivel impide estructuralmente un tercer nivel.
-- ============================================================================

CREATE TABLE public.stock_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  padre_id UUID REFERENCES public.stock_categorias(id) ON DELETE RESTRICT,
  nivel SMALLINT NOT NULL,
  orden SMALLINT NOT NULL DEFAULT 0,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  activo BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.usuarios_sistema(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES public.usuarios_sistema(id) ON DELETE RESTRICT,

  CONSTRAINT stock_categorias_nombre_not_empty CHECK (length(trim(nombre)) > 0),
  CONSTRAINT stock_categorias_jerarquia CHECK (
    (nivel = 1 AND padre_id IS NULL) OR
    (nivel = 2 AND padre_id IS NOT NULL)
  )
);

-- Sin duplicados activos dentro del mismo centro y mismo padre.
-- Dos índices porque padre_id NULL no compara igual en un UNIQUE normal.
CREATE UNIQUE INDEX idx_stock_categorias_unica_nivel1
  ON public.stock_categorias (centro_id, nombre)
  WHERE padre_id IS NULL AND archived_at IS NULL;

CREATE UNIQUE INDEX idx_stock_categorias_unica_nivel2
  ON public.stock_categorias (centro_id, padre_id, nombre)
  WHERE padre_id IS NOT NULL AND archived_at IS NULL;

CREATE INDEX idx_stock_categorias_centro_padre_orden
  ON public.stock_categorias (centro_id, padre_id, orden);

COMMENT ON COLUMN public.stock_categorias.nivel IS
  '1 = área (Consulta/Taller), 2 = grupo. El CHECK impide niveles superiores.';

-- ----------------------------------------------------------------------------
-- 2.1 Integridad del padre: mismo centro y nivel 1.
-- No se puede expresar con CHECK (requiere leer otra fila) → trigger.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_validar_categoria_padre()
RETURNS TRIGGER AS $$
DECLARE
  v_padre RECORD;
BEGIN
  IF NEW.padre_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nivel, centro_id, archived_at INTO v_padre
  FROM public.stock_categorias
  WHERE id = NEW.padre_id;

  IF v_padre IS NULL THEN
    RAISE EXCEPTION 'CATEGORIA_PADRE_NO_EXISTE: %', NEW.padre_id;
  END IF;

  IF v_padre.nivel <> 1 THEN
    RAISE EXCEPTION 'CATEGORIA_PADRE_INVALIDA: el padre debe ser de nivel 1 (es nivel %)', v_padre.nivel;
  END IF;

  IF v_padre.centro_id <> NEW.centro_id THEN
    RAISE EXCEPTION 'CATEGORIA_PADRE_OTRO_CENTRO: el padre pertenece a otro centro';
  END IF;

  IF v_padre.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'CATEGORIA_PADRE_ARCHIVADA: no se puede colgar de una categoría archivada';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_stock_categorias_validar_padre
BEFORE INSERT OR UPDATE ON public.stock_categorias
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_categoria_padre();

-- ============================================================================
-- 3. TABLA: stock_productos
-- ============================================================================

CREATE TABLE public.stock_productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(150) NOT NULL,
  unidad VARCHAR(30) NOT NULL,
  categoria_id UUID NOT NULL REFERENCES public.stock_categorias(id) ON DELETE RESTRICT,
  stock_actual INTEGER NOT NULL DEFAULT 0,
  stock_minimo INTEGER NOT NULL DEFAULT 0,
  stock_critico INTEGER NOT NULL DEFAULT 0,
  proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE SET NULL,
  proveedor_texto VARCHAR(100),
  notas TEXT,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  activo BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.usuarios_sistema(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES public.usuarios_sistema(id) ON DELETE RESTRICT,

  CONSTRAINT stock_productos_nombre_not_empty CHECK (length(trim(nombre)) > 0),
  CONSTRAINT stock_productos_unidad_not_empty CHECK (length(trim(unidad)) > 0),
  CONSTRAINT stock_productos_actual_no_negativo CHECK (stock_actual >= 0),
  CONSTRAINT stock_productos_minimo_no_negativo CHECK (stock_minimo >= 0),
  CONSTRAINT stock_productos_critico_no_negativo CHECK (stock_critico >= 0),
  CONSTRAINT stock_productos_critico_lte_minimo CHECK (stock_critico <= stock_minimo)
);

CREATE UNIQUE INDEX idx_stock_productos_nombre_unico
  ON public.stock_productos (centro_id, nombre)
  WHERE archived_at IS NULL;

CREATE INDEX idx_stock_productos_centro_categoria
  ON public.stock_productos (centro_id, categoria_id);

CREATE INDEX idx_stock_productos_centro_activo
  ON public.stock_productos (centro_id, activo);

-- Alimenta la vista "qué tengo que pedir"
CREATE INDEX idx_stock_productos_necesita_pedido
  ON public.stock_productos (centro_id, stock_actual)
  WHERE activo = true AND archived_at IS NULL;

COMMENT ON COLUMN public.stock_productos.stock_actual IS
  'Valor MATERIALIZADO derivado de stock_movimientos. Solo lo modifica registrar_movimiento_stock(). No es fuente de verdad.';

COMMENT ON COLUMN public.stock_productos.proveedor_texto IS
  'Proveedor como texto libre cuando no hay correspondencia con la tabla proveedores. Fallback para agrupar la lista de pedido.';

-- ----------------------------------------------------------------------------
-- 3.1 La categoría debe ser nivel 2 y del mismo centro.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_validar_producto_categoria()
RETURNS TRIGGER AS $$
DECLARE
  v_cat RECORD;
BEGIN
  SELECT nivel, centro_id, archived_at INTO v_cat
  FROM public.stock_categorias
  WHERE id = NEW.categoria_id;

  IF v_cat IS NULL THEN
    RAISE EXCEPTION 'CATEGORIA_NO_EXISTE: %', NEW.categoria_id;
  END IF;

  IF v_cat.nivel <> 2 THEN
    RAISE EXCEPTION 'CATEGORIA_NIVEL_INVALIDO: los productos solo pueden colgar de categorías de nivel 2 (es nivel %)', v_cat.nivel;
  END IF;

  IF v_cat.centro_id <> NEW.centro_id THEN
    RAISE EXCEPTION 'CATEGORIA_OTRO_CENTRO: la categoría pertenece a otro centro';
  END IF;

  IF v_cat.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'CATEGORIA_ARCHIVADA: no se puede asignar una categoría archivada';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_stock_productos_validar_categoria
BEFORE INSERT OR UPDATE ON public.stock_productos
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_producto_categoria();

-- ============================================================================
-- 4. TABLA: stock_movimientos (append-only)
-- Fuente de verdad del stock. Inmutable: un error se corrige con un
-- movimiento de ajuste, nunca editando el histórico.
-- ============================================================================

CREATE TABLE public.stock_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES public.stock_productos(id) ON DELETE RESTRICT,
  tipo public.stock_movimiento_tipo NOT NULL,
  cantidad INTEGER NOT NULL,
  stock_resultante INTEGER NOT NULL,
  motivo VARCHAR(200),
  coste_unitario NUMERIC(10,2),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  -- clock_timestamp() y no now(): now() es constante dentro de una transacción,
  -- lo que dejaría sin orden cronológico a los movimientos insertados en lote
  -- (p. ej. la migración del inventario inicial).
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios_sistema(id) ON DELETE RESTRICT,

  CONSTRAINT stock_movimientos_cantidad_positiva CHECK (cantidad > 0),
  CONSTRAINT stock_movimientos_resultante_no_negativo CHECK (stock_resultante >= 0),
  CONSTRAINT stock_movimientos_motivo_en_ajustes CHECK (
    tipo NOT IN ('AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO')
    OR (motivo IS NOT NULL AND length(trim(motivo)) > 0)
  ),
  CONSTRAINT stock_movimientos_coste_solo_entrada CHECK (
    coste_unitario IS NULL OR tipo = 'ENTRADA'
  ),
  CONSTRAINT stock_movimientos_coste_no_negativo CHECK (
    coste_unitario IS NULL OR coste_unitario >= 0
  )
);

CREATE INDEX idx_stock_movimientos_producto_fecha
  ON public.stock_movimientos (producto_id, created_at DESC);

CREATE INDEX idx_stock_movimientos_centro_fecha
  ON public.stock_movimientos (centro_id, created_at DESC);

COMMENT ON TABLE public.stock_movimientos IS
  'Append-only. Fuente de verdad del stock. Protegida por triggers que bloquean UPDATE y DELETE incluso bajo service_role.';

COMMENT ON COLUMN public.stock_movimientos.stock_resultante IS
  'Fotografía auditable del saldo inmediatamente posterior al movimiento. No constituye una fuente independiente de verdad: lo calcula registrar_movimiento_stock() y nunca llega desde el frontend.';

COMMENT ON COLUMN public.stock_movimientos.usuario_id IS
  'Persona real que ejecutó la operación. Distinto de created_by (actor técnico).';

-- ----------------------------------------------------------------------------
-- 4.1 Append-only: bloqueo de UPDATE y DELETE.
-- Los endpoints usan service_role, que ignora RLS: estos triggers son la
-- única protección efectiva. Mismo patrón que facturas_extraccion_ia.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_bloquear_actualizacion_movimiento_stock()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'stock_movimientos es append-only: no se permite UPDATE. ID: %', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_stock_movimientos_bloquear_update
BEFORE UPDATE ON public.stock_movimientos
FOR EACH ROW
EXECUTE FUNCTION public.fn_bloquear_actualizacion_movimiento_stock();

CREATE OR REPLACE FUNCTION public.fn_bloquear_eliminacion_movimiento_stock()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'stock_movimientos es append-only: no se permite DELETE. ID: %', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_stock_movimientos_bloquear_delete
BEFORE DELETE ON public.stock_movimientos
FOR EACH ROW
EXECUTE FUNCTION public.fn_bloquear_eliminacion_movimiento_stock();

-- TRUNCATE no dispara los triggers de fila: sin este trigger de sentencia,
-- un TRUNCATE vaciaría la tabla saltándose la protección append-only.
CREATE OR REPLACE FUNCTION public.fn_bloquear_truncate_movimiento_stock()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'stock_movimientos es append-only: no se permite TRUNCATE.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_stock_movimientos_bloquear_truncate
BEFORE TRUNCATE ON public.stock_movimientos
FOR EACH STATEMENT
EXECUTE FUNCTION public.fn_bloquear_truncate_movimiento_stock();

-- ============================================================================
-- 5. HELPER DE PERMISOS PARA RLS
-- Lee la matriz roles.areas_permitidas ya existente. No introduce permisos
-- nuevos: solo evita enumerar roles por nombre en cada policy.
-- ============================================================================

CREATE OR REPLACE FUNCTION private.has_area_permission(p_area TEXT, p_accion TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'private', 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_roles ur
    JOIN public.roles r ON ur.rol_id = r.id
    WHERE ur.usuario_id = auth.uid()
      AND (r.areas_permitidas -> p_area ->> p_accion)::boolean IS TRUE
  );
$$;

-- ============================================================================
-- 6. RLS
-- Patrón del proyecto: centro_id = get_centro_id() + permiso del área.
-- stock_movimientos no recibe policies de UPDATE ni DELETE (append-only).
-- ============================================================================

ALTER TABLE public.stock_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movimientos ENABLE ROW LEVEL SECURITY;

-- stock_categorias
CREATE POLICY stock_categorias_select ON public.stock_categorias
  FOR SELECT USING (
    centro_id = get_centro_id() AND private.has_area_permission('Stock', 'ver')
  );

CREATE POLICY stock_categorias_insert ON public.stock_categorias
  FOR INSERT WITH CHECK (
    centro_id = get_centro_id() AND private.has_area_permission('Stock', 'crear')
  );

CREATE POLICY stock_categorias_update ON public.stock_categorias
  FOR UPDATE USING (
    centro_id = get_centro_id() AND private.has_area_permission('Stock', 'editar')
  );

-- stock_productos
CREATE POLICY stock_productos_select ON public.stock_productos
  FOR SELECT USING (
    centro_id = get_centro_id() AND private.has_area_permission('Stock', 'ver')
  );

CREATE POLICY stock_productos_insert ON public.stock_productos
  FOR INSERT WITH CHECK (
    centro_id = get_centro_id() AND private.has_area_permission('Stock', 'crear')
  );

CREATE POLICY stock_productos_update ON public.stock_productos
  FOR UPDATE USING (
    centro_id = get_centro_id() AND private.has_area_permission('Stock', 'editar')
  );

-- stock_movimientos: solo lectura e inserción; nunca UPDATE ni DELETE
CREATE POLICY stock_movimientos_select ON public.stock_movimientos
  FOR SELECT USING (
    centro_id = get_centro_id() AND private.has_area_permission('Stock', 'ver')
  );

CREATE POLICY stock_movimientos_insert ON public.stock_movimientos
  FOR INSERT WITH CHECK (
    centro_id = get_centro_id() AND private.has_area_permission('Stock', 'editar')
  );

-- ============================================================================
-- 7. RPC: registrar_movimiento_stock()
-- Única operación autorizada a modificar stock_productos.stock_actual.
--
-- No usa auth.uid(): devuelve NULL bajo service_role, que es como llaman los
-- endpoints. La identidad la valida el backend y llega por parámetro
-- (mismo patrón que las RPC de Phase 2A).
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
BEGIN
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

  -- 4. Bloqueo pesimista de la fila: serializa operaciones concurrentes
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

  -- Actor técnico, según convención del proyecto
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

  -- 11. Stock materializado
  UPDATE public.stock_productos
  SET stock_actual = v_nuevo,
      updated_at = now(),
      updated_by = v_actor
  WHERE id = p_producto_id;

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
  'Única vía autorizada para alterar stock_productos.stock_actual. Atómica: inserta el movimiento y actualiza el saldo en la misma transacción, con FOR UPDATE sobre el producto.';

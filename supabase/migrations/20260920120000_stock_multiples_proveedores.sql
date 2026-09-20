-- Un material puede venderlo más de un proveedor (para comparar precio o
-- agrupar el pedido y ahorrar gastos de envío). Sustituye al campo suelto
-- stock_productos.proveedor_texto (1 solo proveedor) por una tabla de
-- relación N a N.
CREATE TABLE public.stock_producto_proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES public.stock_productos(id) ON DELETE CASCADE,
  proveedor_texto VARCHAR(200) NOT NULL,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  UNIQUE (producto_id, proveedor_texto),
  CONSTRAINT stock_producto_proveedores_texto_not_empty CHECK (length(trim(proveedor_texto)) > 0)
);

CREATE INDEX idx_stock_producto_proveedores_producto ON public.stock_producto_proveedores (producto_id);

ALTER TABLE public.stock_producto_proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_producto_proveedores_select ON public.stock_producto_proveedores
  FOR SELECT USING (
    centro_id = get_centro_id() AND private.has_area_permission('Stock', 'ver')
  );

CREATE POLICY stock_producto_proveedores_insert ON public.stock_producto_proveedores
  FOR INSERT WITH CHECK (
    centro_id = get_centro_id()
    AND (private.has_area_permission('Stock', 'crear') OR private.has_area_permission('Stock', 'editar'))
  );

CREATE POLICY stock_producto_proveedores_delete ON public.stock_producto_proveedores
  FOR DELETE USING (
    centro_id = get_centro_id() AND private.has_area_permission('Stock', 'editar')
  );

-- Migra el proveedor único que ya hubiera a la tabla nueva.
INSERT INTO public.stock_producto_proveedores (producto_id, proveedor_texto, centro_id, created_by)
SELECT id, trim(proveedor_texto), centro_id, created_by
FROM public.stock_productos
WHERE proveedor_texto IS NOT NULL AND length(trim(proveedor_texto)) > 0
ON CONFLICT (producto_id, proveedor_texto) DO NOTHING;

ALTER TABLE public.stock_productos DROP COLUMN proveedor_texto;
ALTER TABLE public.stock_productos DROP COLUMN proveedor_id;

-- Desglose de facturación por forma de pago (efectivo/tarjeta/transferencia).
-- El total (facturacion) ya existía; esto es solo el desglose informativo
-- que trae el Excel mensual, para poder desplegarlo en el Panel de Control
-- sin perder la vista del global.
ALTER TABLE public.panel_facturacion_mensual
  ADD COLUMN facturacion_efectivo NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN facturacion_tarjeta NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN facturacion_transferencia NUMERIC(12,2) NOT NULL DEFAULT 0;

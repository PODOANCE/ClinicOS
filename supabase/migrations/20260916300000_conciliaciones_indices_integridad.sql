-- ============================================================================
-- MIGRACIÓN: Conciliación bancaria — índices de integridad
-- Fecha: 2026-09-16
--
-- El índice existente unique_factura_movimiento (factura_id, movimiento_bancario_id)
-- solo impide repetir el mismo par factura+movimiento. No impide que dos
-- facturas distintas se concilien contra el mismo movimiento (un pago
-- saldaría dos facturas), ni que una misma factura se concilie contra dos
-- movimientos distintos (se pagaría dos veces). Cada índice protege un
-- invariante distinto; ninguno cubre al otro.
--
-- Se implementan como índices únicos parciales, condicionados a
-- estado = 'ACEPTADA': una fila PROPUESTA o RECHAZADA no reserva nada, y
-- deshacer una conciliación (pasarla a RECHAZADA) libera automáticamente
-- tanto la factura como el movimiento para una nueva propuesta, sin tocar
-- archived_at ni activo.
--
-- Verificado antes de esta migración: 0 filas en conciliaciones, por lo que
-- no hay ningún registro existente que pueda entrar en conflicto.
-- ============================================================================

CREATE UNIQUE INDEX idx_conciliaciones_movimiento_aceptado
  ON public.conciliaciones (movimiento_bancario_id)
  WHERE estado = 'ACEPTADA';

CREATE UNIQUE INDEX idx_conciliaciones_factura_aceptada
  ON public.conciliaciones (factura_id)
  WHERE estado = 'ACEPTADA';

-- Bloque B.3: Agregar estados de lectura para procesamiento de facturas con IA
-- Migración: Extender enum estado_lectura con nuevos valores
-- Fecha: 2026-08-29
-- Razón: B.3 requiere granularidad en estados durante lectura y validación con Claude

-- Estados de lectura:
-- PENDIENTE → factura detectada, todavía no procesada
-- LECTURA_PENDIENTE → proceso de IA en curso
-- LECTURA_EXITOSA → Claude ha devuelto datos estructurados
-- VALIDACION_EXITOSA → nuestros algoritmos han validado los datos
-- ERROR_LECTURA → fallo técnico/IA, permite reintento
-- REVISION_MANUAL → IA respondió, pero datos no superan reglas de validación

ALTER TYPE estado_lectura
  ADD VALUE 'LECTURA_PENDIENTE' AFTER 'PENDIENTE';

ALTER TYPE estado_lectura
  ADD VALUE 'LECTURA_EXITOSA' AFTER 'LECTURA_PENDIENTE';

ALTER TYPE estado_lectura
  ADD VALUE 'VALIDACION_EXITOSA' AFTER 'LECTURA_EXITOSA';

ALTER TYPE estado_lectura
  ADD VALUE 'ERROR_LECTURA' AFTER 'VALIDACION_EXITOSA';

ALTER TYPE estado_lectura
  ADD VALUE 'REVISION_MANUAL' AFTER 'ERROR_LECTURA';

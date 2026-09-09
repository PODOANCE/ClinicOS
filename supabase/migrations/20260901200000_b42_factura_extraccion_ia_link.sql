-- ============================================================================
-- MIGRACIÓN: Vincular factura a su extracción IA aplicada
-- Fecha: 2026-09-01
-- Razón: Auditoría: responder "¿de dónde vinieron estos datos?"
-- ============================================================================

-- 1. AGREGAR FK a extracción IA actualmente aplicada
-- NULL = datos manuales o sin IA aplicada
-- UUID = procede de esta extracción IA
ALTER TABLE facturas
ADD COLUMN extraccion_ia_id UUID REFERENCES facturas_extraccion_ia(id);

-- Comentario:
-- Solo la extracción referenciada aquí es la "aplicada"
-- Las demás en facturas_extraccion_ia son histórico/propuestas

-- 2. CREAR ÍNDICE
CREATE INDEX IF NOT EXISTS idx_facturas_extraccion_ia
ON facturas(extraccion_ia_id);

-- 3. VERIFICACIÓN
SELECT COUNT(*) as total_facturas,
       COUNT(extraccion_ia_id) as con_extraccion_ia,
       COUNT(*) FILTER (WHERE extraccion_ia_id IS NULL) as sin_extraccion_ia
FROM facturas;

SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'facturas'
AND column_name IN ('extraccion_ia_id', 'estado_lectura', 'estado_revision')
ORDER BY ordinal_position;

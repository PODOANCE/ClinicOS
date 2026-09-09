-- ============================================================================
-- MIGRACIÓN: Permitir múltiples extracciones IA por factura
-- Fecha: 2026-09-01
-- Razón: B.4.2 FASE 2A requiere histórico de extracciones
-- ============================================================================

-- 1. AGREGAR COLUMNA usuario_id (nullable, FK a usuarios)
ALTER TABLE facturas_extraccion_ia
ADD COLUMN usuario_id UUID REFERENCES usuarios(id);

-- Comentario para auditoría:
-- - B.3 automático: usuario_id = NULL
-- - B.4.2 manual: usuario_id = auth.uid()
-- - Futuro: agregar campo 'origen' si necesitamos distinguir procesos

-- 2. ELIMINAR UNIQUE(factura_id) — permite múltiples extracciones
ALTER TABLE facturas_extraccion_ia
DROP CONSTRAINT IF EXISTS facturas_extraccion_ia_factura_id_key;

-- 3. CREAR ÍNDICES OPTIMIZADOS
-- Búsqueda rápida por factura (ordenada por tiempo)
CREATE INDEX IF NOT EXISTS idx_extraccion_factura_creado
ON facturas_extraccion_ia(factura_id, creado_en DESC);

-- Búsqueda por usuario (auditoría: quién generó extracciones)
CREATE INDEX IF NOT EXISTS idx_extraccion_usuario
ON facturas_extraccion_ia(usuario_id)
WHERE usuario_id IS NOT NULL;

-- Búsqueda por timestamp (limpieza histórica futura)
CREATE INDEX IF NOT EXISTS idx_extraccion_creado
ON facturas_extraccion_ia(creado_en DESC);

-- 4. VERIFICACIÓN
SELECT COUNT(*) as total_extracciones,
       COUNT(usuario_id) as con_usuario,
       COUNT(*) FILTER (WHERE usuario_id IS NULL) as sistema_automatico
FROM facturas_extraccion_ia;

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'facturas_extraccion_ia'
ORDER BY ordinal_position;

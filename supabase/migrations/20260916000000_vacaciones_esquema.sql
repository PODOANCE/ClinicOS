-- ============================================================================
-- MIGRACIÓN: Vacaciones — esquema + datos reales del sistema antiguo
-- Fecha: 2026-09-16
--
-- Traslada /vacaciones2026/ a ClinicOS:
--   7 trabajadores · 14 festivos · 75 períodos (2026)
--
-- MODELO DEFINITIVO (decisión del cliente, no el del HTML original):
--   - Vacaciones.ver  -> los 4 roles ven el calendario COMPLETO del equipo.
--   - Vacaciones.editar -> solo quien lo tenga (hoy: Administrador del
--     sistema) puede crear/editar/eliminar períodos, festivos y días
--     anuales. No hay flujo de solicitud/aprobación: se decidió
--     explícitamente prescindir de él (igual que Stock.aprobar quedó sin
--     usar). Ambas contraseñas compartidas del HTML antiguo desaparecen:
--     la identidad y el permiso ya vienen de la autenticación real.
--   - Sin API/endpoint nuevo: no hay ningún contador acumulativo ni riesgo
--     de concurrencia (a diferencia de Stock), así que todo el CRUD va
--     directo a Supabase protegido por RLS, como "Hoy".
--
-- vacaciones_trabajadores y vacaciones_festivos usan archivado (activo/
-- archived_at), igual que las tablas de catálogo de Stock.
-- vacaciones_periodos permite DELETE real (igual que 'tareas' y que el
-- propio comportamiento del HTML antiguo): no es un libro contable, es
-- planificación editable, y nada más depende de su id por FK.
--
-- IDs deterministas: uuid5(namespace fijo, 'trabajador:<id_original>' /
-- 'festivo:<id_original>' / 'periodo:<id_original>'), verificados sin
-- colisiones sobre los 7+14+75 registros. Permiten un guard de
-- idempotencia exacto, igual que en la migración de datos de Stock.
-- ============================================================================

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

CREATE TYPE public.vacaciones_periodo_tipo AS ENUM (
  'VACACIONES', 'ASUNTOS_PROPIOS', 'FORMACION', 'BAJA'
);

CREATE TYPE public.vacaciones_festivo_tipo AS ENUM (
  'NACIONAL', 'AUTONOMICO', 'LOCAL', 'CLINICA'
);

-- ============================================================================
-- 2. TABLA: vacaciones_trabajadores
-- ============================================================================

CREATE TABLE public.vacaciones_trabajadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL,
  dias_anuales INTEGER NOT NULL DEFAULT 0,
  orden SMALLINT NOT NULL DEFAULT 0,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  activo BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios_sistema(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios_sistema(id) ON DELETE RESTRICT,

  CONSTRAINT vacaciones_trabajadores_nombre_not_empty CHECK (length(trim(nombre)) > 0),
  CONSTRAINT vacaciones_trabajadores_dias_no_negativo CHECK (dias_anuales >= 0),
  CONSTRAINT vacaciones_trabajadores_color_hex CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE UNIQUE INDEX idx_vacaciones_trabajadores_nombre_unico
  ON public.vacaciones_trabajadores (centro_id, nombre)
  WHERE archived_at IS NULL;

CREATE INDEX idx_vacaciones_trabajadores_centro_activo
  ON public.vacaciones_trabajadores (centro_id, activo);

COMMENT ON COLUMN public.vacaciones_trabajadores.usuario_id IS
  'Enlaza con el login real cuando el trabajador tiene cuenta en ClinicOS. Nullable: puede haber trabajadores sin acceso al sistema. Dos trabajadores pueden compartir el mismo usuario_id (p.ej. Andrés y Celia comparten admin@).';

-- ============================================================================
-- 3. TABLA: vacaciones_festivos
-- ============================================================================

CREATE TABLE public.vacaciones_festivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  tipo public.vacaciones_festivo_tipo NOT NULL,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios_sistema(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios_sistema(id) ON DELETE RESTRICT,

  CONSTRAINT vacaciones_festivos_nombre_not_empty CHECK (length(trim(nombre)) > 0)
);

CREATE UNIQUE INDEX idx_vacaciones_festivos_fecha_unica
  ON public.vacaciones_festivos (centro_id, fecha);

-- ============================================================================
-- 4. TABLA: vacaciones_periodos
-- Sin archived_at/activo: permite DELETE real (como 'tareas' y como el
-- comportamiento exacto del HTML antiguo). Nada depende de su id por FK.
-- ============================================================================

CREATE TABLE public.vacaciones_periodos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trabajador_id UUID NOT NULL REFERENCES public.vacaciones_trabajadores(id) ON DELETE RESTRICT,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  tipo public.vacaciones_periodo_tipo NOT NULL,
  centro_id UUID NOT NULL REFERENCES public.centros(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  created_by UUID NOT NULL REFERENCES public.usuarios_sistema(id) ON DELETE RESTRICT,
  updated_at TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID NOT NULL REFERENCES public.usuarios_sistema(id) ON DELETE RESTRICT,

  CONSTRAINT vacaciones_periodos_fechas_coherentes CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX idx_vacaciones_periodos_trabajador
  ON public.vacaciones_periodos (trabajador_id);

CREATE INDEX idx_vacaciones_periodos_centro_fechas
  ON public.vacaciones_periodos (centro_id, fecha_inicio, fecha_fin);

-- ============================================================================
-- 5. RLS — reutiliza private.has_area_permission(), creada para Stock.
-- ============================================================================

ALTER TABLE public.vacaciones_trabajadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacaciones_festivos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacaciones_periodos     ENABLE ROW LEVEL SECURITY;

-- vacaciones_trabajadores: ver todos, editar solo quien tenga permiso.
-- Sin policy DELETE: se archiva vía UPDATE (activo/archived_at), igual que
-- stock_productos/stock_categorias.
CREATE POLICY vacaciones_trabajadores_select ON public.vacaciones_trabajadores
  FOR SELECT USING (
    centro_id = get_centro_id() AND private.has_area_permission('Vacaciones', 'ver')
  );

CREATE POLICY vacaciones_trabajadores_insert ON public.vacaciones_trabajadores
  FOR INSERT WITH CHECK (
    centro_id = get_centro_id() AND private.has_area_permission('Vacaciones', 'editar')
  );

CREATE POLICY vacaciones_trabajadores_update ON public.vacaciones_trabajadores
  FOR UPDATE USING (
    centro_id = get_centro_id() AND private.has_area_permission('Vacaciones', 'editar')
  );

-- vacaciones_festivos: ver todos, editar completo (incluye DELETE real,
-- igual que el HTML antiguo: nada depende de festivos.id por FK).
CREATE POLICY vacaciones_festivos_select ON public.vacaciones_festivos
  FOR SELECT USING (
    centro_id = get_centro_id() AND private.has_area_permission('Vacaciones', 'ver')
  );

CREATE POLICY vacaciones_festivos_insert ON public.vacaciones_festivos
  FOR INSERT WITH CHECK (
    centro_id = get_centro_id() AND private.has_area_permission('Vacaciones', 'editar')
  );

CREATE POLICY vacaciones_festivos_update ON public.vacaciones_festivos
  FOR UPDATE USING (
    centro_id = get_centro_id() AND private.has_area_permission('Vacaciones', 'editar')
  );

CREATE POLICY vacaciones_festivos_delete ON public.vacaciones_festivos
  FOR DELETE USING (
    centro_id = get_centro_id() AND private.has_area_permission('Vacaciones', 'editar')
  );

-- vacaciones_periodos: ver TODO el calendario del equipo (no ámbito propio:
-- decisión explícita del cliente). Editar/eliminar solo quien tenga permiso.
CREATE POLICY vacaciones_periodos_select ON public.vacaciones_periodos
  FOR SELECT USING (
    centro_id = get_centro_id() AND private.has_area_permission('Vacaciones', 'ver')
  );

CREATE POLICY vacaciones_periodos_insert ON public.vacaciones_periodos
  FOR INSERT WITH CHECK (
    centro_id = get_centro_id() AND private.has_area_permission('Vacaciones', 'editar')
  );

CREATE POLICY vacaciones_periodos_update ON public.vacaciones_periodos
  FOR UPDATE USING (
    centro_id = get_centro_id() AND private.has_area_permission('Vacaciones', 'editar')
  );

CREATE POLICY vacaciones_periodos_delete ON public.vacaciones_periodos
  FOR DELETE USING (
    centro_id = get_centro_id() AND private.has_area_permission('Vacaciones', 'editar')
  );

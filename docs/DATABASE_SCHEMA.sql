-- ClinicOS Database Schema
-- Ejecutar estas migraciones en Supabase SQL Editor
-- Última actualización: 2026-08-07

-- Tabla: usuarios_sistema
-- Usuario especial del sistema para auditoría (created_by)
-- UUID fijo: 00000000-0000-0000-0000-000000000000
-- Este usuario no puede hacer login; solo aparece en auditoría
CREATE TABLE IF NOT EXISTS usuarios_sistema (
  id UUID PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insertar usuario sistema (CRÍTICO: debe existir antes de otras tablas que lo referencien)
INSERT INTO usuarios_sistema (id, nombre, descripcion) VALUES
  ('00000000-0000-0000-0000-000000000000', 'Sistema', 'Usuario del sistema para cambios automáticos')
ON CONFLICT (id) DO NOTHING; -- Evita error si ya existe

-- Tabla: centros
-- Objetos de configuración: sedes de la clínica
-- Necesario desde V1 para preparar multi-centro sin migraciones futuras
CREATE TABLE IF NOT EXISTS centros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES usuarios_sistema(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMP
);

-- Tabla: roles
-- Objetos maestros: define qué Áreas ve y qué acciones permite cada rol
-- Los roles son globales, no dependen de centro
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  areas_permitidas JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabla: usuarios
-- Objetos del sistema: identidad de acceso a la plataforma
-- Vinculado a auth.users de Supabase Auth
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY, -- FK a auth.users
  email TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  centro_id UUID NOT NULL REFERENCES centros(id), -- Preparado para multi-centro
  empleado_id UUID, -- FK a empleados (cuando exista tabla)
  created_by UUID NOT NULL REFERENCES usuarios_sistema(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMP
);

-- Tabla: usuarios_roles
-- Relación M:M entre usuarios y roles
CREATE TABLE IF NOT EXISTS usuarios_roles (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, rol_id)
);

-- Tabla: tareas
-- Objetos operativos: unidad de trabajo
-- El corazón del sistema: conecta datos con personas
CREATE TABLE IF NOT EXISTS tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('abierta', 'hecha')) DEFAULT 'abierta',
  tipo_objeto TEXT,
  objeto_id UUID,
  origen TEXT NOT NULL CHECK (origen IN ('manual', 'area')) DEFAULT 'manual',
  fecha_limite DATE,
  centro_id UUID NOT NULL REFERENCES centros(id), -- Preparado para multi-centro
  created_by UUID NOT NULL REFERENCES usuarios_sistema(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);
CREATE INDEX IF NOT EXISTS idx_usuarios_centro ON usuarios(centro_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_roles_usuario ON usuarios_roles(usuario_id);
CREATE INDEX IF NOT EXISTS idx_tareas_usuario ON tareas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_tareas_estado ON tareas(estado);
CREATE INDEX IF NOT EXISTS idx_tareas_centro ON tareas(centro_id);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha_limite ON tareas(fecha_limite);

-- ============================================================================
-- Row Level Security (RLS) - Decisiones de Seguridad
-- ============================================================================
--
-- NOTA IMPORTANTE: Las políticas RLS son PROVISIONALES en V1
-- Las restricciones definitivas de quién ve qué dependerán de los permisos
-- específicos de cada Área, que se codificarán en la matriz de permisos (JSONB)
-- y se validarán en la capa de aplicación + RLS en Áreas futuras.
--
-- En V1, aplicamos RLS mínimos para:
-- 1. Proteger datos sensibles de forma básica
-- 2. Preparar la infraestructura para validación por rol
-- 3. Evitar bloqueos innecesarios que impidan desarrollo
--
-- Cuando se construyan Áreas (Facturas, Stock, Leads, Vacaciones),
-- se añadirán políticas RLS específicas que validen roles + permisos.
-- ============================================================================

-- Tabla: usuarios_sistema
-- Sin RLS: solo para auditoría
-- No requiere restricciones

-- Tabla: centros
-- Sin RLS de momento: configuración administrativa
-- Se agregará RLS cuando exista gestión multi-centro

-- Tabla: roles
-- Lectura pública: todos los usuarios necesitan leer roles para resolver permisos
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_lectura_publica" ON roles
  FOR SELECT USING (TRUE);

-- Tabla: usuarios
-- LECTURA PÚBLICA (provisional V1):
-- Todos pueden ver datos básicos de usuarios activos (nombre, email)
-- RAZÓN: Necesitamos mostrar "Asignado a Juan", "Creado por María", etc.
-- La restricción definitiva por Área se implementará cuando se construyan las Áreas
-- EVOLUCIÓN: En Fase 3+, se agregará validación por rol (e.g., solo admin puede ver todo)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_lectura_activos" ON usuarios
  FOR SELECT USING (activo = TRUE);

CREATE POLICY "usuarios_editar_propio_perfil" ON usuarios
  FOR UPDATE USING (id = auth.uid());

-- Tabla: usuarios_roles
-- Lectura: cada usuario ve sus propios roles
-- Esta restricción es permanente: necesaria para auditoría y control de acceso
ALTER TABLE usuarios_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_ver_propios_roles" ON usuarios_roles
  FOR SELECT USING (usuario_id = auth.uid());

-- Tabla: tareas
-- LECTURA: cada usuario ve solo sus propias tareas abiertas
-- RAZÓN: Las tareas son trabajo personal; Hoy solo muestra lo del usuario
-- EXCEPCIÓN: Administración verá todas las tareas (se implementará en Fase 2 con Área de Hoy)
-- EVOLUCIÓN: Cuando se construya el Área de Hoy, se agregará validación por rol
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tareas_ver_propias" ON tareas
  FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "tareas_crear_propias" ON tareas
  FOR INSERT WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "tareas_editar_propias" ON tareas
  FOR UPDATE USING (usuario_id = auth.uid());

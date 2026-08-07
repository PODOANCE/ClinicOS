-- ClinicOS Database Schema
-- Ejecutar estas migraciones en Supabase SQL Editor

-- Tabla: roles
-- Objetos maestros: define qué Áreas ve y qué acciones permite cada rol
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  areas_permitidas JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabla: usuarios
-- Objetos del sistema: identidad de acceso a la plataforma
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY, -- Vinculado a auth.users
  email TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  empleado_id UUID, -- FK a empleados (cuando exista tabla)
  created_by TEXT NOT NULL DEFAULT 'system',
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
  created_by UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);
CREATE INDEX IF NOT EXISTS idx_usuarios_roles_usuario ON usuarios_roles(usuario_id);
CREATE INDEX IF NOT EXISTS idx_tareas_usuario ON tareas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_tareas_estado ON tareas(estado);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha_limite ON tareas(fecha_limite);

-- Row Level Security (RLS)
-- Los usuarios solo ven sus propias tareas
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_ver_propias_tareas" ON tareas
  FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "usuarios_crear_propias_tareas" ON tareas
  FOR INSERT WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "usuarios_editar_propias_tareas" ON tareas
  FOR UPDATE USING (usuario_id = auth.uid());

-- Los usuarios pueden ver su propio perfil
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_ver_propio_perfil" ON usuarios
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "usuarios_editar_propio_perfil" ON usuarios
  FOR UPDATE USING (id = auth.uid());

-- Los roles son públicos (lectura)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_lectura_publica" ON roles
  FOR SELECT USING (TRUE);

-- Los usuarios pueden ver sus propios roles asignados
ALTER TABLE usuarios_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_ver_propios_roles" ON usuarios_roles
  FOR SELECT USING (usuario_id = auth.uid());

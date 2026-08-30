// Usuario: identidad de acceso a la plataforma
export interface Usuario {
  id: string; // UUID
  email: string; // Identificador único
  nombre: string;
  activo: boolean;
  empleado_id?: string; // FK a empleados (opcional)
  created_by: string; // FK a usuarios
  created_at: string;
  updated_at: string;
  archived_at?: string;
}

// Rol: define qué Áreas ve y qué puede hacer
export interface Rol {
  id: string; // UUID
  nombre: string; // "Administrador del sistema", "Administración", "Podólogo", "Ortopedia"
  areas_permitidas: Record<string, AreaPermiso>; // { "Facturas": {...}, "Stock": {...} }
  created_at: string;
  updated_at: string;
}

// Permisos dentro de una Área
export interface AreaPermiso {
  ver: boolean;
  crear?: boolean;
  editar?: boolean;
  aprobar?: boolean;
  archivar?: boolean;
  ambito?: 'todo' | 'propio'; // 'propio' para ver solo datos del usuario (e.g., sus tareas)
}

// Relación Usuario-Rol (M:M)
export interface UsuarioRol {
  usuario_id: string; // FK
  rol_id: string; // FK
  created_at: string;
}

// Sesión del usuario conectado
export interface SesionUsuario extends Usuario {
  roles: Rol[];
}

// Tarea: unidad de trabajo asignada a un usuario
export interface Tarea {
  id: string;
  usuario_id: string;
  titulo: string;
  descripcion?: string | null;
  estado: 'abierta' | 'hecha';
  tipo_objeto?: string | null;
  objeto_id?: string | null;
  origen: 'manual' | 'area';
  fecha_limite?: string | null;
  centro_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}

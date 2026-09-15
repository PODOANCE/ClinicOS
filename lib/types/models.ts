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

// Categoría de Stock: jerarquía de 2 niveles (área > grupo)
export interface StockCategoria {
  id: string;
  nombre: string;
  padre_id: string | null; // null en nivel 1
  nivel: 1 | 2;
  orden: number;
  centro_id: string;
  activo: boolean;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

// Producto de Stock: stock_actual es un valor materializado, fuente de
// verdad = stock_movimientos. Nunca se edita directamente.
export interface StockProducto {
  id: string;
  nombre: string;
  unidad: string;
  categoria_id: string;
  stock_actual: number;
  stock_minimo: number;
  stock_critico: number;
  proveedor_id: string | null;
  proveedor_texto: string | null;
  notas?: string | null;
  centro_id: string;
  activo: boolean;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type StockMovimientoTipo = 'ENTRADA' | 'CONSUMO' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO';

export interface StockMovimiento {
  id: string;
  producto_id: string;
  tipo: StockMovimientoTipo;
  cantidad: number;
  stock_resultante: number;
  motivo?: string | null;
  coste_unitario?: number | null;
  usuario_id: string;
  centro_id: string;
  created_at: string;
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

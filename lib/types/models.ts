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

// Trabajador de Vacaciones: entidad propia del módulo, opcionalmente
// vinculada a un usuario real (usuario_id nullable; puede haber
// trabajadores compartiendo el mismo usuario_id, p.ej. Andrés y Celia)
export interface VacacionesTrabajador {
  id: string;
  nombre: string;
  color: string; // hex #RRGGBB
  dias_anuales: number;
  orden: number;
  usuario_id: string | null;
  centro_id: string;
  activo: boolean;
  archived_at?: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export type VacacionesFestivoTipo = 'NACIONAL' | 'AUTONOMICO' | 'LOCAL' | 'CLINICA';

export interface VacacionesFestivo {
  id: string;
  fecha: string;
  nombre: string;
  tipo: VacacionesFestivoTipo;
  centro_id: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export type VacacionesPeriodoTipo = 'VACACIONES' | 'ASUNTOS_PROPIOS' | 'FORMACION' | 'BAJA';

export interface VacacionesPeriodo {
  id: string;
  trabajador_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  tipo: VacacionesPeriodoTipo;
  centro_id: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

// Panel de Control 360°: BI financiero interno (facturación, gastos,
// equipo, comisiones). Área propia 'PanelControl', solo Administración y
// Administrador del sistema.
export interface PanelServicio {
  id: string;
  nombre: string;
  precio: number;
  centro_id: string;
}

export interface PanelFacturacionMensual {
  id: string;
  anio: number;
  mes: number;
  facturacion: number;
  pacientes_nuevos: number;
  centro_id: string;
}

export interface PanelServicioRealizado {
  id: string;
  servicio: string;
  anio: number;
  mes: number;
  cantidad: number;
  centro_id: string;
}

export interface PanelServicioPorProfesional {
  id: string;
  servicio: string;
  anio: number;
  mes: number;
  profesional: string;
  cantidad: number;
  centro_id: string;
}

export type PanelGastoTipo = 'VARIABLE' | 'FIJO';

export interface PanelGasto {
  id: string;
  tipo: PanelGastoTipo;
  concepto: string;
  valor_anual: number;
  centro_id: string;
}

export interface PanelEquipoMiembro {
  id: string;
  nombre: string;
  rol: string | null;
  salario_anual: number;
  centro_id: string;
}

export interface PanelComisionesReglas {
  centro_id: string;
  umbral_clinica: number;
  umbral_bonus: number;
  tope_comision: number;
  sp_base: number;
  sp_importe_base: number;
  sp_tramo: number;
  sp_incremento: number;
  pl_base: number;
  pl_importe_base: number;
  pl_tramo: number;
  pl_incremento: number;
  bonus_recepcion: number;
  profesionales_comisionan: string[];
}

export interface PanelComisionMensual {
  id: string;
  anio: number;
  mes: number;
  profesional: string;
  fact_con_plantillas: number;
  fact_sin_plantillas: number;
  total_plantillas: number;
  centro_id: string;
}

export type LeadsResultado = 'CITA_NUEVO' | 'CITA_CONOCIDO' | 'NO_NUEVO' | 'NO_CONOCIDO' | 'SEGURO';

// Llamada de lead registrada en recepción: un registro por llamada recibida
export interface LeadLlamada {
  id: string;
  fecha: string;
  servicio: string;
  canal: string | null;
  localidad: string | null;
  resultado: LeadsResultado;
  motivo: string | null;
  reembolso: string | null;
  telefono: string | null;
  centro_id: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
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

// Seguimiento de revisiones (Biomecánica): cita importada de Organízate
// (estudio o revisión). Nunca se edita a mano; solo lectura desde el
// cliente, el alta va por /api/seguimiento/importar.
export interface SeguimientoCita {
  id: string;
  fecha: string;
  hora: string | null;
  agenda: string | null;
  sala: string | null;
  paciente_raw: string;
  paciente_clave: string;
  tratamiento: string;
  precio: number | null;
  estado_cita: string | null;
  huella: string;
  archivo_importacion_id: string | null;
  centro_id: string;
  activo: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export type SeguimientoGestionEstado =
  | 'PENDIENTE'
  | 'LLAMADO_NO_CONTESTA'
  | 'CITA_AGENDADA'
  | 'RECHAZA'
  | 'VOLVER_A_LLAMAR';

// Seguimiento de revisiones: una fila por paciente con lo único que el
// personal gestiona a mano. El resto (estado, prioridad, etc.) se calcula
// en la aplicación a partir de SeguimientoCita, ver lib/services/seguimiento.ts.
export interface SeguimientoGestion {
  id: string;
  paciente_clave: string;
  nombre_mostrar: string;
  cita_futura_manual: boolean;
  gestion_recontacto: SeguimientoGestionEstado;
  proximo_intento: string | null;
  notas: string | null;
  centro_id: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

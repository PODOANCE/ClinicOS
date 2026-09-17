import { createClient } from '@/lib/supabase/browser'
import type {
  PanelServicio,
  PanelFacturacionMensual,
  PanelServicioRealizado,
  PanelServicioPorProfesional,
  PanelGasto,
  PanelGastoTipo,
  PanelEquipoMiembro,
  PanelComisionesReglas,
  PanelComisionMensual,
} from '@/lib/types/models'

/**
 * Lectura/escritura directa contra Supabase, protegida por RLS (área
 * PanelControl). Mismo patrón que Vacaciones/Leads: sin endpoint.
 */

export async function getPanelServicios(): Promise<PanelServicio[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('panel_servicios').select('*').order('nombre')
  if (error) throw error
  return (data as PanelServicio[]) || []
}
export async function crearPanelServicio(input: { nombre: string; precio: number; centro_id: string; actorId: string }) {
  const { actorId, ...campos } = input
  const supabase = createClient() as any
  const { data, error } = await supabase.from('panel_servicios').insert({ ...campos, created_by: actorId, updated_by: actorId }).select().single()
  if (error) throw error
  return data as PanelServicio
}
export async function actualizarPanelServicio(id: string, input: Partial<{ nombre: string; precio: number }>, actorId: string) {
  const supabase = createClient() as any
  const { data, error } = await supabase.from('panel_servicios').update({ ...input, updated_by: actorId }).eq('id', id).select().single()
  if (error) throw error
  return data as PanelServicio
}
export async function eliminarPanelServicio(id: string) {
  const supabase = createClient() as any
  const { error } = await supabase.from('panel_servicios').delete().eq('id', id)
  if (error) throw error
}

export async function getPanelFacturacion(): Promise<PanelFacturacionMensual[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('panel_facturacion_mensual').select('*').order('anio').order('mes')
  if (error) throw error
  return (data as PanelFacturacionMensual[]) || []
}
export async function upsertPanelFacturacion(input: { anio: number; mes: number; facturacion: number; pacientes_nuevos: number; centro_id: string; actorId: string }) {
  const { actorId, ...campos } = input
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('panel_facturacion_mensual')
    .upsert({ ...campos, created_by: actorId, updated_by: actorId }, { onConflict: 'centro_id,anio,mes' })
    .select()
    .single()
  if (error) throw error
  return data as PanelFacturacionMensual
}

export async function getPanelServiciosRealizados(): Promise<PanelServicioRealizado[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('panel_servicios_realizados').select('*')
  if (error) throw error
  return (data as PanelServicioRealizado[]) || []
}
export async function upsertPanelServicioRealizado(input: { servicio: string; anio: number; mes: number; cantidad: number; centro_id: string; actorId: string }) {
  const { actorId, ...campos } = input
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('panel_servicios_realizados')
    .upsert({ ...campos, created_by: actorId, updated_by: actorId }, { onConflict: 'centro_id,servicio,anio,mes' })
    .select()
    .single()
  if (error) throw error
  return data as PanelServicioRealizado
}
export async function eliminarPanelServicioRealizadoPorNombre(servicio: string) {
  const supabase = createClient() as any
  const { error } = await supabase.from('panel_servicios_realizados').delete().eq('servicio', servicio)
  if (error) throw error
}

export async function getPanelServiciosPorProfesional(): Promise<PanelServicioPorProfesional[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('panel_servicios_por_profesional').select('*')
  if (error) throw error
  return (data as PanelServicioPorProfesional[]) || []
}
export async function upsertPanelServicioPorProfesional(input: {
  servicio: string
  anio: number
  mes: number
  profesional: string
  cantidad: number
  centro_id: string
  actorId: string
}) {
  const { actorId, ...campos } = input
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('panel_servicios_por_profesional')
    .upsert({ ...campos, created_by: actorId, updated_by: actorId }, { onConflict: 'centro_id,servicio,anio,mes,profesional' })
    .select()
    .single()
  if (error) throw error
  return data as PanelServicioPorProfesional
}

export async function getPanelGastos(): Promise<PanelGasto[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('panel_gastos').select('*').order('concepto')
  if (error) throw error
  return (data as PanelGasto[]) || []
}
export async function crearPanelGasto(input: { tipo: PanelGastoTipo; concepto: string; valor_anual: number; centro_id: string; actorId: string }) {
  const { actorId, ...campos } = input
  const supabase = createClient() as any
  const { data, error } = await supabase.from('panel_gastos').insert({ ...campos, created_by: actorId, updated_by: actorId }).select().single()
  if (error) throw error
  return data as PanelGasto
}
export async function actualizarPanelGasto(id: string, input: Partial<{ concepto: string; valor_anual: number }>, actorId: string) {
  const supabase = createClient() as any
  const { data, error } = await supabase.from('panel_gastos').update({ ...input, updated_by: actorId }).eq('id', id).select().single()
  if (error) throw error
  return data as PanelGasto
}
export async function eliminarPanelGasto(id: string) {
  const supabase = createClient() as any
  const { error } = await supabase.from('panel_gastos').delete().eq('id', id)
  if (error) throw error
}

export async function getPanelEquipo(): Promise<PanelEquipoMiembro[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('panel_equipo').select('*').order('nombre')
  if (error) throw error
  return (data as PanelEquipoMiembro[]) || []
}
export async function crearPanelEquipoMiembro(input: { nombre: string; rol: string | null; salario_anual: number; centro_id: string; actorId: string }) {
  const { actorId, ...campos } = input
  const supabase = createClient() as any
  const { data, error } = await supabase.from('panel_equipo').insert({ ...campos, created_by: actorId, updated_by: actorId }).select().single()
  if (error) throw error
  return data as PanelEquipoMiembro
}
export async function actualizarPanelEquipoMiembro(id: string, input: Partial<{ nombre: string; rol: string | null; salario_anual: number }>, actorId: string) {
  const supabase = createClient() as any
  const { data, error } = await supabase.from('panel_equipo').update({ ...input, updated_by: actorId }).eq('id', id).select().single()
  if (error) throw error
  return data as PanelEquipoMiembro
}
export async function eliminarPanelEquipoMiembro(id: string) {
  const supabase = createClient() as any
  const { error } = await supabase.from('panel_equipo').delete().eq('id', id)
  if (error) throw error
}

export async function getPanelComisionesReglas(): Promise<PanelComisionesReglas | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from('panel_comisiones_reglas').select('*').maybeSingle()
  if (error) throw error
  return data as PanelComisionesReglas | null
}

export async function getPanelComisionesMensual(): Promise<PanelComisionMensual[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('panel_comisiones_mensual').select('*')
  if (error) throw error
  return (data as PanelComisionMensual[]) || []
}
export async function upsertPanelComisionMensual(input: {
  anio: number
  mes: number
  profesional: string
  fact_con_plantillas: number
  fact_sin_plantillas: number
  total_plantillas: number
  centro_id: string
  actorId: string
}) {
  const { actorId, ...campos } = input
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('panel_comisiones_mensual')
    .upsert({ ...campos, created_by: actorId, updated_by: actorId }, { onConflict: 'centro_id,anio,mes,profesional' })
    .select()
    .single()
  if (error) throw error
  return data as PanelComisionMensual
}

import { createClient } from '@/lib/supabase/browser'
import type { PresupuestoTema, PresupuestoVariante, Presupuesto } from '@/lib/types/models'

/**
 * Lectura/escritura directa contra Supabase, protegida por RLS (área
 * Presupuestos) — mismo patrón que Vacaciones/Leads/Stock.
 */

export async function getTemas(): Promise<PresupuestoTema[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('presupuestos_temas')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true })
  if (error) throw error
  return (data as PresupuestoTema[]) || []
}

export async function getVariantes(): Promise<PresupuestoVariante[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('presupuestos_variantes')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true })
  if (error) throw error
  return (data as PresupuestoVariante[]) || []
}

export async function getPresupuestos(): Promise<Presupuesto[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('presupuestos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as Presupuesto[]) || []
}

export async function getPresupuesto(id: string): Promise<Presupuesto | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from('presupuestos').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Presupuesto | null
}

export async function crearPresupuesto(input: {
  numero: string
  fecha: string
  pacienteNombre: string
  pacienteDni: string | null
  pacienteDireccion: string | null
  pacienteClave: string | null
  temaId: string | null
  varianteId: string | null
  concepto: string
  precio: number
  centroId: string
  actorId: string
}): Promise<Presupuesto> {
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('presupuestos')
    .insert({
      numero: input.numero,
      fecha: input.fecha,
      paciente_nombre: input.pacienteNombre,
      paciente_dni: input.pacienteDni,
      paciente_direccion: input.pacienteDireccion,
      paciente_clave: input.pacienteClave,
      tema_id: input.temaId,
      variante_id: input.varianteId,
      concepto: input.concepto,
      precio: input.precio,
      centro_id: input.centroId,
      created_by: input.actorId,
    })
    .select()
    .single()
  if (error) throw error
  return data as Presupuesto
}

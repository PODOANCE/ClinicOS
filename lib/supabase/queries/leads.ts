import { createClient } from '@/lib/supabase/browser'
import type { LeadLlamada, LeadsResultado } from '@/lib/types/models'

/**
 * Lectura/escritura directa contra Supabase, protegida por RLS, igual que
 * Vacaciones. Sin endpoint: no hay ningún cálculo protegido ni concurrencia
 * que lo justifique.
 */

export async function getLeadsLlamadas(): Promise<LeadLlamada[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('leads_llamadas')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(2000)

  if (error) {
    console.error('[getLeadsLlamadas] Error:', error.message)
    throw error
  }
  return (data as LeadLlamada[]) || []
}

export async function crearLeadLlamada(input: {
  fecha: string
  servicio: string
  canal: string | null
  localidad: string | null
  resultado: LeadsResultado
  motivo: string | null
  reembolso: string | null
  telefono: string | null
  centro_id: string
  actorId: string
}): Promise<LeadLlamada> {
  const { actorId, ...campos } = input
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('leads_llamadas')
    .insert({ ...campos, created_by: actorId, updated_by: actorId })
    .select()
    .single()

  if (error) {
    console.error('[crearLeadLlamada] Error:', error.message)
    throw error
  }
  return data as LeadLlamada
}

export async function eliminarLeadLlamada(id: string): Promise<void> {
  const supabase = createClient() as any
  const { error } = await supabase.from('leads_llamadas').delete().eq('id', id)
  if (error) {
    console.error('[eliminarLeadLlamada] Error:', error.message)
    throw error
  }
}

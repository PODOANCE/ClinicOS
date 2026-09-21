import { createClient } from '@/lib/supabase/browser'
import type { ConsentimientoTema, ConsentimientoVariante, Consentimiento } from '@/lib/types/models'

/**
 * Lectura/escritura directa contra Supabase, protegida por RLS (área
 * Consentimientos) — mismo patrón que Presupuestos.
 */

export async function getTemasConsentimiento(): Promise<ConsentimientoTema[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('consentimientos_temas')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true })
  if (error) throw error
  return (data as ConsentimientoTema[]) || []
}

export async function getTemaConsentimiento(id: string): Promise<ConsentimientoTema | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from('consentimientos_temas').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as ConsentimientoTema | null
}

export async function getVariantesConsentimiento(): Promise<ConsentimientoVariante[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('consentimientos_variantes')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true })
  if (error) throw error
  return (data as ConsentimientoVariante[]) || []
}

export async function getConsentimientos(): Promise<Consentimiento[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('consentimientos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as Consentimiento[]) || []
}

export async function getConsentimiento(id: string): Promise<Consentimiento | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from('consentimientos').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Consentimiento | null
}

export async function crearConsentimiento(input: {
  fecha: string
  pacienteNombre: string
  pacienteNif: string | null
  pacienteTelefono: string | null
  pacienteHistoriaClinica: string | null
  pacienteClave: string | null
  podologos: string
  temaId: string | null
  varianteId: string | null
  procedimientoTitulo: string
  descripcionColoquial: string
  centroId: string
  actorId: string
}): Promise<Consentimiento> {
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('consentimientos')
    .insert({
      fecha: input.fecha,
      paciente_nombre: input.pacienteNombre,
      paciente_nif: input.pacienteNif,
      paciente_telefono: input.pacienteTelefono,
      paciente_historia_clinica: input.pacienteHistoriaClinica,
      paciente_clave: input.pacienteClave,
      podologos: input.podologos,
      tema_id: input.temaId,
      variante_id: input.varianteId,
      procedimiento_titulo: input.procedimientoTitulo,
      descripcion_coloquial: input.descripcionColoquial,
      centro_id: input.centroId,
      created_by: input.actorId,
    })
    .select()
    .single()
  if (error) throw error
  return data as Consentimiento
}

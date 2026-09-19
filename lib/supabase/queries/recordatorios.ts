import { createClient } from '@/lib/supabase/browser'
import type { RecordatorioPlantilla, RecordatorioTipo } from '@/lib/types/models'

/**
 * Lectura/escritura directa contra Supabase, protegida por RLS (área
 * Seguimiento). Mismo patrón que Vacaciones/Leads/Panel: sin endpoint.
 */

export async function getRecordatoriosPlantilla(centroId: string, tipo: RecordatorioTipo): Promise<RecordatorioPlantilla | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('recordatorios_plantilla')
    .select('*')
    .eq('centro_id', centroId)
    .eq('tipo', tipo)
    .maybeSingle()
  if (error) throw error
  return data as RecordatorioPlantilla | null
}

export async function actualizarRecordatoriosPlantilla(input: {
  centroId: string
  tipo: RecordatorioTipo
  texto: string
  actorId: string
}) {
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('recordatorios_plantilla')
    .upsert(
      { centro_id: input.centroId, tipo: input.tipo, texto: input.texto, updated_by: input.actorId },
      { onConflict: 'centro_id,tipo' }
    )
    .select()
    .single()
  if (error) throw error
  return data as RecordatorioPlantilla
}

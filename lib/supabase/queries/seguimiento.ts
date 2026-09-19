import { createClient } from '@/lib/supabase/browser'
import type { SeguimientoCita, SeguimientoGestion, SeguimientoGestionEstado } from '@/lib/types/models'

/**
 * Lectura/escritura directa contra Supabase, protegida por RLS
 * (private.has_area_permission('Seguimiento', ...)) — igual que
 * Vacaciones/Leads. seguimiento_citas es de solo lectura desde aquí: el
 * alta va por /api/seguimiento/importar con service_role.
 */

// PostgREST limita cada respuesta a 1000 filas por defecto (db-max-rows),
// pase lo que pase en .limit() del cliente. Con >1000 citas o pacientes,
// un solo .select() se corta en silencio y da conteos incorrectos — hay
// que paginar con .range() y unir las páginas.
const TAMANO_PAGINA = 1000

export async function getSeguimientoCitas(): Promise<SeguimientoCita[]> {
  const supabase = createClient()
  const todas: SeguimientoCita[] = []
  let desde = 0

  for (;;) {
    const { data, error } = await supabase
      .from('seguimiento_citas')
      .select('*')
      .eq('activo', true)
      .order('fecha', { ascending: false })
      .range(desde, desde + TAMANO_PAGINA - 1)

    if (error) {
      console.error('[getSeguimientoCitas] Error:', error.message)
      throw error
    }
    todas.push(...((data as SeguimientoCita[]) || []))
    if (!data || data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }

  return todas
}

export async function getSeguimientoGestion(): Promise<SeguimientoGestion[]> {
  const supabase = createClient()
  const todas: SeguimientoGestion[] = []
  let desde = 0

  for (;;) {
    const { data, error } = await supabase
      .from('seguimiento_gestion')
      .select('*')
      .range(desde, desde + TAMANO_PAGINA - 1)

    if (error) {
      console.error('[getSeguimientoGestion] Error:', error.message)
      throw error
    }
    todas.push(...((data as SeguimientoGestion[]) || []))
    if (!data || data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }

  return todas
}

export async function actualizarGestion(input: {
  pacienteClave: string
  nombreMostrar: string
  centroId: string
  citaFuturaManual?: boolean
  citaFuturaFecha?: string | null
  gestionRecontacto?: SeguimientoGestionEstado
  proximoIntento?: string | null
  notas?: string | null
  actorId: string
}): Promise<SeguimientoGestion> {
  const { pacienteClave, nombreMostrar, centroId, actorId, ...campos } = input
  const supabase = createClient() as any

  const actualizacion: Record<string, unknown> = { updated_by: actorId }
  if (campos.citaFuturaManual !== undefined) actualizacion.cita_futura_manual = campos.citaFuturaManual
  if (campos.citaFuturaFecha !== undefined) actualizacion.cita_futura_fecha = campos.citaFuturaFecha
  if (campos.gestionRecontacto !== undefined) actualizacion.gestion_recontacto = campos.gestionRecontacto
  if (campos.proximoIntento !== undefined) actualizacion.proximo_intento = campos.proximoIntento
  if (campos.notas !== undefined) actualizacion.notas = campos.notas

  const { data, error } = await supabase
    .from('seguimiento_gestion')
    .upsert(
      {
        paciente_clave: pacienteClave,
        nombre_mostrar: nombreMostrar,
        centro_id: centroId,
        created_by: actorId,
        ...actualizacion,
      },
      { onConflict: 'paciente_clave,centro_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('[actualizarGestion] Error:', error.message)
    throw error
  }
  return data as SeguimientoGestion
}

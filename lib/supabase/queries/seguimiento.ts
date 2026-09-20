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

// Solo citas de biomecánica/plantillas/revisión: es lo único que alimenta
// el panel de Seguimiento. seguimiento_citas también guarda el resto de
// tratamientos (para el gasto total por paciente), pero esos no deben
// entrar aquí — usa getHistorialPaciente() para el histórico completo.
export async function getSeguimientoCitas(): Promise<SeguimientoCita[]> {
  const supabase = createClient()
  const todas: SeguimientoCita[] = []
  let desde = 0

  for (;;) {
    const { data, error } = await supabase
      .from('seguimiento_citas')
      .select('*')
      .eq('activo', true)
      .eq('es_seguimiento', true)
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

// Citas de Quiropodia de todos los pacientes (para el aviso de recontacto
// anual) — filtra en servidor por tratamiento en vez de traer toda la tabla.
export async function getCitasQuiropodia(): Promise<SeguimientoCita[]> {
  const supabase = createClient()
  const todas: SeguimientoCita[] = []
  let desde = 0

  for (;;) {
    const { data, error } = await supabase
      .from('seguimiento_citas')
      .select('*')
      .eq('activo', true)
      .ilike('tratamiento', '%quiropodia%')
      .range(desde, desde + TAMANO_PAGINA - 1)

    if (error) {
      console.error('[getCitasQuiropodia] Error:', error.message)
      throw error
    }
    todas.push(...((data as SeguimientoCita[]) || []))
    if (!data || data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }

  return todas
}

// Última fecha de CUALQUIER visita por paciente (no solo Quiropodia) — para
// no avisar de recontacto a alguien que en realidad estuvo hace poco en la
// clínica por otro motivo (ej. plantillas, láser...). Solo trae
// paciente_clave+fecha, no toda la fila, porque puede ser toda la tabla.
export async function getUltimasVisitasPorPaciente(): Promise<Map<string, string>> {
  const supabase = createClient()
  const ultimaPorClave = new Map<string, string>()
  let desde = 0

  for (;;) {
    const { data, error } = await supabase
      .from('seguimiento_citas')
      .select('paciente_clave, fecha')
      .eq('activo', true)
      .range(desde, desde + TAMANO_PAGINA - 1)

    if (error) {
      console.error('[getUltimasVisitasPorPaciente] Error:', error.message)
      throw error
    }
    for (const fila of (data as { paciente_clave: string; fecha: string }[]) || []) {
      const actual = ultimaPorClave.get(fila.paciente_clave)
      if (!actual || fila.fecha > actual) ultimaPorClave.set(fila.paciente_clave, fila.fecha)
    }
    if (!data || data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }

  return ultimaPorClave
}

export interface RankingPaciente {
  paciente_clave: string
  gasto: number
  num_visitas: number
}

// Ranking de pacientes por gasto (año concreto o global si anio es null).
// Solo Administrador del sistema: la RPC ya lo comprueba en el servidor,
// para cualquier otro rol simplemente no devuelve filas.
export async function getRankingPacientes(anio: number | null, limite = 20): Promise<RankingPaciente[]> {
  const supabase = createClient() as any
  const { data, error } = await supabase.rpc('get_ranking_pacientes', { p_anio: anio, p_limite: limite })
  if (error) {
    console.error('[getRankingPacientes] Error:', error.message)
    throw error
  }
  return (data as RankingPaciente[]) || []
}

// Histórico completo de un paciente (todos los tratamientos, no solo
// biomecánica) para la ficha única de paciente: línea temporal y gasto
// total. A diferencia de getSeguimientoCitas(), no filtra por
// es_seguimiento — aquí interesa todo lo que se le ha hecho y cobrado.
export async function getHistorialPaciente(pacienteClave: string): Promise<SeguimientoCita[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('seguimiento_citas')
    .select('*')
    .eq('activo', true)
    .eq('paciente_clave', pacienteClave)
    .order('fecha', { ascending: false })

  if (error) {
    console.error('[getHistorialPaciente] Error:', error.message)
    throw error
  }
  return (data as SeguimientoCita[]) || []
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

// Fila de gestión de un paciente concreto (solo existe si alguna vez tuvo
// una cita de seguimiento) — para la ficha única de paciente.
export async function getGestionPorClave(pacienteClave: string): Promise<SeguimientoGestion | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('seguimiento_gestion')
    .select('*')
    .eq('paciente_clave', pacienteClave)
    .maybeSingle()

  if (error) {
    console.error('[getGestionPorClave] Error:', error.message)
    throw error
  }
  return data as SeguimientoGestion | null
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

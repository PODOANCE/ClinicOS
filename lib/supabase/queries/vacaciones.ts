import { createClient, handleJWTError, isJWTClockSkewError } from '@/lib/supabase/browser'
import type {
  VacacionesTrabajador,
  VacacionesFestivo,
  VacacionesPeriodo,
  VacacionesPeriodoTipo,
} from '@/lib/types/models'

/**
 * Lectura/escritura directa contra Supabase, protegida por RLS. No hay
 * ningún endpoint para Vacaciones: a diferencia de Stock, no existe ningún
 * contador acumulativo ni riesgo de concurrencia, así que todo el CRUD va
 * por aquí, igual que lib/supabase/queries/tasks.ts.
 */

async function withJWTRetry<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  operationName: string
): Promise<T> {
  const { data, error } = await operation()
  if (error) {
    if (isJWTClockSkewError(error.message)) {
      try {
        await handleJWTError()
        const { data: retryData, error: retryError } = await operation()
        if (retryError) throw retryError
        return retryData as T
      } catch {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.')
      }
    }
    console.error(`[${operationName}] Error:`, error.message)
    throw error
  }
  return (data as T) || (null as unknown as T)
}

export async function getVacacionesTrabajadores(): Promise<VacacionesTrabajador[]> {
  const supabase = createClient()
  return withJWTRetry(
    () =>
      supabase
        .from('vacaciones_trabajadores')
        .select('*')
        .is('archived_at', null)
        .order('orden', { ascending: true }) as any,
    'getVacacionesTrabajadores'
  )
}

export async function getVacacionesFestivos(): Promise<VacacionesFestivo[]> {
  const supabase = createClient()
  return withJWTRetry(
    () => supabase.from('vacaciones_festivos').select('*').order('fecha', { ascending: true }) as any,
    'getVacacionesFestivos'
  )
}

export async function getVacacionesPeriodos(): Promise<VacacionesPeriodo[]> {
  const supabase = createClient()
  return withJWTRetry(
    () => supabase.from('vacaciones_periodos').select('*').order('fecha_inicio', { ascending: true }) as any,
    'getVacacionesPeriodos'
  )
}

export async function crearVacacionesPeriodo(input: {
  trabajador_id: string
  fecha_inicio: string
  fecha_fin: string
  tipo: VacacionesPeriodoTipo
  centro_id: string
  actorId: string
}): Promise<VacacionesPeriodo> {
  const { actorId, ...campos } = input
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('vacaciones_periodos')
    .insert({ ...campos, created_by: actorId, updated_by: actorId })
    .select()
    .single()
  if (error) {
    console.error('[crearVacacionesPeriodo] Error:', error.message)
    throw error
  }
  return data as VacacionesPeriodo
}

export async function actualizarVacacionesPeriodo(
  id: string,
  input: Partial<{
    trabajador_id: string
    fecha_inicio: string
    fecha_fin: string
    tipo: VacacionesPeriodoTipo
  }>,
  actorId: string
): Promise<VacacionesPeriodo> {
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('vacaciones_periodos')
    .update({ ...input, updated_by: actorId })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('[actualizarVacacionesPeriodo] Error:', error.message)
    throw error
  }
  return data as VacacionesPeriodo
}

export async function eliminarVacacionesPeriodo(id: string): Promise<void> {
  const supabase = createClient() as any
  const { error } = await supabase.from('vacaciones_periodos').delete().eq('id', id)
  if (error) {
    console.error('[eliminarVacacionesPeriodo] Error:', error.message)
    throw error
  }
}

export async function crearVacacionesFestivo(input: {
  fecha: string
  nombre: string
  tipo: VacacionesFestivo['tipo']
  centro_id: string
  actorId: string
}): Promise<VacacionesFestivo> {
  const { actorId, ...campos } = input
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('vacaciones_festivos')
    .insert({ ...campos, created_by: actorId, updated_by: actorId })
    .select()
    .single()
  if (error) {
    console.error('[crearVacacionesFestivo] Error:', error.message)
    throw error
  }
  return data as VacacionesFestivo
}

export async function eliminarVacacionesFestivo(id: string): Promise<void> {
  const supabase = createClient() as any
  const { error } = await supabase.from('vacaciones_festivos').delete().eq('id', id)
  if (error) {
    console.error('[eliminarVacacionesFestivo] Error:', error.message)
    throw error
  }
}

export async function actualizarDiasAnuales(
  trabajadorId: string,
  diasAnuales: number,
  actorId: string
): Promise<void> {
  const supabase = createClient() as any
  const { error } = await supabase
    .from('vacaciones_trabajadores')
    .update({ dias_anuales: diasAnuales, updated_by: actorId })
    .eq('id', trabajadorId)
  if (error) {
    console.error('[actualizarDiasAnuales] Error:', error.message)
    throw error
  }
}

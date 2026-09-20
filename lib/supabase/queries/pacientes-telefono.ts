import { createClient } from '@/lib/supabase/browser'

/**
 * Lectura directa contra Supabase, protegida por RLS (área Seguimiento).
 * La escritura (importación masiva) va por /api/pacientes-telefono/importar
 * con service_role, igual que Seguimiento.
 */

const TAMANO_LOTE_IN = 200

export async function getTelefonosPorClaves(claves: string[]): Promise<Map<string, string>> {
  const supabase = createClient() as any
  const resultado = new Map<string, string>()
  if (claves.length === 0) return resultado

  for (let inicio = 0; inicio < claves.length; inicio += TAMANO_LOTE_IN) {
    const lote = claves.slice(inicio, inicio + TAMANO_LOTE_IN)
    const { data, error } = await supabase.from('pacientes_telefono').select('paciente_clave, telefono').in('paciente_clave', lote)
    if (error) throw error
    for (const fila of data ?? []) {
      if (fila.telefono) resultado.set(fila.paciente_clave, fila.telefono)
    }
  }

  return resultado
}

// Los teléfonos están restringidos a administración (RLS), pero la edad la
// sigue viendo cualquiera con acceso a Seguimiento: por eso va por una RPC
// aparte (get_edades_pacientes) que no toca teléfono ni nombre_mostrar.
export async function getEdadesPorClaves(claves: string[]): Promise<Map<string, number>> {
  const supabase = createClient() as any
  const resultado = new Map<string, number>()
  if (claves.length === 0) return resultado

  for (let inicio = 0; inicio < claves.length; inicio += TAMANO_LOTE_IN) {
    const lote = claves.slice(inicio, inicio + TAMANO_LOTE_IN)
    const { data, error } = await supabase.rpc('get_edades_pacientes', { p_claves: lote })
    if (error) throw error
    for (const fila of data ?? []) {
      if (fila.edad !== null && fila.edad !== undefined) resultado.set(fila.paciente_clave, fila.edad)
    }
  }

  return resultado
}

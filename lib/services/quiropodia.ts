/**
 * Aviso de recontacto de Quiropodia — versión deliberadamente simple: no
 * calcula una media personal por paciente (se descartó por invasivo/difícil
 * de mantener a mano), solo mira cuánto hace de su última visita de
 * Quiropodia y avisa a partir de un umbral fijo (recordatorio anual).
 */

import type { SeguimientoCita } from '@/lib/types/models'
import { mesesEntre, aFecha } from '@/lib/services/seguimiento'

export const UMBRAL_MESES_QUIROPODIA = 12

export function esTratamientoQuiropodia(tratamiento: string): boolean {
  return tratamiento.toUpperCase().includes('QUIROPODIA')
}

export interface PacienteQuiropodia {
  paciente_clave: string
  nombre_mostrar: string
  ultima_visita: string
  meses_desde_ultima: number
  num_visitas: number
}

export function calcularQuiropodia(citas: SeguimientoCita[], hoy: Date = new Date()): PacienteQuiropodia[] {
  const porPaciente = new Map<string, { nombre_mostrar: string; ultima_visita: string; num_visitas: number }>()

  for (const c of citas) {
    if (!esTratamientoQuiropodia(c.tratamiento)) continue
    const actual = porPaciente.get(c.paciente_clave)
    if (!actual) {
      porPaciente.set(c.paciente_clave, { nombre_mostrar: c.paciente_raw, ultima_visita: c.fecha, num_visitas: 1 })
      continue
    }
    actual.num_visitas += 1
    // Se queda con el nombre tal y como venía en la visita más reciente
    // (por si cambió de formato entre exports).
    if (c.fecha >= actual.ultima_visita) {
      actual.ultima_visita = c.fecha
      actual.nombre_mostrar = c.paciente_raw
    }
  }

  const resultado: PacienteQuiropodia[] = Array.from(porPaciente.entries()).map(([paciente_clave, datos]) => ({
    paciente_clave,
    nombre_mostrar: datos.nombre_mostrar,
    ultima_visita: datos.ultima_visita,
    meses_desde_ultima: mesesEntre(aFecha(datos.ultima_visita), hoy),
    num_visitas: datos.num_visitas,
  }))

  return resultado.sort((a, b) => b.meses_desde_ultima - a.meses_desde_ultima)
}

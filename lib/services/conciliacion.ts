/**
 * Motor de conciliación factura ↔ movimiento bancario.
 *
 * 100% determinista: la confianza de cada candidato es la suma de puntos de
 * factores medibles (importe, fecha, proveedor en concepto), nunca una
 * llamada a un modelo. Los factores se guardan como texto en
 * `notas_revision` para que se puedan explicar sin recalcular nada — ni
 * ClinicOS ni un cliente futuro necesitan reconstruir el razonamiento.
 *
 * v1: relación 1 a 1, sin incidencias, sin aceptación automática. Cada
 * ejecución solo crea propuestas (`estado = 'PROPUESTA'`); aceptarlas o
 * rechazarlas es una acción humana posterior.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { normalizarConcepto } from '@/lib/services/banco-importacion'

// created_by/updated_by de conciliaciones tienen FK a usuarios_sistema
// (actor técnico), igual que el resto de tablas de Facturas.
const ACTOR_SISTEMA = '00000000-0000-0000-0000-000000000000'

// ── Parámetros de puntuación ────────────────────────────────────────────
// Punto de partida, sin calibrar todavía contra el histórico real.
export const PARAMS = {
  VENTANA_DIAS: 90,
  TRAMOS_FECHA: [
    { maxDias: 30, puntos: 20 },
    { maxDias: 60, puntos: 10 },
    { maxDias: 90, puntos: 5 },
  ],
  PUNTOS_IMPORTE_EXACTO: 60,
  PUNTOS_IMPORTE_TOLERADO: 30,
  PUNTOS_PROVEEDOR_EN_CONCEPTO: 20,
  PUNTOS_CIF_EN_CONCEPTO: 25,
  TOLERANCIA_IMPORTE_AMBAR_CENTIMOS: 100, // 1 €
  TOLERANCIA_IMPORTE_AMBAR_PORCENTAJE: 0.01, // 1%
  UMBRAL_VERDE: 80,
} as const

interface Factor {
  descripcion: string
  puntos: number
}

interface Candidato {
  movimientoId: string
  confianza: number
  factores: Factor[]
  diferencia: number
  importeMovimiento: number
}

interface FacturaPendiente {
  id: string
  fecha_emision: string
  importe_total: number
  centro_id: string
  proveedores: { nombre: string; cif_nif: string | null } | null
}

interface MovimientoPendiente {
  id: string
  fecha: string
  concepto: string
  importe: number
}

export interface ResumenMatching {
  facturas_evaluadas: number
  propuestas_creadas: number
  sin_candidato: number
  movimientos_evaluados: number
}

function aCentimos(valor: number): number {
  return Math.round(valor * 100)
}

function diasEntre(fechaInicio: string, fechaFin: string): number {
  const ini = new Date(`${fechaInicio}T00:00:00Z`).getTime()
  const fin = new Date(`${fechaFin}T00:00:00Z`).getTime()
  return Math.round((fin - ini) / 86_400_000)
}

function conceptoContieneProveedor(conceptoNorm: string, nombreProveedor: string): boolean {
  const nombreNorm = normalizarConcepto(nombreProveedor)
  if (conceptoNorm.includes(nombreNorm)) return true
  const primeraPalabra = nombreNorm.split(' ')[0]
  return primeraPalabra.length >= 4 && conceptoNorm.includes(primeraPalabra)
}

function evaluarCandidato(factura: FacturaPendiente, movimiento: MovimientoPendiente): Candidato | null {
  const dias = diasEntre(factura.fecha_emision, movimiento.fecha)
  if (dias < 0 || dias > PARAMS.VENTANA_DIAS) return null

  const diferenciaCentimos = Math.abs(aCentimos(factura.importe_total) - aCentimos(movimiento.importe))
  const toleranciaCentimos = Math.max(
    PARAMS.TOLERANCIA_IMPORTE_AMBAR_CENTIMOS,
    Math.round(aCentimos(factura.importe_total) * PARAMS.TOLERANCIA_IMPORTE_AMBAR_PORCENTAJE)
  )
  if (diferenciaCentimos > toleranciaCentimos) return null

  const factores: Factor[] = []
  let confianza = 0

  if (diferenciaCentimos === 0) {
    factores.push({ descripcion: 'importe exacto', puntos: PARAMS.PUNTOS_IMPORTE_EXACTO })
    confianza += PARAMS.PUNTOS_IMPORTE_EXACTO
  } else {
    factores.push({
      descripcion: `importe con diferencia de ${(diferenciaCentimos / 100).toFixed(2)} €`,
      puntos: PARAMS.PUNTOS_IMPORTE_TOLERADO,
    })
    confianza += PARAMS.PUNTOS_IMPORTE_TOLERADO
  }

  const tramo = PARAMS.TRAMOS_FECHA.find((t) => dias <= t.maxDias)
  if (tramo) {
    factores.push({ descripcion: `pagado ${dias} día(s) después de la emisión`, puntos: tramo.puntos })
    confianza += tramo.puntos
  }

  const conceptoNorm = normalizarConcepto(movimiento.concepto)
  const proveedor = factura.proveedores

  if (proveedor?.nombre && conceptoContieneProveedor(conceptoNorm, proveedor.nombre)) {
    factores.push({
      descripcion: `"${proveedor.nombre}" aparece en el concepto`,
      puntos: PARAMS.PUNTOS_PROVEEDOR_EN_CONCEPTO,
    })
    confianza += PARAMS.PUNTOS_PROVEEDOR_EN_CONCEPTO
  }

  if (proveedor?.cif_nif && conceptoNorm.includes(normalizarConcepto(proveedor.cif_nif))) {
    factores.push({ descripcion: 'el CIF del proveedor aparece en el concepto', puntos: PARAMS.PUNTOS_CIF_EN_CONCEPTO })
    confianza += PARAMS.PUNTOS_CIF_EN_CONCEPTO
  }

  return {
    movimientoId: movimiento.id,
    confianza,
    factores,
    diferencia: diferenciaCentimos / 100,
    importeMovimiento: movimiento.importe,
  }
}

function construirNota(candidato: Candidato, totalCandidatos: number): string {
  const partes = candidato.factores.map((f) => `${f.descripcion} (+${f.puntos})`)
  if (totalCandidatos > 1) {
    partes.push(`hay ${totalCandidatos} movimientos candidatos, revisar antes de aceptar`)
  }
  return `Automático — confianza ${candidato.confianza}: ${partes.join('; ')}.`
}

/**
 * Procesa en un único lote todas las facturas leídas y sin conciliar del
 * centro, contra los movimientos bancarios pendientes de justificar.
 * Incremental: una factura ya propuesta (PENDIENTE_REVISION) no se vuelve a
 * evaluar en la siguiente ejecución.
 */
export async function ejecutarMatching(centroId: string): Promise<ResumenMatching> {
  const supabase = createAdminClient() as any

  const { data: facturas, error: errFacturas } = await supabase
    .from('facturas')
    .select('id, fecha_emision, importe_total, centro_id, proveedores(nombre, cif_nif)')
    .eq('centro_id', centroId)
    .eq('estado_lectura', 'VALIDACION_EXITOSA')
    .eq('estado_conciliacion', 'NO_CONCILIADA')
    .eq('activo', true)
    .not('importe_total', 'is', null)
    .not('fecha_emision', 'is', null)

  if (errFacturas) throw errFacturas

  const { data: movimientos, error: errMovimientos } = await supabase
    .from('movimientos_bancarios')
    .select('id, fecha, concepto, importe')
    .eq('centro_id', centroId)
    .eq('estado', 'PENDIENTE_JUSTIFICAR')
    .eq('sentido', 'CARGO')
    .eq('activo', true)

  if (errMovimientos) throw errMovimientos

  const facturasPendientes: FacturaPendiente[] = facturas ?? []
  const movimientosPendientes: MovimientoPendiente[] = movimientos ?? []

  // Un par ya rechazado por una persona no se vuelve a proponer.
  const { data: rechazadas, error: errRechazadas } = await supabase
    .from('conciliaciones')
    .select('factura_id, movimiento_bancario_id')
    .eq('centro_id', centroId)
    .eq('estado', 'RECHAZADA')

  if (errRechazadas) throw errRechazadas

  const paresRechazados = new Set(
    (rechazadas ?? []).map((r: any) => `${r.factura_id}|${r.movimiento_bancario_id}`)
  )

  let propuestasCreadas = 0
  let sinCandidato = 0

  for (const factura of facturasPendientes) {
    const candidatos = movimientosPendientes
      .filter((m) => !paresRechazados.has(`${factura.id}|${m.id}`))
      .map((m) => evaluarCandidato(factura, m))
      .filter((c): c is Candidato => c !== null)
      .sort((a, b) => b.confianza - a.confianza)

    if (candidatos.length === 0) {
      sinCandidato++
      continue
    }

    const mejor = candidatos[0]

    const { error: errInsert } = await supabase.from('conciliaciones').insert({
      factura_id: factura.id,
      movimiento_bancario_id: mejor.movimientoId,
      tipo_relacion: '1_A_1',
      importe_factura: factura.importe_total,
      importe_movimiento: mejor.importeMovimiento,
      diferencia: mejor.diferencia,
      metodo: 'AUTOMATICA',
      confianza: mejor.confianza,
      estado: 'PROPUESTA',
      notas_revision: construirNota(mejor, candidatos.length),
      centro_id: centroId,
      created_by: ACTOR_SISTEMA,
      updated_by: ACTOR_SISTEMA,
    })
    if (errInsert) throw errInsert

    const { error: errUpdate } = await supabase
      .from('facturas')
      .update({ estado_conciliacion: 'PENDIENTE_REVISION', updated_by: ACTOR_SISTEMA })
      .eq('id', factura.id)
    if (errUpdate) throw errUpdate

    propuestasCreadas++
  }

  return {
    facturas_evaluadas: facturasPendientes.length,
    propuestas_creadas: propuestasCreadas,
    sin_candidato: sinCandidato,
    movimientos_evaluados: movimientosPendientes.length,
  }
}

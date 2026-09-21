/**
 * Simulación de financiación a plazos (pago con datáfono). Cifras
 * ORIENTATIVAS mientras se confirman las condiciones reales del banco —
 * el usuario estimó ~12€ de coste total en 12 meses sobre un importe tipo
 * de 350€ (~3,5%), y que el coste crece con el número de meses. Ajustar
 * PORCENTAJE_COSTE_12_MESES en cuanto se tengan los datos reales del
 * datáfono; no usar estas cifras para nada oficial hasta confirmarlas.
 */

const IMPORTE_MINIMO_FINANCIABLE = 250
const PLAZOS_MESES = [3, 6, 9, 12]
const PORCENTAJE_COSTE_12_MESES = 0.035

export interface OpcionFinanciacion {
  meses: number
  cuota: number
  coste: number
  total: number
}

export function calcularFinanciacion(importe: number): OpcionFinanciacion[] {
  if (importe < IMPORTE_MINIMO_FINANCIABLE) return []

  return PLAZOS_MESES.map((meses) => {
    const coste = Math.round(importe * PORCENTAJE_COSTE_12_MESES * (meses / 12) * 100) / 100
    const total = importe + coste
    const cuota = Math.round((total / meses) * 100) / 100
    return { meses, cuota, coste, total }
  })
}

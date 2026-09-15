/**
 * Importación de extractos bancarios (XLSX de Banco Sabadell).
 *
 * Desacoplado de Next.js, Supabase y base de datos: recibe un Buffer y
 * devuelve movimientos normalizados listos para insertar.
 *
 * Convenciones fijadas:
 * - `importe` se devuelve en valor absoluto; el signo vive en `sentido`.
 * - `concepto` se conserva literal; la normalización solo alimenta la huella.
 * - Las comparaciones de importe se hacen en céntimos enteros.
 */

import { createHash } from 'node:crypto'
import readXlsxFile from 'read-excel-file/node'

export type Sentido = 'CARGO' | 'ABONO'

export interface MovimientoNormalizado {
  fecha: string
  concepto: string
  importe: number
  sentido: Sentido
  huella: string
}

export interface ErrorFila {
  fila: number
  motivo: string
}

export interface ResultadoParseo {
  movimientos: MovimientoNormalizado[]
  errores: ErrorFila[]
  totalFilas: number
  periodo: { desde: string; hasta: string } | null
}

/** Fallo estructural del archivo: aborta la importación sin insertar nada. */
export class ErrorArchivo extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErrorArchivo'
  }
}

const COLUMNAS = {
  fecha: 'F. OPERATIVA',
  concepto: 'CONCEPTO',
  fechaValor: 'F. VALOR',
  importe: 'IMPORTE',
} as const

const MAX_FILAS_BUSQUEDA_CABECERA = 50

/**
 * CONTRATO CONGELADO: cambiar esta función invalida todas las huellas ya
 * almacenadas y provocaría la reimportación duplicada del histórico completo.
 * Cualquier modificación exige recalcular las huellas existentes.
 */
export function normalizarConcepto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function calcularHuella(
  centroId: string,
  fechaISO: string,
  centimos: number,
  conceptoNormalizado: string,
  ordinal: number
): string {
  return createHash('sha256')
    .update(`${centroId}|${fechaISO}|${centimos}|${conceptoNormalizado}|${ordinal}`)
    .digest('hex')
}

function aCentimos(valor: number): number {
  return Math.round(valor * 100)
}

function textoCelda(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  if (valor instanceof Date) return valor.toISOString()
  const texto = String(valor)
  return texto.length > 0 ? texto : null
}

function parsearFecha(valor: unknown): string | null {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null
    const y = valor.getFullYear()
    const m = String(valor.getMonth() + 1).padStart(2, '0')
    const d = String(valor.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const texto = textoCelda(valor)
  if (!texto) return null

  const coincidencia = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!coincidencia) return null

  const dia = Number(coincidencia[1])
  const mes = Number(coincidencia[2])
  const anio = Number(coincidencia[3])

  if (mes < 1 || mes > 12) return null
  if (anio < 2000 || anio > 2100) return null

  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  if (fecha.getUTCDate() !== dia || fecha.getUTCMonth() !== mes - 1) return null

  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function parsearImporte(valor: unknown): number | null {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : null
  }
  const texto = textoCelda(valor)
  if (!texto) return null

  const numero = Number(texto.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(numero) ? numero : null
}

/** Las celdas llegan sin tipo garantizado; cada valor se valida en runtime. */
type Fila = unknown[]

interface Cabecera {
  indiceFila: number
  columnas: { fecha: number; concepto: number; importe: number }
}

function localizarCabecera(filas: Fila[]): Cabecera {
  const limite = Math.min(filas.length, MAX_FILAS_BUSQUEDA_CABECERA)

  for (let i = 0; i < limite; i++) {
    const etiquetas = filas[i].map((celda) => {
      const texto = textoCelda(celda)
      return texto ? normalizarConcepto(texto) : ''
    })

    const fecha = etiquetas.indexOf(COLUMNAS.fecha)
    const concepto = etiquetas.indexOf(COLUMNAS.concepto)
    const importe = etiquetas.indexOf(COLUMNAS.importe)
    const fechaValor = etiquetas.indexOf(COLUMNAS.fechaValor)

    if (fecha !== -1 && concepto !== -1 && importe !== -1 && fechaValor !== -1) {
      return { indiceFila: i, columnas: { fecha, concepto, importe } }
    }
  }

  throw new ErrorArchivo(
    'No parece un extracto de Banco Sabadell: no se encuentra la fila de cabecera con las columnas "F. Operativa", "Concepto", "F. Valor" e "Importe".'
  )
}

function filaVacia(fila: Fila): boolean {
  return fila.every((celda) => textoCelda(celda) === null)
}

export async function parsearExtractoBancario(
  contenido: Buffer,
  centroId: string
): Promise<ResultadoParseo> {
  let hojas: { sheet: string; data: Fila[] }[]
  try {
    hojas = await readXlsxFile(contenido)
  } catch {
    throw new ErrorArchivo('El archivo no es un XLSX válido o está dañado.')
  }

  if (hojas.length === 0 || hojas[0].data.length === 0) {
    throw new ErrorArchivo('El archivo no contiene ninguna hoja con datos.')
  }

  const filas = hojas[0].data

  const cabecera = localizarCabecera(filas)
  const filasDatos = filas
    .slice(cabecera.indiceFila + 1)
    .map((fila, indice) => ({ fila, numeroFila: cabecera.indiceFila + indice + 2 }))
    .filter(({ fila }) => !filaVacia(fila))

  if (filasDatos.length === 0) {
    throw new ErrorArchivo('El archivo no contiene filas de movimientos.')
  }

  const errores: ErrorFila[] = []
  const preparados: {
    fecha: string
    concepto: string
    centimos: number
    conceptoNormalizado: string
  }[] = []

  for (const { fila, numeroFila } of filasDatos) {
    const fecha = parsearFecha(fila[cabecera.columnas.fecha])
    if (!fecha) {
      errores.push({ fila: numeroFila, motivo: 'Fecha ilegible o con formato inesperado' })
      continue
    }

    const concepto = textoCelda(fila[cabecera.columnas.concepto])
    if (!concepto || concepto.trim().length === 0) {
      errores.push({ fila: numeroFila, motivo: 'Concepto vacío' })
      continue
    }

    const importe = parsearImporte(fila[cabecera.columnas.importe])
    if (importe === null) {
      errores.push({ fila: numeroFila, motivo: 'Importe no numérico' })
      continue
    }

    const centimos = aCentimos(importe)
    if (centimos === 0) {
      errores.push({
        fila: numeroFila,
        motivo: 'Importe cero: no permite determinar si es cargo o abono',
      })
      continue
    }

    preparados.push({
      fecha,
      concepto,
      centimos,
      conceptoNormalizado: normalizarConcepto(concepto),
    })
  }

  const ocurrencias = new Map<string, number>()
  const movimientos: MovimientoNormalizado[] = []

  for (const item of preparados) {
    const grupo = `${item.fecha}|${item.centimos}|${item.conceptoNormalizado}`
    const ordinal = (ocurrencias.get(grupo) ?? 0) + 1
    ocurrencias.set(grupo, ordinal)

    movimientos.push({
      fecha: item.fecha,
      concepto: item.concepto,
      importe: Math.abs(item.centimos) / 100,
      sentido: item.centimos < 0 ? 'CARGO' : 'ABONO',
      huella: calcularHuella(
        centroId,
        item.fecha,
        item.centimos,
        item.conceptoNormalizado,
        ordinal
      ),
    })
  }

  const fechas = movimientos.map((m) => m.fecha).sort()
  const periodo = fechas.length > 0 ? { desde: fechas[0], hasta: fechas[fechas.length - 1] } : null

  return {
    movimientos,
    errores,
    totalFilas: filasDatos.length,
    periodo,
  }
}

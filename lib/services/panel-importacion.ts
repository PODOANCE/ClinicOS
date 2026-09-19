/**
 * Importación del Excel mensual de facturación (Panel de Control).
 *
 * Antes esto se procesaba a mano: el usuario pegaba los datos del mes por
 * chat y se tecleaban los totales uno a uno en la herramienta. El Excel es
 * un registro de transacciones línea a línea (fecha, profesional,
 * paciente, servicio, importe, forma de pago, factura) — no viene
 * pre-agregado, así que aquí se calculan los totales que necesita Panel de
 * Control: facturación del mes (con desglose por forma de pago), nº de
 * servicios realizados por tipo, nº de servicios por profesional, y la
 * facturación de comisiones por profesional (con/sin plantillas).
 *
 * Desacoplado de Next.js/Supabase: recibe un Buffer y devuelve los
 * agregados listos para guardar. El archivo trae la cabecera repetida cada
 * ~30 filas (una por página al imprimir) y 4 filas de "TOTAL MES..." al
 * final — ambas cosas se detectan y se saltan solas.
 */

import readXlsxFile from 'read-excel-file/node'

export interface ErrorFilaPanel {
  fila: number
  motivo: string
}

export interface ResumenServicio {
  servicio: string
  cantidad: number
}

export interface ResumenServicioProfesional {
  servicio: string
  profesional: string
  cantidad: number
}

export interface ResumenComisionProfesional {
  profesional: string
  fact_con_plantillas: number
  fact_sin_plantillas: number
  total_plantillas: number
}

export interface FormaPagoNoReconocida {
  forma: string
  importe: number
}

export interface ResultadoParseoPanel {
  anio: number
  mes: number
  facturacionTotal: number
  facturacionEfectivo: number
  facturacionTarjeta: number
  facturacionTransferencia: number
  formasPagoNoReconocidas: FormaPagoNoReconocida[]
  serviciosRealizados: ResumenServicio[]
  serviciosPorProfesional: ResumenServicioProfesional[]
  comisionesPorProfesional: ResumenComisionProfesional[]
  filasProcesadas: number
  errores: ErrorFilaPanel[]
}

export class ErrorArchivoPanel extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErrorArchivoPanel'
  }
}

const COLUMNAS = {
  fecha: 'FECHA',
  profesional: 'PROFESIONAL',
  paciente: 'PACIENTE',
  servicio: 'SERVICIO',
  importe: 'IMPORTE',
  pago: 'FORMA DE PAGO',
} as const

const MAX_FILAS_BUSQUEDA_CABECERA = 10
const FORMAS_PAGO_CONOCIDAS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const

type Fila = unknown[]

function textoCelda(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  const texto = String(valor).trim()
  return texto.length > 0 ? texto : null
}

function normalizarEtiqueta(valor: unknown): string {
  const texto = textoCelda(valor)
  return texto ? texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase() : ''
}

function extraerAnioMes(valor: unknown): { anio: number; mes: number } | null {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null
    return { anio: valor.getFullYear(), mes: valor.getMonth() + 1 }
  }
  const texto = textoCelda(valor)
  if (!texto) return null
  const conGuiones = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (conGuiones) return { anio: Number(conGuiones[1]), mes: Number(conGuiones[2]) }
  const conBarras = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (conBarras) return { anio: Number(conBarras[3]), mes: Number(conBarras[2]) }
  return null
}

function parsearImporte(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  const texto = textoCelda(valor)
  if (!texto) return null
  const numero = Number(texto.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(numero) ? numero : null
}

interface Cabecera {
  fecha: number
  profesional: number
  paciente: number
  servicio: number
  importe: number
  pago: number
}

function detectarCabecera(fila: Fila): Cabecera | null {
  const etiquetas = fila.map(normalizarEtiqueta)
  const fecha = etiquetas.indexOf(COLUMNAS.fecha)
  const profesional = etiquetas.indexOf(COLUMNAS.profesional)
  const servicio = etiquetas.indexOf(COLUMNAS.servicio)
  const importe = etiquetas.indexOf(COLUMNAS.importe)
  if (fecha === -1 || profesional === -1 || servicio === -1 || importe === -1) return null
  return {
    fecha,
    profesional,
    paciente: etiquetas.indexOf(COLUMNAS.paciente),
    servicio,
    importe,
    pago: etiquetas.indexOf(COLUMNAS.pago),
  }
}

function celda(fila: Fila, indice: number): unknown {
  return indice >= 0 ? fila[indice] : undefined
}

// "SEÑAL PLANTILLAS ADULTO/NIÑ@", "PLANTILLAS ADULTO/NIÑ@", "MODIFICACIÓN
// PLANTILLAS": todo lo que lleva "plantilla" en el nombre del servicio
// cuenta para la comisión de plantillas (pl_*), el resto va a la comisión
// de tratamientos (sp_*). Igual que en Seguimiento.
function esPlantillas(servicio: string): boolean {
  return /plantilla/i.test(servicio)
}

async function buscarHojaTransacciones(
  hojas: { sheet: string; data: Fila[] }[]
): Promise<{ filas: Fila[]; cabecera: Cabecera; indiceCabecera: number } | null> {
  for (const hoja of hojas) {
    for (let i = 0; i < Math.min(hoja.data.length, MAX_FILAS_BUSQUEDA_CABECERA); i++) {
      const cabecera = detectarCabecera(hoja.data[i])
      if (cabecera) return { filas: hoja.data, cabecera, indiceCabecera: i }
    }
  }
  return null
}

export async function parsearExcelPanelMensual(contenido: Buffer): Promise<ResultadoParseoPanel> {
  let hojas: { sheet: string; data: Fila[] }[]
  try {
    hojas = await readXlsxFile(contenido)
  } catch {
    throw new ErrorArchivoPanel('El archivo no es un XLSX válido o está dañado.')
  }

  const encontrada = await buscarHojaTransacciones(hojas)
  if (!encontrada) {
    throw new ErrorArchivoPanel(
      'No se encuentra la hoja de transacciones esperada (columnas Fecha, Profesional, Servicio, Importe...). ¿Es el Excel mensual de facturación?'
    )
  }
  const { filas, cabecera, indiceCabecera } = encontrada

  const errores: ErrorFilaPanel[] = []
  const mesesVistos = new Set<string>()
  let anio = 0
  let mes = 0
  let facturacionTotal = 0
  const porFormaPago = new Map<string, number>()
  const serviciosMap = new Map<string, number>()
  const servicioProfesionalMap = new Map<string, { servicio: string; profesional: string; cantidad: number }>()
  const profesionalTotales = new Map<string, { total: number; plantillas: number }>()
  let filasProcesadas = 0

  for (let indice = indiceCabecera + 1; indice < filas.length; indice++) {
    const fila = filas[indice]
    const numeroFila = indice + 1
    if (fila.every((c) => textoCelda(c) === null)) continue // fila vacía
    if (detectarCabecera(fila)) continue // cabecera repetida (una por página)

    const paciente = textoCelda(celda(fila, cabecera.paciente))
    const servicio = textoCelda(celda(fila, cabecera.servicio))
    const esFilaTotal = [paciente, servicio].some((v) => v?.toUpperCase().startsWith('TOTAL'))
    if (esFilaTotal) continue // fila de resumen al final de la hoja, no es una transacción

    const fecha = extraerAnioMes(celda(fila, cabecera.fecha))
    const profesional = textoCelda(celda(fila, cabecera.profesional))
    const importe = parsearImporte(celda(fila, cabecera.importe))

    if (!fecha) {
      errores.push({ fila: numeroFila, motivo: 'Fecha ilegible o con formato inesperado' })
      continue
    }
    if (!servicio) {
      errores.push({ fila: numeroFila, motivo: 'Servicio vacío' })
      continue
    }
    if (!profesional) {
      errores.push({ fila: numeroFila, motivo: 'Profesional vacío' })
      continue
    }
    if (importe === null) {
      errores.push({ fila: numeroFila, motivo: 'Importe ilegible' })
      continue
    }

    mesesVistos.add(`${fecha.anio}-${fecha.mes}`)
    anio = fecha.anio
    mes = fecha.mes

    facturacionTotal += importe
    filasProcesadas++

    const pago = textoCelda(celda(fila, cabecera.pago))
    if (pago) {
      const pagoNormalizado = pago.toUpperCase()
      porFormaPago.set(pagoNormalizado, (porFormaPago.get(pagoNormalizado) ?? 0) + importe)
    }

    const servicioClave = servicio.toUpperCase()
    serviciosMap.set(servicioClave, (serviciosMap.get(servicioClave) ?? 0) + 1)

    const profesionalClave = profesional.toUpperCase()
    const claveServProf = `${servicioClave}||${profesionalClave}`
    const actualServProf = servicioProfesionalMap.get(claveServProf)
    servicioProfesionalMap.set(claveServProf, {
      servicio: servicioClave,
      profesional: profesionalClave,
      cantidad: (actualServProf?.cantidad ?? 0) + 1,
    })

    const actualProf = profesionalTotales.get(profesionalClave) ?? { total: 0, plantillas: 0 }
    actualProf.total += importe
    if (esPlantillas(servicio)) actualProf.plantillas += importe
    profesionalTotales.set(profesionalClave, actualProf)
  }

  if (filasProcesadas === 0) {
    throw new ErrorArchivoPanel('No se encontró ninguna fila de transacción válida en el archivo.')
  }
  if (mesesVistos.size > 1) {
    throw new ErrorArchivoPanel(
      `El archivo mezcla varios meses (${[...mesesVistos].join(', ')}). Sube un Excel por mes, como hasta ahora.`
    )
  }

  const formasPagoNoReconocidas: FormaPagoNoReconocida[] = []
  for (const [forma, importe] of porFormaPago) {
    if (!FORMAS_PAGO_CONOCIDAS.includes(forma as (typeof FORMAS_PAGO_CONOCIDAS)[number])) {
      formasPagoNoReconocidas.push({ forma, importe })
    }
  }

  return {
    anio,
    mes,
    facturacionTotal,
    facturacionEfectivo: porFormaPago.get('EFECTIVO') ?? 0,
    facturacionTarjeta: porFormaPago.get('TARJETA') ?? 0,
    facturacionTransferencia: porFormaPago.get('TRANSFERENCIA') ?? 0,
    formasPagoNoReconocidas,
    serviciosRealizados: [...serviciosMap.entries()].map(([servicio, cantidad]) => ({ servicio, cantidad })),
    serviciosPorProfesional: [...servicioProfesionalMap.values()],
    comisionesPorProfesional: [...profesionalTotales.entries()].map(([profesional, v]) => ({
      profesional,
      fact_con_plantillas: v.total,
      fact_sin_plantillas: v.total - v.plantillas,
      total_plantillas: v.plantillas,
    })),
    filasProcesadas,
    errores,
  }
}

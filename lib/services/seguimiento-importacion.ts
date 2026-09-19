/**
 * Importación de citas de biomecánica desde exports de Organízate
 * (Estadísticas > Citas - General, exportado a Excel).
 *
 * Desacoplado de Next.js/Supabase: recibe un Buffer y devuelve citas
 * normalizadas listas para insertar. Igual que en la plantilla Excel
 * original, admite pegar/subir varios exports seguidos en un mismo
 * archivo: cualquier fila que repita la cabecera se ignora sola, así que
 * no hace falta recortar nada a mano.
 */

import { createHash } from 'node:crypto'
import readXlsxFile from 'read-excel-file/node'

export interface CitaNormalizada {
  fecha: string
  hora: string | null
  agenda: string | null
  sala: string | null
  paciente_raw: string
  paciente_clave: string
  tratamiento: string
  precio: number | null
  estado_cita: string | null
  huella: string
}

export interface ErrorFila {
  fila: number
  motivo: string
}

export interface ResultadoParseoCitas {
  citas: CitaNormalizada[]
  errores: ErrorFila[]
  totalFilas: number
  descartadasNoBiomecanica: number
}

export class ErrorArchivoSeguimiento extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErrorArchivoSeguimiento'
  }
}

const COLUMNAS = {
  fecha: 'FECHA',
  hora: 'HORA',
  agenda: 'AGENDA',
  sala: 'SALA',
  paciente: 'PACIENTE',
  tratamiento: 'TRATAMIENTO',
  precio: 'PRECIO',
  estado: 'ESTADO',
} as const

const MAX_FILAS_BUSQUEDA_CABECERA = 20

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
  const coincidencia = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!coincidencia) return null
  const [, dStr, mStr, aStr] = coincidencia
  const dia = Number(dStr)
  const mes = Number(mStr)
  const anio = Number(aStr)
  if (mes < 1 || mes > 12) return null
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  if (fecha.getUTCDate() !== dia || fecha.getUTCMonth() !== mes - 1) return null
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function parsearPrecio(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  const texto = textoCelda(valor)
  if (!texto) return null
  const numero = Number(texto.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(numero) ? numero : null
}

interface Cabecera {
  fecha: number
  hora: number
  agenda: number
  sala: number
  paciente: number
  tratamiento: number
  precio: number
  estado: number
}

function detectarCabecera(fila: Fila): Cabecera | null {
  const etiquetas = fila.map(normalizarEtiqueta)
  const fecha = etiquetas.indexOf(COLUMNAS.fecha)
  const paciente = etiquetas.indexOf(COLUMNAS.paciente)
  const tratamiento = etiquetas.indexOf(COLUMNAS.tratamiento)
  if (fecha === -1 || paciente === -1 || tratamiento === -1) return null
  return {
    fecha,
    hora: etiquetas.indexOf(COLUMNAS.hora),
    agenda: etiquetas.indexOf(COLUMNAS.agenda),
    sala: etiquetas.indexOf(COLUMNAS.sala),
    paciente,
    tratamiento,
    precio: etiquetas.indexOf(COLUMNAS.precio),
    estado: etiquetas.indexOf(COLUMNAS.estado),
  }
}

function celda(fila: Fila, indice: number): unknown {
  return indice >= 0 ? fila[indice] : undefined
}

// El export de Organízate ("Citas - General") trae la agenda de toda la
// clínica (papiloma, cirugía ungueal, cura, taller...), no solo
// biomecánica. Solo nos interesa lo que alimenta el seguimiento de
// revisiones: estudios/revisiones de biomecánica y todo lo relacionado con
// plantillas (señal, entrega, modificación).
function esTratamientoDeSeguimiento(tratamiento: string): boolean {
  const t = tratamiento.toUpperCase()
  return t.includes('BIOMEC') || t.includes('PLANTILLA') || t.includes('REVISI')
}

export function calcularHuellaCita(
  fecha: string,
  hora: string | null,
  agenda: string | null,
  pacienteClave: string,
  tratamiento: string
): string {
  return createHash('sha256')
    .update(`${fecha}|${hora ?? ''}|${agenda ?? ''}|${pacienteClave}|${tratamiento}`)
    .digest('hex')
}

export async function parsearExportOrganizate(contenido: Buffer): Promise<ResultadoParseoCitas> {
  let hojas: { sheet: string; data: Fila[] }[]
  try {
    hojas = await readXlsxFile(contenido)
  } catch {
    throw new ErrorArchivoSeguimiento('El archivo no es un XLSX válido o está dañado.')
  }

  if (hojas.length === 0 || hojas[0].data.length === 0) {
    throw new ErrorArchivoSeguimiento('El archivo no contiene ninguna hoja con datos.')
  }

  const filas = hojas[0].data

  // Busca la primera cabecera en las primeras filas; si se han pegado
  // varios exports seguidos, cada cabecera repetida se detecta y se salta
  // igual, fila a fila, más abajo.
  let cabecera: Cabecera | null = null
  for (let i = 0; i < Math.min(filas.length, MAX_FILAS_BUSQUEDA_CABECERA); i++) {
    cabecera = detectarCabecera(filas[i])
    if (cabecera) break
  }
  if (!cabecera) {
    throw new ErrorArchivoSeguimiento(
      'No se encuentra la fila de cabecera esperada (Fecha, Paciente, Tratamiento...). ¿Es un export de Organízate?'
    )
  }

  const errores: ErrorFila[] = []
  const citas: CitaNormalizada[] = []
  let descartadasNoBiomecanica = 0

  filas.forEach((fila, indice) => {
    const numeroFila = indice + 1
    if (fila.every((c) => textoCelda(c) === null)) return // fila vacía
    if (detectarCabecera(fila)) return // cabecera repetida de otro export pegado

    const fecha = parsearFecha(celda(fila, cabecera!.fecha))
    const paciente = textoCelda(celda(fila, cabecera!.paciente))
    const tratamiento = textoCelda(celda(fila, cabecera!.tratamiento))

    if (!fecha && !paciente && !tratamiento) return // fila de ruido, no es un dato de cita

    if (!fecha) {
      errores.push({ fila: numeroFila, motivo: 'Fecha ilegible o con formato inesperado' })
      return
    }
    if (!paciente) {
      errores.push({ fila: numeroFila, motivo: 'Paciente vacío' })
      return
    }
    if (!tratamiento) {
      errores.push({ fila: numeroFila, motivo: 'Tratamiento vacío' })
      return
    }
    if (!esTratamientoDeSeguimiento(tratamiento)) {
      descartadasNoBiomecanica += 1
      return
    }

    const pacienteClave = paciente.toUpperCase().replace(/\s+/g, ' ')
    const hora = textoCelda(celda(fila, cabecera!.hora))
    const agenda = textoCelda(celda(fila, cabecera!.agenda))

    citas.push({
      fecha,
      hora,
      agenda,
      sala: textoCelda(celda(fila, cabecera!.sala)),
      paciente_raw: paciente,
      paciente_clave: pacienteClave,
      tratamiento,
      precio: parsearPrecio(celda(fila, cabecera!.precio)),
      estado_cita: textoCelda(celda(fila, cabecera!.estado)),
      huella: calcularHuellaCita(fecha, hora, agenda, pacienteClave, tratamiento),
    })
  })

  return { citas, errores, totalFilas: citas.length + errores.length + descartadasNoBiomecanica, descartadasNoBiomecanica }
}

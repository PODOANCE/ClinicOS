/**
 * Generador de recordatorios de citas por WhatsApp.
 *
 * No envía nada por API (eso tiene coste y no compensa al volumen actual de
 * la clínica): a partir del mismo export de citas de Organízate, genera el
 * texto ya redactado de cada paciente citado un día concreto (normalmente
 * "mañana"), listo para copiar y pegar o abrir directo por WhatsApp si el
 * export trae teléfono. El envío lo sigue haciendo una persona, uno a uno.
 *
 * Desacoplado de Next.js/Supabase: recibe un Buffer + la plantilla +
 * fecha objetivo, devuelve los mensajes ya renderizados.
 */

import readXlsxFile from 'read-excel-file/node'

export interface MensajeRecordatorio {
  paciente: string
  hora: string | null
  profesional: string | null
  telefono: string | null
  mensaje: string
  enlaceWhatsapp: string | null
}

export interface ErrorFilaRecordatorio {
  fila: number
  motivo: string
}

export interface ResultadoGeneracionRecordatorios {
  fecha: string
  mensajes: MensajeRecordatorio[]
  errores: ErrorFilaRecordatorio[]
  tieneTelefonos: boolean
}

export class ErrorArchivoRecordatorios extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErrorArchivoRecordatorios'
  }
}

const COLUMNAS = {
  fecha: 'FECHA',
  hora: 'HORA',
  agenda: 'AGENDA',
  paciente: 'PACIENTE',
} as const
const ETIQUETAS_TELEFONO = ['TELEFONO', 'TELÉFONO', 'MOVIL', 'MÓVIL']

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
  const conGuiones = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (conGuiones) return `${conGuiones[1]}-${conGuiones[2].padStart(2, '0')}-${conGuiones[3].padStart(2, '0')}`
  const conBarras = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (conBarras) return `${conBarras[3]}-${conBarras[2].padStart(2, '0')}-${conBarras[1].padStart(2, '0')}`
  return null
}

function pareceXlsx(contenido: Buffer): boolean {
  return contenido.length >= 2 && contenido[0] === 0x50 && contenido[1] === 0x4b
}

function parsearLineaCSV(linea: string, separador: string): string[] {
  const campos: string[] = []
  let actual = ''
  let dentroComillas = false
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (dentroComillas) {
      if (c === '"') {
        if (linea[i + 1] === '"') {
          actual += '"'
          i++
        } else {
          dentroComillas = false
        }
      } else {
        actual += c
      }
    } else if (c === '"') {
      dentroComillas = true
    } else if (c === separador) {
      campos.push(actual)
      actual = ''
    } else {
      actual += c
    }
  }
  campos.push(actual)
  return campos
}

function parsearCSV(contenido: Buffer): Fila[] {
  const texto = contenido.toString('utf-8').replace(/^﻿/, '')
  const lineas = texto.split(/\r\n|\n/).filter((l) => l.length > 0)
  const separador = lineas[0]?.includes(';') ? ';' : ','
  return lineas.map((linea) => parsearLineaCSV(linea, separador))
}

interface Cabecera {
  fecha: number
  hora: number
  agenda: number
  paciente: number
  telefono: number
}

function detectarCabecera(fila: Fila): Cabecera | null {
  const etiquetas = fila.map(normalizarEtiqueta)
  const fecha = etiquetas.indexOf(COLUMNAS.fecha)
  const paciente = etiquetas.indexOf(COLUMNAS.paciente)
  if (fecha === -1 || paciente === -1) return null
  const telefono = etiquetas.findIndex((e) => ETIQUETAS_TELEFONO.includes(e))
  return {
    fecha,
    hora: etiquetas.indexOf(COLUMNAS.hora),
    agenda: etiquetas.indexOf(COLUMNAS.agenda),
    paciente,
    telefono,
  }
}

function celda(fila: Fila, indice: number): unknown {
  return indice >= 0 ? fila[indice] : undefined
}

// Misma normalización que paciente_clave en pacientes-telefono-importacion.ts,
// para poder cruzar el nombre del export de citas con el listado guardado.
function normalizarClavePaciente(nombreCompleto: string): string {
  return nombreCompleto.trim().replace(/\s+/g, ' ').toUpperCase()
}

function normalizarTelefono(valor: string): string | null {
  const digitos = valor.replace(/[^\d+]/g, '')
  if (digitos.length < 9) return null
  // wa.me exige el prefijo de país sin "+" ni espacios; asumimos España (34)
  // si el número no trae ya un prefijo internacional.
  if (digitos.startsWith('+')) return digitos.slice(1)
  if (digitos.length === 9) return `34${digitos}`
  return digitos
}

function renderizarMensaje(plantilla: string, datos: { nombre: string; fecha: string; hora: string; profesional: string }): string {
  return plantilla
    .replace(/\{nombre\}/g, datos.nombre)
    .replace(/\{fecha\}/g, datos.fecha)
    .replace(/\{hora\}/g, datos.hora)
    .replace(/\{profesional\}/g, datos.profesional)
}

export async function generarRecordatorios(
  contenido: Buffer,
  fechaObjetivo: string,
  plantilla: string,
  telefonosPorPaciente?: Map<string, string>
): Promise<ResultadoGeneracionRecordatorios> {
  let filas: Fila[]

  if (pareceXlsx(contenido)) {
    let hojas: { sheet: string; data: Fila[] }[]
    try {
      hojas = await readXlsxFile(contenido)
    } catch {
      throw new ErrorArchivoRecordatorios('El archivo no es un XLSX válido o está dañado.')
    }
    if (hojas.length === 0 || hojas[0].data.length === 0) {
      throw new ErrorArchivoRecordatorios('El archivo no contiene ninguna hoja con datos.')
    }
    filas = hojas[0].data
  } else {
    filas = parsearCSV(contenido)
    if (filas.length === 0) {
      throw new ErrorArchivoRecordatorios('El archivo no contiene ninguna fila con datos.')
    }
  }

  let cabecera: Cabecera | null = null
  for (let i = 0; i < Math.min(filas.length, MAX_FILAS_BUSQUEDA_CABECERA); i++) {
    cabecera = detectarCabecera(filas[i])
    if (cabecera) break
  }
  if (!cabecera) {
    throw new ErrorArchivoRecordatorios(
      'No se encuentra la cabecera esperada (Fecha, Paciente...). ¿Es un export de citas de Organízate?'
    )
  }

  const errores: ErrorFilaRecordatorio[] = []
  // Una cita con varios tratamientos (p.ej. estudio + señal de plantillas)
  // aparece como varias filas con el mismo paciente y hora: se agrupan en
  // un único recordatorio por visita, clave paciente+hora.
  const mensajesPorClave = new Map<string, MensajeRecordatorio>()
  let tieneTelefonos = false

  for (let indice = 0; indice < filas.length; indice++) {
    const fila = filas[indice]
    const numeroFila = indice + 1
    if (fila.every((c) => textoCelda(c) === null)) continue
    if (detectarCabecera(fila)) continue

    const fecha = parsearFecha(celda(fila, cabecera.fecha))
    const paciente = textoCelda(celda(fila, cabecera.paciente))
    if (!fecha && !paciente) continue // fila de ruido / resumen

    if (fecha !== fechaObjetivo) continue // no es del día que nos interesa
    if (!paciente) {
      errores.push({ fila: numeroFila, motivo: 'Paciente vacío' })
      continue
    }

    const hora = textoCelda(celda(fila, cabecera.hora)) ?? '—'
    const profesional = textoCelda(celda(fila, cabecera.agenda))
    const telefonoRaw = textoCelda(celda(fila, cabecera.telefono))
    const telefonoDelExport = telefonoRaw ? normalizarTelefono(telefonoRaw) : null
    const telefonoGuardado = telefonosPorPaciente?.get(normalizarClavePaciente(paciente))
    const telefono = telefonoDelExport ?? (telefonoGuardado ? normalizarTelefono(telefonoGuardado) : null)
    if (telefono) tieneTelefonos = true

    const clave = `${paciente.toUpperCase()}||${hora}`
    if (mensajesPorClave.has(clave)) continue // misma visita, ya generado

    const mensaje = renderizarMensaje(plantilla, {
      nombre: paciente,
      fecha: fechaObjetivo,
      hora,
      profesional: profesional ?? 'nuestro equipo',
    })

    mensajesPorClave.set(clave, {
      paciente,
      hora: hora === '—' ? null : hora,
      profesional,
      telefono,
      mensaje,
      enlaceWhatsapp: telefono ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}` : null,
    })
  }

  const mensajes = [...mensajesPorClave.values()].sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? ''))

  return { fecha: fechaObjetivo, mensajes, errores, tieneTelefonos }
}

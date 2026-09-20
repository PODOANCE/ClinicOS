/**
 * Importación del listado de pacientes de Organízate (Nombre, Apellidos,
 * Tel. fijo, Tel. móvil...), para poder generar enlaces directos de
 * WhatsApp en Recordatorios sin depender de que el export diario de citas
 * traiga teléfono. Se sube de vez en cuando (no cada día).
 *
 * Desacoplado de Next.js/Supabase: recibe un Buffer y devuelve filas
 * normalizadas listas para guardar.
 */

import readXlsxFile from 'read-excel-file/node'
import { normalizarClavePaciente } from '@/lib/services/paciente-clave'

export interface PacienteTelefonoNormalizado {
  paciente_clave: string
  nombre_mostrar: string
  telefono: string | null
  edad: number | null
}

export class ErrorArchivoPacientesTelefono extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErrorArchivoPacientesTelefono'
  }
}

const COLUMNAS = {
  nombre: 'NOMBRE',
  apellidos: 'APELLIDOS',
  telMovil: 'TEL. MOVIL',
  telFijo: 'TEL. FIJO',
  edad: 'EDAD',
} as const

const MAX_FILAS_BUSQUEDA_CABECERA = 10

type Fila = string[]

function textoCelda(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  const texto = String(valor).trim()
  return texto.length > 0 ? texto : null
}

function normalizarEtiqueta(valor: unknown): string {
  const texto = textoCelda(valor)
  return texto ? texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase() : ''
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

// Un XLSX real es un ZIP y empieza por la firma "PK"; si no, se trata como
// CSV delimitado (Organízate a veces exporta así aunque el archivo se
// llame .xlsx o .xls).
function pareceXlsx(contenido: Buffer): boolean {
  return contenido.length >= 2 && contenido[0] === 0x50 && contenido[1] === 0x4b
}

interface Cabecera {
  nombre: number
  apellidos: number
  telMovil: number
  telFijo: number
  edad: number
}

function detectarCabecera(fila: Fila): Cabecera | null {
  const etiquetas = fila.map(normalizarEtiqueta)
  const nombre = etiquetas.indexOf(COLUMNAS.nombre)
  const apellidos = etiquetas.indexOf(COLUMNAS.apellidos)
  if (nombre === -1 || apellidos === -1) return null
  return {
    nombre,
    apellidos,
    telMovil: etiquetas.indexOf(COLUMNAS.telMovil),
    telFijo: etiquetas.indexOf(COLUMNAS.telFijo),
    edad: etiquetas.indexOf(COLUMNAS.edad),
  }
}

function celda(fila: Fila, indice: number): unknown {
  return indice >= 0 ? fila[indice] : undefined
}

function normalizarTelefono(valor: string): string | null {
  const digitos = valor.replace(/[^\d]/g, '')
  if (digitos.length < 9) return null
  return digitos
}

function normalizarEdad(valor: string | null): number | null {
  if (!valor) return null
  const edad = parseInt(valor, 10)
  return Number.isFinite(edad) && edad >= 0 && edad < 130 ? edad : null
}

export async function parsearListadoPacientes(contenido: Buffer): Promise<PacienteTelefonoNormalizado[]> {
  let filas: Fila[]
  if (pareceXlsx(contenido)) {
    let hojas: { sheet: string; data: unknown[][] }[]
    try {
      hojas = await readXlsxFile(contenido)
    } catch {
      throw new ErrorArchivoPacientesTelefono('El archivo no es un XLSX válido o está dañado.')
    }
    if (hojas.length === 0 || hojas[0].data.length === 0) {
      throw new ErrorArchivoPacientesTelefono('El archivo no contiene ninguna hoja con datos.')
    }
    filas = hojas[0].data.map((fila) => fila.map((c) => (c === null || c === undefined ? '' : String(c))))
  } else {
    filas = parsearCSV(contenido)
  }
  if (filas.length === 0) {
    throw new ErrorArchivoPacientesTelefono('El archivo no contiene ninguna fila con datos.')
  }

  let cabecera: Cabecera | null = null
  for (let i = 0; i < Math.min(filas.length, MAX_FILAS_BUSQUEDA_CABECERA); i++) {
    cabecera = detectarCabecera(filas[i])
    if (cabecera) break
  }
  if (!cabecera) {
    throw new ErrorArchivoPacientesTelefono(
      'No se encuentra la cabecera esperada (Nombre, Apellidos...). ¿Es el listado de pacientes de Organízate?'
    )
  }

  // Puede haber dos pacientes reales distintos con el mismo nombre
  // completo (o un duplicado de ficha en Organízate); nos quedamos con uno
  // solo por clave, si no el upsert falla al repetir la clave en el mismo
  // lote.
  const porClave = new Map<string, PacienteTelefonoNormalizado>()

  for (let indice = 0; indice < filas.length; indice++) {
    const fila = filas[indice]
    if (fila.every((c) => textoCelda(c) === null)) continue
    if (detectarCabecera(fila)) continue

    const nombre = textoCelda(celda(fila, cabecera.nombre))
    const apellidos = textoCelda(celda(fila, cabecera.apellidos))
    if (!nombre && !apellidos) continue

    const nombreCompleto = [nombre, apellidos].filter(Boolean).join(' ')
    const movil = textoCelda(celda(fila, cabecera.telMovil))
    const fijo = textoCelda(celda(fila, cabecera.telFijo))
    const telefono = (movil && normalizarTelefono(movil)) || (fijo && normalizarTelefono(fijo)) || null
    const edad = normalizarEdad(textoCelda(celda(fila, cabecera.edad)))
    if (!telefono && edad === null) continue // no aporta nada ni a Recordatorios ni a Seguimiento

    porClave.set(normalizarClavePaciente(nombreCompleto), {
      paciente_clave: normalizarClavePaciente(nombreCompleto),
      nombre_mostrar: nombreCompleto,
      telefono,
      edad,
    })
  }

  return [...porClave.values()]
}

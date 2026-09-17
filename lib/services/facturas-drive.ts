/**
 * Servicio de integración con Google Drive para gestión de Facturas
 *
 * Responsabilidades:
 * - Acceder a FACTURAS/ENTRADA en Drive
 * - Listar PDFs con metadata completa
 * - Reutilizable por: procesamiento manual, cron semanal, clasificación, movimiento
 *
 * SEGURIDAD:
 * - Usa una cuenta de servicio de Google (sin caducidad, sin consentimiento
 *   interactivo); la carpeta FACTURAS debe estar compartida con su email
 * - No expone credenciales al cliente
 * - No modifica archivos sin autorización explícita
 */

import { getServiceAccountAuth } from '@/lib/oauth/google-auth'
import { getFolderByName, listPDFsInFolder, downloadFileAsBuffer } from '@/lib/oauth/google-drive'
import { createAdminClient } from '@/lib/supabase/server'
import { google } from 'googleapis'
import crypto from 'crypto'

interface FacturaPDF {
  drive_file_id: string
  nombre: string
  mimeType: string
  tamaño: number | null
  modifiedTime: string | null
  createdTime: string | null
  webViewLink: string | null
}

interface ListadoFacturasResult {
  exitoso: boolean
  error?: string
  archivos: FacturaPDF[]
  totalArchivos: number
  nextPageToken?: string
}

/**
 * Obtiene la carpeta FACTURAS desde el root de Drive
 * Si no existe, lanza error
 */
async function obtenerCarpetaFacturas(): Promise<any> {

  const carpetaFacturas = await getFolderByName('FACTURAS')
  if (!carpetaFacturas) {
    throw new Error('Carpeta FACTURAS no encontrada en Drive')
  }

  return carpetaFacturas
}

/**
 * Obtiene la carpeta FACTURAS/ENTRADA
 * Si no existe, lanza error
 */
async function obtenerCarpetaEntrada(): Promise<any> {

  const carpetaFacturas = await obtenerCarpetaFacturas()
  const carpetaEntrada = await getFolderByName('ENTRADA', carpetaFacturas.id)

  if (!carpetaEntrada) {
    throw new Error('Carpeta ENTRADA no encontrada dentro de FACTURAS')
  }

  return carpetaEntrada
}

/**
 * Lista todos los PDFs en FACTURAS/ENTRADA con metadata completa
 * Usa paginación con nextPageToken
 *
 * @param pageToken Token de página para continuar un listado anterior
 * @returns Lista de archivos PDF con metadata
 */
export async function listarPDFsEnEntrada(
  pageToken?: string
): Promise<ListadoFacturasResult> {
  try {

    const carpetaEntrada = await obtenerCarpetaEntrada()

    const resultado = await listPDFsInFolder(carpetaEntrada.id, {
      pageSize: 50,
      pageToken,
    })

    const archivos: FacturaPDF[] = resultado.files.map((file: any) => ({
      drive_file_id: file.id,
      nombre: file.name,
      mimeType: file.mimeType,
      tamaño: file.size ? parseInt(file.size) : null,
      modifiedTime: file.modifiedTime || null,
      createdTime: file.createdTime || null,
      webViewLink: file.webViewLink || null,
    }))

    return {
      exitoso: true,
      archivos,
      totalArchivos: archivos.length,
      nextPageToken: resultado.nextPageToken || undefined,
    }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error listando PDFs en ENTRADA:', mensaje)
    return {
      exitoso: false,
      error: mensaje,
      archivos: [],
      totalArchivos: 0,
    }
  }
}

/**
 * Obtiene metadata de un archivo específico en Drive
 * Útil para verificar que un archivo sigue existiendo
 *
 * @param driveFileId ID del archivo en Drive
 * @returns Metadata del archivo
 */
export async function obtenerMetadataArchivo(driveFileId: string): Promise<FacturaPDF | null> {
  try {

    const auth = getServiceAccountAuth()
    const drive = google.drive({ version: 'v3', auth })

    const file = await drive.files.get({
      fileId: driveFileId,
      fields: 'id, name, mimeType, size, modifiedTime, createdTime, webViewLink, parents',
    })

    if (!file.data) return null

    return {
      drive_file_id: file.data.id!,
      nombre: file.data.name!,
      mimeType: file.data.mimeType!,
      tamaño: file.data.size ? parseInt(file.data.size) : null,
      modifiedTime: file.data.modifiedTime || null,
      createdTime: file.data.createdTime || null,
      webViewLink: file.data.webViewLink || null,
    }
  } catch (error) {
    console.error('Error obteniendo metadata:', error)
    return null
  }
}

/**
 * Crea la estructura completa de carpetas si no existe
 * Estructura:
 * FACTURAS/
 *   ├── ENTRADA/
 *   ├── SIN CLASIFICAR/
 *   └── 2026/
 *       ├── ENERO/ ... DICIEMBRE/
 *       │   ├── PENDIENTES DE ENVIAR A GESTORÍA/
 *       │   └── ENVIADAS A GESTORÍA/
 */
export async function crearEstructuraFacturas(): Promise<{
  exitoso: boolean
  mensaje?: string
  error?: string
  carpetasCreadas?: string[]
}> {
  try {

    const auth = getServiceAccountAuth()
    const drive = google.drive({ version: 'v3', auth })

    const carpetasCreadas: string[] = []

    // Obtener o crear FACTURAS
    let carpetaFacturas = await getFolderByName('FACTURAS')
    if (!carpetaFacturas) {
      const result = await drive.files.create({
        requestBody: {
          name: 'FACTURAS',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id, name',
      })
      carpetaFacturas = result.data
      carpetasCreadas.push('FACTURAS')
    }

    // Crear ENTRADA
    const entrada = await getFolderByName('ENTRADA', carpetaFacturas.id)
    if (!entrada) {
      await drive.files.create({
        requestBody: {
          name: 'ENTRADA',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [carpetaFacturas.id!],
        },
        fields: 'id, name',
      })
      carpetasCreadas.push('FACTURAS/ENTRADA')
    }

    // Crear SIN CLASIFICAR
    const sinClasificar = await getFolderByName('SIN CLASIFICAR', carpetaFacturas.id)
    if (!sinClasificar) {
      await drive.files.create({
        requestBody: {
          name: 'SIN CLASIFICAR',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [carpetaFacturas.id!],
        },
        fields: 'id, name',
      })
      carpetasCreadas.push('FACTURAS/SIN CLASIFICAR')
    }

    // Crear 2026
    let carpeta2026 = await getFolderByName('2026', carpetaFacturas.id)
    if (!carpeta2026) {
      const result = await drive.files.create({
        requestBody: {
          name: '2026',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [carpetaFacturas.id!],
        },
        fields: 'id, name',
      })
      carpeta2026 = result.data
      carpetasCreadas.push('FACTURAS/2026')
    }

    // Crear carpetas de meses y sus subcarpetas
    const meses = [
      'ENERO',
      'FEBRERO',
      'MARZO',
      'ABRIL',
      'MAYO',
      'JUNIO',
      'JULIO',
      'AGOSTO',
      'SEPTIEMBRE',
      'OCTUBRE',
      'NOVIEMBRE',
      'DICIEMBRE',
    ]

    for (const mes of meses) {
      let carpetaMes = await getFolderByName(mes, carpeta2026.id!)
      if (!carpetaMes) {
        const result = await drive.files.create({
          requestBody: {
            name: mes,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [carpeta2026.id!],
          },
          fields: 'id, name',
        })
        carpetaMes = result.data
        carpetasCreadas.push(`FACTURAS/2026/${mes}`)
      }

      // Crear subcarpetas del mes
      const pendientes = await getFolderByName('PENDIENTES DE ENVIAR A GESTORÍA', carpetaMes.id!)
      if (!pendientes) {
        await drive.files.create({
          requestBody: {
            name: 'PENDIENTES DE ENVIAR A GESTORÍA',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [carpetaMes.id!],
          },
          fields: 'id, name',
        })
        carpetasCreadas.push(`FACTURAS/2026/${mes}/PENDIENTES DE ENVIAR A GESTORÍA`)
      }

      const enviadas = await getFolderByName('ENVIADAS A GESTORÍA', carpetaMes.id!)
      if (!enviadas) {
        await drive.files.create({
          requestBody: {
            name: 'ENVIADAS A GESTORÍA',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [carpetaMes.id!],
          },
          fields: 'id, name',
        })
        carpetasCreadas.push(`FACTURAS/2026/${mes}/ENVIADAS A GESTORÍA`)
      }
    }

    return {
      exitoso: true,
      mensaje: `Estructura creada. ${carpetasCreadas.length} carpetas nuevas.`,
      carpetasCreadas,
    }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error creando estructura:', mensaje)
    return {
      exitoso: false,
      error: mensaje,
    }
  }
}

/**
 * Calcula el hash SHA256 de un PDF descargado desde Drive
 */
async function calcularHashPDF(driveFileId: string): Promise<string> {
  try {
    const buffer = await downloadFileAsBuffer(driveFileId)
    const hash = crypto.createHash('sha256').update(buffer).digest('hex')
    return hash
  } catch (error) {
    console.error('Error calculando hash:', error)
    throw error
  }
}

/**
 * Registra una factura nueva en Supabase
 * Garantiza idempotencia por drive_file_id (UNIQUE)
 */
async function registrarFacturaNueva(
  driveFileId: string,
  hashPdf: string,
  nombreArchivo: string,
  tamaño: number | null,
  createdTime: string | null,
  modifiedTime: string | null,
  webViewLink: string | null,
  centroId: string,
  proveedorId: string
): Promise<{ id: string; creado: boolean }> {
  const supabase = createAdminClient()

  // Verificar si ya existe
  const { data: existente } = await supabase
    .from('facturas')
    .select('id')
    .eq('drive_file_id', driveFileId)
    .single()

  if (existente) {
    return { id: existente.id, creado: false }
  }

  // Crear registro nuevo
  // NOTA B.2: proveedor_id es NULL - se asignará en B.3 cuando IA determine el proveedor
  const { data: nueva, error } = await supabase
    .from('facturas')
    .insert({
      drive_file_id: driveFileId,
      hash_pdf: hashPdf,
      numero_factura: `ENTRADA-${nombreArchivo}`, // Temporal - se actualizará en B.3
      proveedor_id: null as any, // Será determinado por IA en B.3
      drive_web_view_link: webViewLink,
      estado_lectura: 'PENDIENTE',
      estado_conciliacion: 'NO_CONCILIADA',
      estado_gestor: 'PENDIENTE_ENVIAR',
      created_by: '00000000-0000-0000-0000-000000000000', // SISTEMA_CRON
      updated_by: '00000000-0000-0000-0000-000000000000',
      centro_id: centroId,
      activo: true,
    })
    .select('id')
    .single()

  if (error) {
    console.error('ERROR SUPABASE INSERTING FACTURA:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    throw new Error(`INSERT facturas failed: ${error.message} (${error.code})`)
  }

  if (!nueva) {
    throw new Error('No se pudo crear la factura')
  }

  return { id: nueva.id, creado: true }
}

/**
 * Detecta PDFs nuevos en ENTRADA y los registra en Supabase
 * Requiere que el proveedor_id exista en la tabla proveedores
 */
export async function detectarYRegistrarFacturasNuevasConProveedor(
  centroId: string,
  proveedorId: string
): Promise<{
  exitoso: boolean
  error?: string
  facturasDetectadas: number
  facturasNuevas: number
  facturasExistentes: number
  detalles?: Array<{
    driveFileId: string
    nombre: string
    creado: boolean
    facturaId?: string
  }>
}> {
  try {

    const resultadoListado = await listarPDFsEnEntrada()
    if (!resultadoListado.exitoso) {
      return {
        exitoso: false,
        error: resultadoListado.error || 'Error listando PDFs',
        facturasDetectadas: 0,
        facturasNuevas: 0,
        facturasExistentes: 0,
      }
    }

    const archivos = resultadoListado.archivos
    const detalles: Array<{
      driveFileId: string
      nombre: string
      creado: boolean
      facturaId?: string
    }> = []

    let facturasNuevas = 0
    let facturasExistentes = 0

    // Procesar cada PDF con el proveedor_id proporcionado
    for (const archivo of archivos) {
      try {
        // Calcular hash
        const hashPdf = await calcularHashPDF(archivo.drive_file_id)

        // Registrar factura (idempotente)
        const { id: facturaId, creado } = await registrarFacturaNueva(
          archivo.drive_file_id,
          hashPdf,
          archivo.nombre,
          archivo.tamaño,
          archivo.createdTime,
          archivo.modifiedTime,
          archivo.webViewLink,
          centroId,
          proveedorId
        )

        detalles.push({
          driveFileId: archivo.drive_file_id,
          nombre: archivo.nombre,
          creado,
          facturaId,
        })

        if (creado) {
          facturasNuevas++
        } else {
          facturasExistentes++
        }
      } catch (error) {
        console.error(`Error procesando ${archivo.nombre}:`, error)
        detalles.push({
          driveFileId: archivo.drive_file_id,
          nombre: archivo.nombre,
          creado: false,
        })
      }
    }

    return {
      exitoso: true,
      facturasDetectadas: archivos.length,
      facturasNuevas,
      facturasExistentes,
      detalles,
    }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error en detección:', mensaje)
    return {
      exitoso: false,
      error: mensaje,
      facturasDetectadas: 0,
      facturasNuevas: 0,
      facturasExistentes: 0,
    }
  }
}

/**
 * Verifica que la estructura de carpetas FACTURAS existe
 * Si no existe, la crea automáticamente
 */
export async function verificarEstructuraFacturas(): Promise<{
  exitoso: boolean
  estructuraCreada?: boolean
  facturas?: { id: string; nombre: string }
  entrada?: { id: string; nombre: string }
  error?: string
}> {
  try {

    // Intentar obtener las carpetas
    try {
      const carpetaFacturas = await obtenerCarpetaFacturas()
      const carpetaEntrada = await obtenerCarpetaEntrada()

      return {
        exitoso: true,
        estructuraCreada: false,
        facturas: { id: carpetaFacturas.id, nombre: carpetaFacturas.name },
        entrada: { id: carpetaEntrada.id, nombre: carpetaEntrada.name },
      }
    } catch {
      // Si falta alguna carpeta, crear la estructura completa
      const resultadoCreacion = await crearEstructuraFacturas()
      if (!resultadoCreacion.exitoso) {
        throw new Error(resultadoCreacion.error || 'Error creando estructura')
      }

      // Verificar de nuevo después de crear
      const carpetaFacturas = await obtenerCarpetaFacturas()
      const carpetaEntrada = await obtenerCarpetaEntrada()

      return {
        exitoso: true,
        estructuraCreada: true,
        facturas: { id: carpetaFacturas.id, nombre: carpetaFacturas.name },
        entrada: { id: carpetaEntrada.id, nombre: carpetaEntrada.name },
      }
    }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido'
    return {
      exitoso: false,
      error: mensaje,
    }
  }
}

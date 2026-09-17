import { createAdminClient } from '@/lib/supabase/server'
import { downloadFileAsBuffer } from '@/lib/oauth/google-drive'
import { extraerTextoDelPdf, extraerDatosFacturaConClaude } from './claude'

interface ExtraccionIA {
  numero_factura?: string
  fecha_emision?: string
  fecha_vencimiento?: string
  nif_cif_proveedor?: string
  nombre_proveedor?: string
  base_imponible?: number
  iva?: number
  total?: number
  tipo_iva?: string
  concepto?: string
  moneda?: string
  iban?: string
  [key: string]: unknown
}

interface ErrorValidacion {
  campo: string
  mensaje: string
}

interface ResultadoProcesamiento {
  exitoso: boolean
  facturaId: string
  estado: string
  datos?: ExtraccionIA
  errores?: ErrorValidacion[]
  error?: string
}

/**
 * B.3.1: Obtiene factura y verifica que existe drive_file_id
 */
async function obtenerFactura(facturaId: string) {
  const supabase = createAdminClient()
  const { data: factura, error } = await supabase
    .from('facturas')
    .select('id, drive_file_id, estado_lectura')
    .eq('id', facturaId)
    .single()

  if (error || !factura) {
    throw new Error(`Factura no encontrada: ${facturaId}`)
  }

  if (!factura.drive_file_id) {
    throw new Error(`Factura sin drive_file_id: ${facturaId}`)
  }

  return factura
}

/**
 * B.3.1: Descarga PDF desde Google Drive.
 * Un fallo real (Drive, permisos, archivo vacío) se propaga como excepción
 * en vez de sustituirse por un PDF de prueba: un error de descarga nunca
 * debe leerse como si fuera la factura real.
 * EXPORTADA: Reutilizada en Phase 2A (reprocesamiento manual)
 */
export async function descargarPdf(driveFileId: string): Promise<Buffer> {
  const pdfBuffer = await downloadFileAsBuffer(driveFileId)
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('PDF descargado está vacío')
  }
  return pdfBuffer
}

/**
 * B.3.2: Extrae texto del PDF y envía a Claude para obtener datos estructurados
 * Retorna { datos, textExtraido } para auditoría
 */
async function extraerDatosConIA(
  pdfBuffer: Buffer
): Promise<{ datos: ExtraccionIA; textExtraido: string | null }> {
  // Extraer texto del PDF
  const textExtraido = await extraerTextoDelPdf(pdfBuffer)

  // Si no hay texto suficiente, no podemos procesar
  if (!textExtraido) {
    throw new Error(
      'PDF no contiene texto suficiente (probablemente escaneo). Requiere procesamiento manual.'
    )
  }

  // Enviar texto a Claude
  const datos = await extraerDatosFacturaConClaude(textExtraido)
  return { datos, textExtraido }
}

/**
 * B.3.3: Valida coherencia de los datos extraídos
 * EXPORTADA: Reutilizada en Phase 2A (reprocesamiento manual)
 */
export function validarDatos(datos: ExtraccionIA): ErrorValidacion[] {
  const errores: ErrorValidacion[] = []

  // Validación: importes no negativos
  if (datos.base_imponible !== undefined && datos.base_imponible < 0) {
    errores.push({
      campo: 'base_imponible',
      mensaje: 'Base imponible no puede ser negativa',
    })
  }
  if (datos.iva !== undefined && datos.iva < 0) {
    errores.push({
      campo: 'iva',
      mensaje: 'IVA no puede ser negativo',
    })
  }
  if (datos.total !== undefined && datos.total < 0) {
    errores.push({
      campo: 'total',
      mensaje: 'Total no puede ser negativo',
    })
  }

  // Validación: coherencia matemática (base + iva ≈ total)
  if (
    datos.base_imponible !== undefined &&
    datos.iva !== undefined &&
    datos.total !== undefined
  ) {
    const calculado = datos.base_imponible + datos.iva
    const diferencia = Math.abs(calculado - datos.total)
    // Tolerancia: 0.01 EUR
    if (diferencia > 0.01) {
      errores.push({
        campo: 'total',
        mensaje: `Inconsistencia: ${datos.base_imponible} + ${datos.iva} = ${calculado}, pero total es ${datos.total} (diferencia: ${diferencia.toFixed(2)})`,
      })
    }
  }

  // Validación: fechas coherentes
  if (datos.fecha_emision && datos.fecha_vencimiento) {
    const emision = new Date(datos.fecha_emision)
    const vencimiento = new Date(datos.fecha_vencimiento)
    if (vencimiento < emision) {
      errores.push({
        campo: 'fecha_vencimiento',
        mensaje: 'Fecha de vencimiento no puede ser anterior a emisión',
      })
    }
  }

  // Validación: tipo de IVA razonable
  if (datos.tipo_iva !== undefined) {
    const tipoIva = parseFloat(String(datos.tipo_iva))
    if (isNaN(tipoIva) || tipoIva < 0 || tipoIva > 100) {
      errores.push({
        campo: 'tipo_iva',
        mensaje: `Tipo de IVA inválido: ${datos.tipo_iva}`,
      })
    }
  }

  return errores
}

/**
 * B.3.4: Genera metadatos de extracción (texto_length, texto_preview)
 * EXPORTADA: Reutilizada en Phase 2A (reprocesamiento manual)
 */
export function generarMetadatosExtraccion(textExtraido: string | null) {
  return textExtraido
    ? {
        texto_length: textExtraido.length,
        texto_preview: textExtraido.substring(0, 500),
      }
    : { texto_length: 0 }
}

/**
 * B.3.4: Guarda respuesta de IA en tabla facturas_extraccion_ia
 * Incluye: JSON bruto de Claude, datos validados, errores, y metadatos para auditoría
 * Retorna: UUID de la extracción guardada (para vincular a factura)
 */
async function guardarExtraccion(
  facturaId: string,
  respuestaJson: ExtraccionIA,
  textExtraido: string | null,
  datosValidados?: ExtraccionIA,
  erroresValidacion?: ErrorValidacion[],
  origen: 'automatico' | 'skill' = 'automatico'
): Promise<string> {
  const supabase = createAdminClient()

  const metadatos = { ...generarMetadatosExtraccion(textExtraido), origen }

  const { data, error } = await supabase
    .from('facturas_extraccion_ia')
    .insert({
      factura_id: facturaId,
      usuario_id: null, // NULL significa "procesamiento no interactivo" (automático o Skill)
      respuesta_json: {
        ...respuestaJson,
        _metadatos: metadatos,
      },
      datos_validados: datosValidados || null,
      errores_validacion: erroresValidacion ? erroresValidacion.map((e) => e.mensaje) : null,
    })
    .select('id')

  if (error) {
    throw new Error(`Error guardando extracción: ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error('No se pudo obtener ID de extracción generada')
  }

  return data[0].id
}

/**
 * B.3.4: Actualiza estado de factura y vincula extracción IA aplicada
 */
async function actualizarFactura(
  facturaId: string,
  estado: string,
  datos?: Partial<ExtraccionIA>,
  proveedorId?: string | null,
  extraccionIaId?: string // ID de extracción IA a vincular (B.3: siempre presente)
) {
  const supabase = createAdminClient()

  const actualizacion: Record<string, unknown> = {
    estado_lectura: estado,
    updated_by: '00000000-0000-0000-0000-000000000000', // SISTEMA_CRON
  }

  // Vincular extracción IA (o NULL si no hay)
  // En B.3: siempre pasamos el UUID después de guardarla
  // En B.4.2 PATCH: RPC ya pone NULL cuando usuario edita
  if (extraccionIaId !== undefined) {
    actualizacion.extraccion_ia_id = extraccionIaId || null
  }

  // Si hay datos validados, mapearlos a columnas de factura
  if (datos) {
    if (datos.numero_factura) actualizacion.numero_factura = datos.numero_factura
    if (datos.fecha_emision) actualizacion.fecha_emision = datos.fecha_emision
    if (datos.base_imponible) actualizacion.importe_base = datos.base_imponible
    if (datos.iva) actualizacion.importe_iva = datos.iva
    if (datos.total) actualizacion.importe_total = datos.total
  }

  // B.3.5: Asignar proveedor si fue encontrado
  if (proveedorId !== undefined) {
    actualizacion.proveedor_id = proveedorId
  }

  const { error } = await supabase
    .from('facturas')
    .update(actualizacion)
    .eq('id', facturaId)

  if (error) {
    throw new Error(`Error actualizando factura: ${error.message}`)
  }
}

/**
 * B.3.5: Busca proveedor por CIF/NIF
 * EXPORTADA: Reutilizada en Phase 2A (reprocesamiento manual)
 */
export async function buscarProveedorPorCifNif(cifNif: string): Promise<string | null> {
  const supabase = createAdminClient()

  // Normalizar: remover espacios y guiones
  const cifNormalized = cifNif.trim().replace(/[-\s]/g, '').toUpperCase()

  if (!cifNormalized) {
    return null
  }

  const { data } = await supabase
    .from('proveedores')
    .select('id')
    .eq('cif_nif', cifNormalized)
    .single()

  return data?.id || null
}

/**
 * Aplica unos datos ya extraídos (por Claude, sea la ruta automática interna
 * o una lectura hecha externamente, ej. la Skill) a una factura: valida,
 * guarda la extracción, busca proveedor por CIF/NIF y actualiza la factura.
 * Compartida por procesarFactura() y por el endpoint de la Skill para no
 * duplicar las reglas de validación ni el mapeo a columnas.
 */
export async function aplicarDatosExtraccion(
  facturaId: string,
  datosIA: ExtraccionIA,
  textExtraido: string | null,
  origen: 'automatico' | 'skill' = 'automatico'
): Promise<ResultadoProcesamiento> {
  const erroresValidacion = validarDatos(datosIA)

  const extraccionIaId = await guardarExtraccion(
    facturaId,
    datosIA,
    textExtraido,
    erroresValidacion.length === 0 ? datosIA : undefined,
    erroresValidacion.length > 0 ? erroresValidacion : undefined,
    origen
  )

  let proveedorId: string | null = null
  if (erroresValidacion.length === 0 && datosIA.nif_cif_proveedor) {
    proveedorId = await buscarProveedorPorCifNif(datosIA.nif_cif_proveedor)
  }

  if (erroresValidacion.length === 0) {
    await actualizarFactura(facturaId, 'VALIDACION_EXITOSA', datosIA, proveedorId, extraccionIaId)
    return { exitoso: true, facturaId, estado: 'VALIDACION_EXITOSA', datos: datosIA }
  }

  await actualizarFactura(facturaId, 'REVISION_MANUAL', datosIA, proveedorId, extraccionIaId)
  return {
    exitoso: false,
    facturaId,
    estado: 'REVISION_MANUAL',
    datos: datosIA,
    errores: erroresValidacion,
  }
}

/**
 * Orquestador principal: B.3.1 → B.3.5
 *
 * Flujo de estados:
 * 1. LECTURA_PENDIENTE (comienza procesamiento)
 * 2. LECTURA_EXITOSA (Claude respondió con JSON válido)
 * 3. VALIDACION_EXITOSA (datos pasan nuestras reglas) ✓
 *    o REVISION_MANUAL (datos inconsistentes)
 * 4. B.3.5: Buscar proveedor por CIF/NIF
 *
 * Errores técnicos → ERROR_LECTURA (permite reintento)
 * Ya procesada → devolver estado actual (idempotencia controlada)
 */
export async function procesarFactura(facturaId: string): Promise<ResultadoProcesamiento> {
  let textExtraido: string | null = null

  try {
    // 1. Obtener factura
    const factura = await obtenerFactura(facturaId)

    // B.3.5: IDEMPOTENCIA ATÓMICA (RPC transaccional)
    // La RPC `iniciar_procesamiento_factura()` maneja:
    // - FOR UPDATE: bloquea la fila
    // - Verifica estado_lectura
    // - Cambia a LECTURA_PENDIENTE (atómico) si es NULL/ERROR_LECTURA
    // - Devuelve puede_procesar: boolean
    //
    // Esto evita race conditions entre múltiples procesos B.3 simultáneos.
    // Solo UN proceso por factura obtendrá puede_procesar = true.

    const supabase = createAdminClient()
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'iniciar_procesamiento_factura',
      { p_factura_id: facturaId }
    )

    if (rpcError) {
      throw new Error(`Error en RPC idempotencia: ${rpcError.message}`)
    }

    if (!rpcResult || rpcResult.length === 0) {
      throw new Error('RPC idempotencia devolvió resultado vacío')
    }

    const [rpcRow] = rpcResult
    const { puede_procesar, estado_actual, razon } = rpcRow

    if (!puede_procesar) {
      // Si la factura no existe, es un error de entrada (no es idempotencia)
      if (razon === 'FACTURA_NO_EXISTE') {
        throw new Error(`Factura no existe: ${facturaId}`)
      }

      // Otros casos: otro proceso está procesando o ya fue completado (idempotencia)
      console.log(
        `[IDEMPOTENCIA] No procesando factura ${facturaId}. Razón: ${razon}, Estado: ${estado_actual}`
      )
      return {
        exitoso: true,
        facturaId,
        estado: estado_actual || 'DESCONOCIDO',
        datos: undefined,
      }
    }

    // ✅ SEGURO PROCESAR
    // La RPC ya cambió estado a LECTURA_PENDIENTE de forma atómica
    console.log('[IDEMPOTENCIA] Factura adquirida para procesamiento:', facturaId)

    // 3. B.3.1: Descargar PDF
    const pdfBuffer = await descargarPdf(factura.drive_file_id)

    // 4. B.3.2: Extraer datos con IA
    const { datos: datosIA, textExtraido: texto } = await extraerDatosConIA(pdfBuffer)
    textExtraido = texto

    // Cambiar a LECTURA_EXITOSA (Claude respondió bien)
    // En este punto NO guardamos extracción aún: solo confirmamos que Claude respondió
    await actualizarFactura(facturaId, 'LECTURA_EXITOSA', datosIA, undefined, undefined)

    // 5-8. Validar, guardar extracción, buscar proveedor y actualizar factura
    // (lógica compartida con el endpoint de la Skill, ver aplicarDatosExtraccion)
    return await aplicarDatosExtraccion(facturaId, datosIA, textExtraido, 'automatico')
  } catch (error) {
    // Error técnico: ERROR_LECTURA
    // Sin extraccionIaId porque no completamos guardarExtraccion()
    const mensajeError = error instanceof Error ? error.message : 'Error desconocido'

    try {
      await actualizarFactura(facturaId, 'ERROR_LECTURA', undefined, undefined, undefined)
    } catch {
      // Si ni siquiera se puede actualizar el estado, log y continúa
      console.error('No se pudo actualizar estado a ERROR_LECTURA:', mensajeError)
    }

    return {
      exitoso: false,
      facturaId,
      estado: 'ERROR_LECTURA',
      error: mensajeError,
    }
  }
}

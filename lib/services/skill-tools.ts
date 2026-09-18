/**
 * Lógica compartida entre los endpoints REST bajo /api/skill/* y el
 * servidor MCP en /api/[transport] — un único sitio con las reglas, para
 * que la Skill/Conector nunca pueda comportarse distinto según por dónde
 * entre.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { ejecutarMatching } from './conciliacion'
import { descargarPdf, aplicarDatosExtraccion } from './facturas-lectura'
import { extraerTextoDelPdf } from './claude'

export class SkillToolError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status = 500) {
    super(message)
    this.code = code
    this.status = status
  }
}

const MARCA_RESPALDO = 'factura de prueba'

export async function obtenerEstadoGlobal() {
  const supabase = createAdminClient()

  const [{ data: facturas, error: errorFacturas }, { data: movimientos, error: errorMovimientos }] =
    await Promise.all([
      supabase
        .from('facturas')
        .select(
          `
          id, numero_factura, fecha_emision, importe_total,
          estado_lectura, estado_conciliacion, estado_gestor,
          drive_web_view_link,
          proveedores(nombre, cif_nif)
        `
        )
        .eq('activo', true)
        .order('fecha_emision', { ascending: false, nullsFirst: false }),
      supabase
        .from('movimientos_bancarios')
        .select('id, fecha, concepto, importe, sentido, estado')
        .eq('activo', true)
        .order('fecha', { ascending: false }),
    ])

  if (errorFacturas) throw new SkillToolError('DB_ERROR', errorFacturas.message)
  if (errorMovimientos) throw new SkillToolError('DB_ERROR', errorMovimientos.message)

  const resumen = {
    facturas_total: facturas?.length ?? 0,
    facturas_sin_leer:
      facturas?.filter((f) => ['PENDIENTE', 'LECTURA_PENDIENTE', 'ERROR_LECTURA'].includes(f.estado_lectura ?? ''))
        .length ?? 0,
    facturas_pendientes_revision: facturas?.filter((f) => f.estado_lectura === 'REVISION_MANUAL').length ?? 0,
    facturas_sin_conciliar: facturas?.filter((f) => f.estado_conciliacion === 'NO_CONCILIADA').length ?? 0,
    facturas_pendientes_gestoria: facturas?.filter((f) => f.estado_gestor === 'PENDIENTE_ENVIAR').length ?? 0,
    movimientos_total: movimientos?.length ?? 0,
    movimientos_sin_justificar: movimientos?.filter((m) => m.estado === 'PENDIENTE_JUSTIFICAR').length ?? 0,
    movimientos_con_incidencia: movimientos?.filter((m) => m.estado === 'INCIDENCIA').length ?? 0,
  }

  return { resumen, facturas: facturas ?? [], movimientos: movimientos ?? [] }
}

export async function obtenerPropuestasPendientes() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('conciliaciones')
    .select(
      `id, confianza, diferencia, metodo, notas_revision,
       facturas ( id, numero_factura, importe_total, fecha_emision, proveedores ( nombre ) ),
       movimientos_bancarios ( id, fecha, concepto, importe )`
    )
    .eq('estado', 'PROPUESTA')
    .order('confianza', { ascending: false })

  if (error) throw new SkillToolError('DB_ERROR', error.message)
  return { propuestas: data ?? [] }
}

export async function ejecutarConciliacionGlobal() {
  const supabase = createAdminClient()
  const { data: centro, error } = await supabase
    .from('centros')
    .select('id')
    .eq('nombre', 'Podología y Biomecánica Rivas')
    .single()

  if (error || !centro) throw new SkillToolError('CENTRO_NO_RESUELTO', 'No se encuentra el centro')
  return await ejecutarMatching(centro.id)
}

export async function obtenerTextoFactura(facturaId: string) {
  const supabase = createAdminClient()
  const { data: factura, error } = await supabase
    .from('facturas')
    .select('id, drive_file_id, numero_factura, drive_web_view_link')
    .eq('id', facturaId)
    .single()

  if (error || !factura) throw new SkillToolError('NOT_FOUND', 'Factura no encontrada', 404)

  let texto: string | null
  try {
    const pdfBuffer = await descargarPdf(factura.drive_file_id)
    texto = await extraerTextoDelPdf(pdfBuffer)
  } catch (err) {
    throw new SkillToolError(
      'PDF_ERROR',
      err instanceof Error ? err.message : 'Error descargando o leyendo el PDF',
      502
    )
  }

  if (!texto) {
    throw new SkillToolError(
      'SIN_TEXTO',
      'El PDF no contiene texto suficiente (probablemente un escaneo); requiere revisión manual',
      422
    )
  }

  if (texto.toLowerCase().includes(MARCA_RESPALDO)) {
    throw new SkillToolError(
      'RESPALDO_DETECTADO',
      'No se pudo leer el PDF real desde Drive y el sistema devolvió un documento de prueba en su lugar. No es la factura real: revisar la conexión con Drive.',
      502
    )
  }

  return {
    facturaId: factura.id,
    numeroFacturaConocido: factura.numero_factura,
    driveWebViewLink: factura.drive_web_view_link,
    texto,
  }
}

const CAMPOS_NUMERICOS = ['base_imponible', 'iva', 'total'] as const
const CAMPOS_TEXTO = [
  'numero_factura',
  'fecha_emision',
  'fecha_vencimiento',
  'nif_cif_proveedor',
  'nombre_proveedor',
  'tipo_iva',
  'concepto',
  'moneda',
  'iban',
] as const

export async function guardarLecturaFactura(facturaId: string, body: Record<string, unknown>) {
  const supabase = createAdminClient()
  const { data: factura, error } = await supabase.from('facturas').select('id').eq('id', facturaId).single()
  if (error || !factura) throw new SkillToolError('NOT_FOUND', 'Factura no encontrada', 404)

  const datos: Record<string, unknown> = {}
  for (const campo of CAMPOS_TEXTO) {
    if (typeof body[campo] === 'string' && body[campo]) datos[campo] = body[campo]
  }
  for (const campo of CAMPOS_NUMERICOS) {
    if (typeof body[campo] === 'number') datos[campo] = body[campo]
  }

  if (Object.keys(datos).length === 0) {
    throw new SkillToolError('INVALID_INPUT', 'No se ha enviado ningún dato reconocible de la factura', 400)
  }

  return await aplicarDatosExtraccion(facturaId, datos, null, 'skill')
}

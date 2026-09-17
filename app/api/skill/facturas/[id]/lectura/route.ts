/**
 * POST /api/skill/facturas/[id]/lectura
 *
 * La Skill llama aquí con los datos que Claude ha extraído leyendo el texto
 * de una factura (obtenido antes vía GET /api/skill/facturas/[id]/texto).
 * ClinicOS valida esos datos y los aplica con las mismas reglas que usa la
 * ruta automática interna (aplicarDatosExtraccion): sin lógica de negocio
 * nueva, solo un origen distinto de los datos.
 *
 * Body esperado (todos los campos opcionales salvo que se indique):
 * {
 *   numero_factura, fecha_emision, fecha_vencimiento,
 *   nif_cif_proveedor, nombre_proveedor,
 *   base_imponible, iva, total, tipo_iva, concepto, moneda, iban
 * }
 *
 * Autenticación: cabecera "Authorization: Bearer <SKILL_API_KEY>".
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verificarAuthSkill } from '@/lib/skill-auth'
import { aplicarDatosExtraccion } from '@/lib/services/facturas-lectura'

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verificarAuthSkill(request)) {
    return NextResponse.json({ error: 'No autorizado', code: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const { id: facturaId } = await params
  const supabase = createAdminClient()

  const { data: factura, error: errorFactura } = await supabase
    .from('facturas')
    .select('id')
    .eq('id', facturaId)
    .single()

  if (errorFactura || !factura) {
    return NextResponse.json({ error: 'Factura no encontrada', code: 'NOT_FOUND' }, { status: 404 })
  }

  let bodyRaw: unknown
  try {
    bodyRaw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido', code: 'INVALID_JSON' }, { status: 400 })
  }
  const body = bodyRaw as Record<string, unknown>

  const datos: Record<string, unknown> = {}
  for (const campo of CAMPOS_TEXTO) {
    if (typeof body[campo] === 'string' && body[campo]) datos[campo] = body[campo]
  }
  for (const campo of CAMPOS_NUMERICOS) {
    if (typeof body[campo] === 'number') datos[campo] = body[campo]
  }

  if (Object.keys(datos).length === 0) {
    return NextResponse.json(
      { error: 'No se ha enviado ningún dato reconocible de la factura', code: 'INVALID_INPUT' },
      { status: 400 }
    )
  }

  try {
    const resultado = await aplicarDatosExtraccion(facturaId, datos, null, 'skill')
    return NextResponse.json(resultado)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error aplicando la lectura', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

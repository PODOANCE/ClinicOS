/**
 * POST /api/skill/facturas/[id]/lectura
 *
 * La Skill llama aquí con los datos que Claude ha extraído leyendo el texto
 * de una factura (obtenido antes vía GET /api/skill/facturas/[id]/texto).
 * ClinicOS valida y aplica esos datos con las mismas reglas que la ruta
 * automática interna. Lógica en lib/services/skill-tools.ts, compartida
 * con el servidor MCP.
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
import { verificarAuthSkill } from '@/lib/skill-auth'
import { guardarLecturaFactura, SkillToolError } from '@/lib/services/skill-tools'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verificarAuthSkill(request)) {
    return NextResponse.json({ error: 'No autorizado', code: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const { id: facturaId } = await params

  let bodyRaw: unknown
  try {
    bodyRaw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido', code: 'INVALID_JSON' }, { status: 400 })
  }

  try {
    return NextResponse.json(await guardarLecturaFactura(facturaId, bodyRaw as Record<string, unknown>))
  } catch (err) {
    if (err instanceof SkillToolError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error desconocido', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

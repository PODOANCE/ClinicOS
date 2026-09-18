/**
 * GET /api/skill/facturas/[id]/texto
 *
 * Descarga el PDF de una factura desde Drive y devuelve su texto, para que
 * la Skill se lo pase a Claude y lo lea sin necesitar acceso directo a
 * Drive. No hace ninguna extracción de datos aquí: solo texto plano.
 * Lógica en lib/services/skill-tools.ts, compartida con el servidor MCP.
 *
 * Autenticación: cabecera "Authorization: Bearer <SKILL_API_KEY>".
 */

import { NextRequest, NextResponse } from 'next/server'
import { verificarAuthSkill } from '@/lib/skill-auth'
import { obtenerTextoFactura, SkillToolError } from '@/lib/services/skill-tools'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verificarAuthSkill(request)) {
    return NextResponse.json({ error: 'No autorizado', code: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const { id: facturaId } = await params

  try {
    return NextResponse.json(await obtenerTextoFactura(facturaId))
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

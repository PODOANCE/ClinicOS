/**
 * GET /api/skill/conciliacion/propuestas
 *
 * Lista las propuestas de conciliación pendientes de revisar (estado
 * PROPUESTA), la misma cola que ve un humano en /conciliacion. Lógica en
 * lib/services/skill-tools.ts, compartida con el servidor MCP.
 *
 * Autenticación: cabecera "Authorization: Bearer <SKILL_API_KEY>".
 */

import { NextRequest, NextResponse } from 'next/server'
import { verificarAuthSkill } from '@/lib/skill-auth'
import { obtenerPropuestasPendientes, SkillToolError } from '@/lib/services/skill-tools'

export async function GET(request: NextRequest) {
  if (!verificarAuthSkill(request)) {
    return NextResponse.json({ error: 'No autorizado', code: 'UNAUTHENTICATED' }, { status: 401 })
  }

  try {
    return NextResponse.json(await obtenerPropuestasPendientes())
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

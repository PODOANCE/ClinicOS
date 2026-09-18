/**
 * POST /api/skill/conciliacion/ejecutar
 *
 * Ejecuta el motor de matching determinista sobre todas las facturas y
 * movimientos pendientes. Solo genera propuestas (estado PROPUESTA);
 * aceptarlas o rechazarlas sigue siendo una acción humana dentro de
 * ClinicOS. Lógica en lib/services/skill-tools.ts, compartida con el
 * servidor MCP.
 *
 * Autenticación: cabecera "Authorization: Bearer <SKILL_API_KEY>".
 */

import { NextRequest, NextResponse } from 'next/server'
import { verificarAuthSkill } from '@/lib/skill-auth'
import { ejecutarConciliacionGlobal, SkillToolError } from '@/lib/services/skill-tools'

export async function POST(request: NextRequest) {
  if (!verificarAuthSkill(request)) {
    return NextResponse.json({ error: 'No autorizado', code: 'UNAUTHENTICATED' }, { status: 401 })
  }

  try {
    return NextResponse.json(await ejecutarConciliacionGlobal())
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

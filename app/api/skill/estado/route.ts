/**
 * GET /api/skill/estado
 *
 * Endpoint de solo lectura pensado para que la Skill (Claude, desde fuera de
 * ClinicOS) obtenga de un vistazo el estado completo de Facturas +
 * Conciliación. La lógica real vive en lib/services/skill-tools.ts,
 * compartida con el servidor MCP en /api/[transport].
 *
 * Autenticación: cabecera "Authorization: Bearer <SKILL_API_KEY>", no sesión
 * de usuario — quien llama aquí no es una persona con permisos de roles.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verificarAuthSkill } from '@/lib/skill-auth'
import { obtenerEstadoGlobal, SkillToolError } from '@/lib/services/skill-tools'

export async function GET(request: NextRequest) {
  if (!verificarAuthSkill(request)) {
    return NextResponse.json({ error: 'No autorizado', code: 'UNAUTHENTICATED' }, { status: 401 })
  }

  try {
    return NextResponse.json(await obtenerEstadoGlobal())
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

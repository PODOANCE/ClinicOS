/**
 * POST /api/skill/conciliacion/ejecutar
 *
 * Versión para la Skill de /api/conciliacion/ejecutar: ejecuta el mismo
 * motor de matching determinista, sin sesión de usuario. Como solo hay un
 * centro en ClinicOS por ahora, se resuelve directamente por nombre.
 *
 * No decide nada por su cuenta más allá de lo que ya hace el motor: solo
 * genera propuestas (estado PROPUESTA). Aceptarlas o rechazarlas sigue
 * siendo una acción humana dentro de ClinicOS.
 *
 * Autenticación: cabecera "Authorization: Bearer <SKILL_API_KEY>".
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verificarAuthSkill } from '@/lib/skill-auth'
import { ejecutarMatching } from '@/lib/services/conciliacion'

export async function POST(request: NextRequest) {
  if (!verificarAuthSkill(request)) {
    return NextResponse.json({ error: 'No autorizado', code: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: centro, error } = await supabase
    .from('centros')
    .select('id')
    .eq('nombre', 'Podología y Biomecánica Rivas')
    .single()

  if (error || !centro) {
    return NextResponse.json({ error: 'No se encuentra el centro', code: 'CENTRO_NO_RESUELTO' }, { status: 500 })
  }

  try {
    const resumen = await ejecutarMatching(centro.id)
    return NextResponse.json(resumen)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error ejecutando la conciliación', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/conciliacion/ejecutar
 *
 * Ejecuta el motor de matching sobre todas las facturas y movimientos
 * bancarios pendientes del centro del usuario, en una única llamada.
 * Pensado para que un futuro cliente (Skill u otro) nunca tenga que invocar
 * esto factura a factura: entra una petición, sale un resumen agregado.
 *
 * Response:
 * {
 *   "facturas_evaluadas": number,
 *   "propuestas_creadas": number,
 *   "sin_candidato": number,
 *   "movimientos_evaluados": number
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/supabase/auth-helpers'
import { puedeEditarFactura } from '@/lib/supabase/autorizar'
import { ejecutarMatching } from '@/lib/services/conciliacion'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado', code: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const { permitido, razon } = await puedeEditarFactura(user.id, supabase)
    if (!permitido) {
      return NextResponse.json(
        { error: razon || 'Sin permisos para conciliar', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('centro_id')
      .eq('id', user.id)
      .single()

    if (usuarioError || !usuario?.centro_id) {
      return NextResponse.json(
        { error: 'No se pudo determinar el centro del usuario', code: 'CENTRO_NO_RESUELTO' },
        { status: 400 }
      )
    }

    const resumen = await ejecutarMatching(usuario.centro_id)

    return NextResponse.json(resumen)
  } catch (error) {
    console.error('Error en POST /api/conciliacion/ejecutar:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

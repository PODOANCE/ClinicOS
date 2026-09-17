/**
 * GET /api/skill/conciliacion/propuestas
 *
 * Lista las propuestas de conciliación pendientes de revisar (estado
 * PROPUESTA), la misma cola que ve un humano en /conciliacion, para que la
 * Skill se la pueda leer a Claude y contar qué queda por decidir.
 *
 * Autenticación: cabecera "Authorization: Bearer <SKILL_API_KEY>".
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verificarAuthSkill } from '@/lib/skill-auth'

export async function GET(request: NextRequest) {
  if (!verificarAuthSkill(request)) {
    return NextResponse.json({ error: 'No autorizado', code: 'UNAUTHENTICATED' }, { status: 401 })
  }

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

  if (error) {
    return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ propuestas: data ?? [] })
}

/**
 * GET /api/skill/estado
 *
 * Endpoint de solo lectura pensado para que la Skill (Claude, desde fuera de
 * ClinicOS) obtenga de un vistazo el estado completo de Facturas +
 * Conciliación: qué facturas hay, cuáles están leídas, cuáles conciliadas,
 * cuáles enviadas a gestoría, qué movimientos bancarios hay y cuáles se
 * quedan sin factura asociada.
 *
 * No hace ningún cálculo nuevo: es una fotografía de las columnas de estado
 * que ya mantiene el resto de la aplicación (estado_lectura,
 * estado_conciliacion, estado_gestor, conciliaciones ACEPTADAs).
 *
 * Autenticación: cabecera "Authorization: Bearer <SKILL_API_KEY>", no sesión
 * de usuario — quien llama aquí no es una persona con permisos de roles.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verificarAuthSkill } from '@/lib/skill-auth'

export async function GET(request: NextRequest) {
  if (!verificarAuthSkill(request)) {
    return NextResponse.json({ error: 'No autorizado', code: 'UNAUTHENTICATED' }, { status: 401 })
  }

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

  if (errorFacturas) {
    return NextResponse.json({ error: errorFacturas.message, code: 'DB_ERROR' }, { status: 500 })
  }
  if (errorMovimientos) {
    return NextResponse.json({ error: errorMovimientos.message, code: 'DB_ERROR' }, { status: 500 })
  }

  const resumen = {
    facturas_total: facturas?.length ?? 0,
    facturas_sin_leer: facturas?.filter((f) =>
      ['PENDIENTE', 'LECTURA_PENDIENTE', 'ERROR_LECTURA'].includes(f.estado_lectura ?? '')
    ).length ?? 0,
    facturas_pendientes_revision: facturas?.filter((f) => f.estado_lectura === 'REVISION_MANUAL')
      .length ?? 0,
    facturas_sin_conciliar: facturas?.filter((f) => f.estado_conciliacion === 'NO_CONCILIADA')
      .length ?? 0,
    facturas_pendientes_gestoria: facturas?.filter((f) => f.estado_gestor === 'PENDIENTE_ENVIAR')
      .length ?? 0,
    movimientos_total: movimientos?.length ?? 0,
    movimientos_sin_justificar: movimientos?.filter((m) => m.estado === 'PENDIENTE_JUSTIFICAR')
      .length ?? 0,
    movimientos_con_incidencia: movimientos?.filter((m) => m.estado === 'INCIDENCIA').length ?? 0,
  }

  return NextResponse.json({ resumen, facturas: facturas ?? [], movimientos: movimientos ?? [] })
}

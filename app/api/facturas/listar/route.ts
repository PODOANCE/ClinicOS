/**
 * GET /api/facturas/listar
 *
 * Lista todas las facturas con datos relacionados
 * Query params:
 * - estado: filtrar por estado_lectura
 * - proveedor_id: filtrar por proveedor
 * - limit: registros por página (default: 50)
 * - offset: desplazamiento (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const estado = searchParams.get('estado')
    const proveedorId = searchParams.get('proveedor_id')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = createAdminClient()

    let query = supabase
      .from('facturas')
      .select(
        `
        id,
        numero_factura,
        fecha_emision,
        importe_base,
        importe_iva,
        importe_total,
        estado_lectura,
        estado_conciliacion,
        estado_gestor,
        proveedor_id,
        proveedores(id, nombre, cif_nif),
        created_at,
        updated_at
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })

    // Aplicar filtros
    if (estado) {
      query = query.eq('estado_lectura', estado)
    }
    if (proveedorId) {
      query = query.eq('proveedor_id', proveedorId)
    }

    // Paginación
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      facturas: data || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/facturas/[id]
 *
 * Obtiene detalle completo de una factura incluyendo:
 * - Datos de factura
 * - Relación con proveedor
 * - Datos de extracción IA
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: facturaId } = await params

    const supabase = createAdminClient()

    // Obtener factura con relación proveedores
    const { data: factura, error: facturaError } = await supabase
      .from('facturas')
      .select(
        `
        id,
        numero_factura,
        fecha_emision,
        fecha_vencimiento,
        importe_base,
        importe_iva,
        importe_total,
        estado_lectura,
        estado_conciliacion,
        estado_gestor,
        proveedor_id,
        drive_file_id,
        hash_pdf,
        proveedores(id, nombre, cif_nif),
        created_at,
        updated_at
      `
      )
      .eq('id', facturaId)
      .single()

    if (facturaError) {
      if (facturaError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
      }
      throw facturaError
    }

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    // Obtener extracción IA si existe
    const { data: extraccion } = await supabase
      .from('facturas_extraccion_ia')
      .select('respuesta_json, datos_validados, errores_validacion, created_at, updated_at')
      .eq('factura_id', facturaId)
      .maybeSingle()

    return NextResponse.json({
      factura,
      extraccion: extraccion || null,
    })
  } catch (error) {
    console.error('Error fetching factura detail:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

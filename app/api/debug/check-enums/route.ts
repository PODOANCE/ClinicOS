import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createAdminClient()

    // 1. Verificar si hay facturas registradas
    const { data: facturas, error: facturasError } = await supabase
      .from('facturas')
      .select('id, numero_factura, estado_lectura, estado_conciliacion, estado_gestor')
      .limit(5)

    if (facturasError) {
      return NextResponse.json({ error: facturasError }, { status: 500 })
    }

    // 2. Ejecutar SQL directo para obtener valores del enum
    const { data: enumData, error: enumError } = await supabase.rpc(
      'get_enum_values',
      { enum_name: 'estado_lectura' }
    )

    // Si la RPC no existe, intentar query SQL directo
    if (enumError) {
      return NextResponse.json({
        facturas,
        message: 'RPC get_enum_values no existe, pero datos de facturas listos',
        enumError: enumError.message,
      })
    }

    return NextResponse.json({
      facturas,
      enumValues: enumData,
      success: true,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

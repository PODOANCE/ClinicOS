import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('facturas')
      .select('id, drive_file_id, numero_factura, estado_lectura, proveedor_id')
      .limit(10)

    return NextResponse.json({ facturas: data || [], total: data?.length || 0 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    )
  }
}

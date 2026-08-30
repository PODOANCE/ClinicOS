import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('proveedores')
      .insert({
        nombre: 'Proveedor Prueba',
        email: 'prueba@test.local',
        centro_id: '12345678-1234-5678-1234-567812345678',
      })
      .select('id, nombre')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      exitoso: true,
      proveedor: data,
      mensaje: `Ahora usa este proveedor_id: ${data.id}`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    )
  }
}

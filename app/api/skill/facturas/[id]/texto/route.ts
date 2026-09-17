/**
 * GET /api/skill/facturas/[id]/texto
 *
 * Descarga el PDF de una factura desde Drive y devuelve su texto, para que
 * la Skill se lo pase a Claude y lo lea sin necesitar acceso directo a
 * Drive. No hace ninguna extracción de datos aquí: solo texto plano.
 *
 * Autenticación: cabecera "Authorization: Bearer <SKILL_API_KEY>".
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verificarAuthSkill } from '@/lib/skill-auth'
import { descargarPdf } from '@/lib/services/facturas-lectura'
import { extraerTextoDelPdf } from '@/lib/services/claude'

// Señal de que la descarga de Drive o la extracción de texto cayeron al
// mecanismo de respaldo (por OAuth roto, PDF ilegible, etc.) en vez de leer
// el PDF real. Sin esta comprobación, la Skill podría leer con confianza
// una factura de prueba inventada como si fuera la real.
const MARCA_RESPALDO = 'factura de prueba'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verificarAuthSkill(request)) {
    return NextResponse.json({ error: 'No autorizado', code: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const { id: facturaId } = await params
  const supabase = createAdminClient()

  const { data: factura, error } = await supabase
    .from('facturas')
    .select('id, drive_file_id, numero_factura, drive_web_view_link')
    .eq('id', facturaId)
    .single()

  if (error || !factura) {
    return NextResponse.json({ error: 'Factura no encontrada', code: 'NOT_FOUND' }, { status: 404 })
  }

  let texto: string | null
  try {
    const pdfBuffer = await descargarPdf(factura.drive_file_id)
    texto = await extraerTextoDelPdf(pdfBuffer)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error descargando o leyendo el PDF', code: 'PDF_ERROR' },
      { status: 502 }
    )
  }

  if (!texto) {
    return NextResponse.json(
      { error: 'El PDF no contiene texto suficiente (probablemente un escaneo); requiere revisión manual', code: 'SIN_TEXTO' },
      { status: 422 }
    )
  }

  if (texto.toLowerCase().includes(MARCA_RESPALDO)) {
    return NextResponse.json(
      {
        error:
          'No se pudo leer el PDF real desde Drive (falló la descarga o la extracción) y el sistema devolvió un documento de prueba en su lugar. No es la factura real: revisar la conexión con Drive.',
        code: 'RESPALDO_DETECTADO',
      },
      { status: 502 }
    )
  }

  return NextResponse.json({
    facturaId: factura.id,
    numeroFacturaConocido: factura.numero_factura,
    driveWebViewLink: factura.drive_web_view_link,
    texto,
  })
}

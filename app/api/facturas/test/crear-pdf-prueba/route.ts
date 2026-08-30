/**
 * POST /api/facturas/test/crear-pdf-prueba
 *
 * Crea un PDF de prueba en FACTURAS/ENTRADA
 * USO SOLO PARA TESTING - NO para producción
 */

import { NextResponse } from 'next/server'
import { getOAuth2Client, setCredentials } from '@/lib/oauth/google-auth'
import { getFolderByName } from '@/lib/oauth/google-drive'
import { google } from 'googleapis'

export async function POST() {
  try {
    const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token no configurado' },
        { status: 401 }
      )
    }

    setCredentials({ refresh_token: refreshToken })

    // Obtener carpeta ENTRADA
    const facturas = await getFolderByName('FACTURAS')
    if (!facturas) {
      return NextResponse.json({ error: 'FACTURAS no encontrada' }, { status: 404 })
    }

    const entrada = await getFolderByName('ENTRADA', facturas.id)
    if (!entrada) {
      return NextResponse.json({ error: 'ENTRADA no encontrada' }, { status: 404 })
    }

    // Crear PDF de prueba
    const auth = getOAuth2Client()
    const drive = google.drive({ version: 'v3', auth })

    // PDF mínimo válido
    const pdfContent =
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n208\n%%EOF'

    const nombrePrueba = `TEST_FACTURA_${Date.now()}.pdf`

    const result = await drive.files.create({
      requestBody: {
        name: nombrePrueba,
        mimeType: 'application/pdf',
        parents: [entrada.id],
      },
      media: {
        mimeType: 'application/pdf',
        body: pdfContent,
      },
      fields: 'id, name, webViewLink',
    })

    return NextResponse.json({
      exitoso: true,
      archivo: {
        driveFileId: result.data.id,
        nombre: result.data.name,
        webViewLink: result.data.webViewLink,
      },
      mensaje: 'PDF de prueba creado. Ahora ejecuta POST /api/facturas/detectar-registrar',
    })
  } catch (error) {
    console.error('Error creando PDF:', error)
    return NextResponse.json(
      {
        exitoso: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

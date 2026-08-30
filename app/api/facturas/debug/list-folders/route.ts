/**
 * DEBUG: Lista todas las carpetas dentro de FACTURAS
 */

import { NextResponse } from 'next/server'
import { setCredentials } from '@/lib/oauth/google-auth'
import { getFolderByName, listFolderContents } from '@/lib/oauth/google-drive'

export async function GET() {
  try {
    const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token no configurado' },
        { status: 401 }
      )
    }

    setCredentials({ refresh_token: refreshToken })

    // Obtener carpeta FACTURAS
    const facturas = await getFolderByName('FACTURAS')
    if (!facturas) {
      return NextResponse.json({
        error: 'Carpeta FACTURAS no encontrada',
      })
    }

    // Listar contenido de FACTURAS
    const contenido = await listFolderContents(facturas.id)

    return NextResponse.json({
      exitoso: true,
      carpetaFacturas: {
        id: facturas.id,
        nombre: facturas.name,
        webViewLink: facturas.webViewLink,
      },
      contenidoFacturas: contenido.map((item: any) => ({
        id: item.id,
        nombre: item.name,
        tipo: item.mimeType,
        esFolder: item.mimeType === 'application/vnd.google-apps.folder',
        webViewLink: item.webViewLink,
      })),
      total: contenido.length,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      {
        exitoso: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

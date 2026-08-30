/**
 * GET /api/facturas/entrada/list
 *
 * Lista todos los PDFs en FACTURAS/ENTRADA desde Google Drive
 * Retorna metadata completa para cada archivo
 *
 * Query params:
 * - pageToken: Token de paginación (para continuar un listado anterior)
 *
 * Response:
 * {
 *   exitoso: boolean
 *   error?: string
 *   archivos: [
 *     {
 *       drive_file_id: string
 *       nombre: string
 *       mimeType: string
 *       tamaño: number | null
 *       modifiedTime: string | null
 *       createdTime: string | null
 *       webViewLink: string | null
 *     }
 *   ]
 *   totalArchivos: number
 *   nextPageToken?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { listarPDFsEnEntrada } from '@/lib/services/facturas-drive'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const pageToken = searchParams.get('pageToken') || undefined

    const resultado = await listarPDFsEnEntrada(pageToken)

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('Error en GET /api/facturas/entrada/list:', error)
    return NextResponse.json(
      {
        exitoso: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        archivos: [],
        totalArchivos: 0,
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/facturas/detectar-registrar
 *
 * Detecta PDFs nuevos en FACTURAS/ENTRADA y los registra en Supabase
 * Flujo: Listar → Comprobar drive_file_id → Registrar si no existe
 *
 * Query params (opcional):
 * - centro_id: UUID del centro (default: PODOANCE SL)
 *
 * Response:
 * {
 *   exitoso: boolean
 *   error?: string
 *   facturasDetectadas: number
 *   facturasNuevas: number
 *   facturasExistentes: number
 *   detalles: [
 *     {
 *       driveFileId: string
 *       nombre: string
 *       creado: boolean
 *       facturaId?: string
 *     }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { detectarYRegistrarFacturasNuevasConProveedor } from '@/lib/services/facturas-drive'

// Centro por defecto: PODOANCE SL
const CENTRO_ID_DEFECTO = '12345678-1234-5678-1234-567812345678'
// Proveedor por defecto (será requerido en B.2)
const PROVEEDOR_ID_DEFECTO = 'a0000000-0000-0000-0000-000000000000'

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const centroId = searchParams.get('centro_id') || CENTRO_ID_DEFECTO
    const proveedorId = searchParams.get('proveedor_id') || PROVEEDOR_ID_DEFECTO

    const resultado = await detectarYRegistrarFacturasNuevasConProveedor(
      centroId,
      proveedorId
    )

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('Error en POST /api/facturas/detectar-registrar:', error)
    return NextResponse.json(
      {
        exitoso: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        facturasDetectadas: 0,
        facturasNuevas: 0,
        facturasExistentes: 0,
      },
      { status: 500 }
    )
  }
}

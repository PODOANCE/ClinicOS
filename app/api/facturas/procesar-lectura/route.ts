/**
 * POST /api/facturas/procesar-lectura
 *
 * Procesa una factura: descarga PDF, extrae datos con Claude, valida y guarda
 * Implementa B.3.1 → B.3.4 en una única petición
 *
 * Request body:
 * {
 *   "facturaId": "uuid"
 * }
 *
 * Response:
 * {
 *   "exitoso": boolean,
 *   "facturaId": "uuid",
 *   "estado": "VALIDACION_EXITOSA" | "REVISION_MANUAL" | "ERROR_LECTURA",
 *   "datos"?: { ... },
 *   "errores"?: [ { campo, mensaje } ],
 *   "error"?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { procesarFactura } from '@/lib/services/facturas-lectura'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { facturaId } = body

    if (!facturaId) {
      return NextResponse.json(
        { error: 'facturaId requerido' },
        { status: 400 }
      )
    }

    const resultado = await procesarFactura(facturaId)

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('Error en POST /api/facturas/procesar-lectura:', error)
    return NextResponse.json(
      {
        exitoso: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

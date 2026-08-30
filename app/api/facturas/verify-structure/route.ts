/**
 * GET /api/facturas/verify-structure
 *
 * Verifica que la estructura de carpetas FACTURAS existe en Drive
 * Valida que FACTURAS y FACTURAS/ENTRADA existen
 */

import { NextResponse } from 'next/server'
import { verificarEstructuraFacturas } from '@/lib/services/facturas-drive'

export async function GET() {
  try {
    const resultado = await verificarEstructuraFacturas()
    return NextResponse.json(resultado)
  } catch (error) {
    console.error('Error en GET /api/facturas/verify-structure:', error)
    return NextResponse.json(
      {
        exitoso: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/facturas/migraciones/permitir-proveedor-null
 *
 * Migración B.2: Permite NULL en proveedor_id
 * Esto es temporal - se asignará con IA en B.3
 *
 * Ejecutar una sola vez
 */

import { NextResponse } from 'next/server'

const SQL = `
ALTER TABLE facturas ALTER COLUMN proveedor_id DROP NOT NULL;
`;

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase vars not configured' },
        { status: 500 }
      )
    }

    // Nota: Esta función NO ejecuta SQL directamente
    // El usuario debe copiar y ejecutar el SQL en Supabase SQL Editor

    return NextResponse.json({
      exitoso: false,
      mensaje: 'B.2 Migration: Permitir NULL en proveedor_id',
      instrucciones: [
        '1. Ve a Supabase SQL Editor',
        '2. Ejecuta este SQL:',
        SQL,
        '3. Vuelve a ejecutar POST /api/facturas/detectar-registrar',
      ],
      sql: SQL,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    )
  }
}

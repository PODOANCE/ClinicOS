/**
 * POST /api/facturas/[id]/aplicar-extraccion/[extraccionId]
 *
 * Aplica una extracción existente a una factura, actualizando facturas.extraccion_ia_id.
 *
 * ARQUITECTURA:
 * - Autorización: usuario con permiso de edición
 * - Validación: expected_updated_at (optimistic locking)
 * - RPC: aplicar_extraccion_ia (transaccional, FOR UPDATE, auditoría)
 * - NO puede aplicar si factura está APROBADA_MANUALMENTE
 * - NO puede aplicar extracción de otra factura
 * - NO puede aplicar una extracción ya aplicada
 *
 * GARANTÍAS:
 * - Atomicidad: UPDATE + INSERT(historial) en una transacción
 * - Concurrencia: FOR UPDATE + expected_updated_at validation
 * - Auditoría: registrada dentro de la transacción RPC
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/supabase/auth-helpers'
import { puedeEditarFactura } from '@/lib/supabase/autorizar'

export async function POST(
  request: NextRequest,
  {
    params
  }: {
    params: Promise<{ id: string }>
  }
) {
  try {
    const { id: facturaId } = await params
    const url = new URL(request.url)
    const extraccionId = url.pathname.split('/').pop()

    if (!extraccionId || extraccionId === '[extraccionId]') {
      return NextResponse.json(
        { error: 'ID de extracción inválido', code: 'INVALID_EXTRACTION_ID' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // ====================================================================
    // 1. AUTENTICACIÓN Y AUTORIZACIÓN
    // ====================================================================
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado', code: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    // ====================================================================
    // 2. AUTORIZACIÓN: Verificar que tiene permisos de edición
    // ====================================================================
    const { permitido, razon } = await puedeEditarFactura(user.id, supabase)
    if (!permitido) {
      return NextResponse.json(
        { error: razon || 'Sin permisos para editar facturas', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // ====================================================================
    // 2. PARSEAR Y VALIDAR BODY
    // ====================================================================
    let bodyRaw: unknown
    try {
      bodyRaw = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Body JSON inválido', code: 'INVALID_JSON' },
        { status: 400 }
      )
    }

    const body = bodyRaw as Record<string, unknown>
    const expectedUpdatedAt = body.expected_updated_at as string | undefined

    if (!expectedUpdatedAt) {
      return NextResponse.json(
        {
          error: 'expected_updated_at requerido en body',
          code: 'MISSING_EXPECTED_UPDATED_AT'
        },
        { status: 400 }
      )
    }

    // ====================================================================
    // 3. VALIDAR QUE EXTRACCIÓN EXISTE Y PERTENECE A ESTA FACTURA
    // ====================================================================
    const { data: extraccion, error: extraccionError } = await supabase
      .from('facturas_extraccion_ia')
      .select('id, factura_id')
      .eq('id', extraccionId)
      .single()

    if (extraccionError || !extraccion) {
      return NextResponse.json(
        { error: 'Extracción no encontrada', code: 'EXTRACTION_NOT_FOUND' },
        { status: 404 }
      )
    }

    if (extraccion.factura_id !== facturaId) {
      return NextResponse.json(
        {
          error: 'La extracción no pertenece a esta factura',
          code: 'EXTRACTION_BELONGS_TO_DIFFERENT_INVOICE'
        },
        { status: 404 }
      )
    }

    // ====================================================================
    // 4. LLAMAR RPC TRANSACCIONAL
    // ====================================================================
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'aplicar_extraccion_ia',
      {
        p_factura_id: facturaId,
        p_extraccion_id: extraccionId,
        p_usuario_id: user.id,
        p_expected_updated_at: new Date(expectedUpdatedAt).toISOString()
      }
    )

    if (rpcError) {
      console.error('[POST aplicar-extraccion] RPC error:', rpcError.message)

      const mensajeRPC = rpcError.message || ''

      // Parsear mensajes de error de la RPC
      if (mensajeRPC.includes('FACTURA_APROBADA')) {
        return NextResponse.json(
          {
            error: 'No se puede editar una factura aprobada',
            code: 'FACTURA_APROBADA'
          },
          { status: 409 }
        )
      }

      if (mensajeRPC.includes('CONFLICTO_CONCURRENCIA')) {
        return NextResponse.json(
          {
            error:
              'Conflicto de concurrencia: factura fue modificada por otro usuario',
            code: 'CONFLICT'
          },
          { status: 409 }
        )
      }

      if (mensajeRPC.includes('FACTURA_NO_ENCONTRADA')) {
        return NextResponse.json(
          { error: 'Factura no encontrada', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }

      if (mensajeRPC.includes('EXTRACCION_NO_EXISTE')) {
        return NextResponse.json(
          { error: 'Extracción no existe', code: 'EXTRACTION_NOT_FOUND' },
          { status: 404 }
        )
      }

      if (mensajeRPC.includes('EXTRACCION_AJENA')) {
        return NextResponse.json(
          {
            error: 'La extracción no pertenece a esta factura',
            code: 'EXTRACTION_BELONGS_TO_DIFFERENT_INVOICE'
          },
          { status: 404 }
        )
      }

      if (mensajeRPC.includes('EXTRACCION_YA_APLICADA')) {
        return NextResponse.json(
          {
            error: 'Esta extracción ya está aplicada',
            code: 'EXTRACTION_ALREADY_APPLIED'
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: mensajeRPC, code: 'RPC_ERROR' },
        { status: 500 }
      )
    }

    if (!rpcResult || rpcResult.length === 0) {
      return NextResponse.json(
        { error: 'Respuesta RPC vacía', code: 'RPC_ERROR' },
        { status: 500 }
      )
    }

    const [resultado] = rpcResult

    if (!resultado.exitoso) {
      return NextResponse.json(
        { error: resultado.mensaje || 'Error en RPC', code: 'RPC_ERROR' },
        { status: 500 }
      )
    }

    // ====================================================================
    // 5. RETORNAR ÉXITO
    // ====================================================================
    return NextResponse.json({
      exitoso: true,
      facturaId: resultado.factura_id,
      extraccionId: resultado.extraccion_id,
      nuevoUpdatedAt: resultado.nuevo_updated_at
    })
  } catch (error) {
    console.error('[POST aplicar-extraccion] Error no esperado:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}


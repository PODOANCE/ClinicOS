/**
 * POST /api/facturas/[id]/liberar-reprocesamiento
 *
 * Libera una operación de reprocesamiento colgada (EN_PROCESO > timeout).
 * Permite que la factura vuelva a poder reprocesarse.
 *
 * ARQUITECTURA:
 * - Autorización: admin solo
 * - Validación: must be EN_PROCESO y > timeout_minutos
 * - RPC: liberar_reprocesamiento_ia (valida + audita)
 * - Auditoría: registrada con motivo y timestamps
 *
 * GARANTÍAS:
 * - No puede liberar operaciones recientes (< 30 minutos)
 * - Auditoría clara de quién liberó y por qué
 * - Factura vuelve a estar disponible para reprocesar
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/supabase/auth-helpers'
import { verificarAdmin } from '@/lib/permissions/admin-helpers'
import { z } from 'zod'

const BodySchema = z.object({
  motivo: z.string().min(1).max(500, 'Motivo máximo 500 caracteres'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: facturaId } = await params

    // ====================================================================
    // 1. AUTENTICACIÓN
    // ====================================================================
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado', code: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    const supabase = createAdminClient()

    // ====================================================================
    // 2. AUTORIZACIÓN (ADMIN ONLY)
    // ====================================================================
    const { esAdmin, error: adminError } = await verificarAdmin(user.id, supabase)
    if (adminError) {
      return NextResponse.json(
        { error: 'No se pudo verificar permisos', code: adminError },
        { status: 500 }
      )
    }
    if (!esAdmin) {
      return NextResponse.json(
        { error: 'Solo admin puede liberar operaciones', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // ====================================================================
    // 3. VALIDAR BODY (MOTIVO REQUERIDO)
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

    let body: z.infer<typeof BodySchema>
    try {
      body = BodySchema.parse(bodyRaw)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.issues.map((issue) => ({
          field: String(issue.path.join('.')),
          message: issue.message,
        }))
        return NextResponse.json(
          { error: 'Validación fallida', code: 'VALIDATION_ERROR', details },
          { status: 400 }
        )
      }
      throw error
    }

    const motivo = body.motivo.trim()

    // ====================================================================
    // 4. VALIDAR QUE FACTURA EXISTE
    // ====================================================================
    const { data: factura, error: facturaError } = await supabase
      .from('facturas')
      .select('id')
      .eq('id', facturaId)
      .single()

    if (facturaError || !factura) {
      return NextResponse.json(
        { error: 'Factura no encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // ====================================================================
    // 5. LLAMAR RPC (TIMEOUT FIJO 30 MINUTOS)
    // ====================================================================
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'liberar_reprocesamiento_ia',
      {
        p_factura_id: facturaId,
        p_usuario_id: user.id,
        p_motivo: motivo,
      }
    )

    if (rpcError) {
      console.error(
        '[POST liberar-reprocesamiento] RPC error:',
        rpcError.message
      )

      const mensajeRPC = rpcError.message || ''

      // Parsear mensajes de error de la RPC
      if (mensajeRPC.includes('SOLO_ADMIN')) {
        return NextResponse.json(
          { error: 'Solo admin puede liberar operaciones', code: 'FORBIDDEN' },
          { status: 403 }
        )
      }

      if (mensajeRPC.includes('NO_OPERACION_ACTIVA')) {
        return NextResponse.json(
          {
            error:
              'No hay operación activa para esta factura, o ya fue completada',
            code: 'NO_ACTIVE_OPERATION'
          },
          { status: 404 }
        )
      }

      if (mensajeRPC.includes('OPERACION_RECIENTE')) {
        return NextResponse.json(
          {
            error: 'La operación es muy reciente. Espera más de 30 minutos antes de liberar',
            code: 'OPERATION_TOO_RECENT'
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
      facturaId,
      mensaje: resultado.mensaje
    })
  } catch (error) {
    console.error('[POST liberar-reprocesamiento] Error no esperado:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

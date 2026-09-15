/**
 * POST /api/stock/movimiento
 *
 * Único endpoint del módulo de Stock. No es una API CRUD: es el adaptador
 * técnico necesario para invocar registrar_movimiento_stock(), que está
 * deliberadamente REVOKEd de anon/authenticated (ver
 * supabase/migrations/20260915200000_stock_movimientos_solo_rpc.sql) y por
 * tanto no es invocable con .rpc() desde el navegador.
 *
 * Todo lo demás (listar, editar, crear, archivar productos/categorías, lista
 * de compra) va directo a Supabase desde el cliente, protegido por RLS.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/supabase/auth-helpers'
import { getUserRoles } from '@/lib/permissions/admin-helpers'
import { canUserAccess } from '@/lib/permissions/validation'

const TIPOS_VALIDOS = ['ENTRADA', 'CONSUMO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'] as const

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado', code: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    const supabase = createAdminClient()

    const roles = await getUserRoles(user.id, supabase)
    if (!canUserAccess(roles, 'Stock', 'editar')) {
      return NextResponse.json(
        { error: 'Sin permisos para registrar movimientos de stock', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Body JSON inválido', code: 'INVALID_JSON' },
        { status: 400 }
      )
    }

    const { producto_id, tipo, cantidad, motivo } = body as Record<string, unknown>

    if (typeof producto_id !== 'string' || !producto_id) {
      return NextResponse.json(
        { error: 'producto_id requerido', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    if (typeof tipo !== 'string' || !TIPOS_VALIDOS.includes(tipo as any)) {
      return NextResponse.json(
        { error: `tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`, code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad <= 0) {
      return NextResponse.json(
        { error: 'cantidad debe ser un entero mayor que cero', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('centro_id')
      .eq('id', user.id)
      .single()

    if (usuarioError || !usuario?.centro_id) {
      return NextResponse.json(
        { error: 'No se pudo determinar el centro del usuario', code: 'CENTRO_NO_RESUELTO' },
        { status: 400 }
      )
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc('registrar_movimiento_stock', {
      p_producto_id: producto_id,
      p_tipo: tipo,
      p_cantidad: cantidad,
      p_usuario_id: user.id,
      p_centro_id: usuario.centro_id,
      p_motivo: typeof motivo === 'string' && motivo.trim() ? motivo.trim() : null,
    })

    if (rpcError) {
      console.error('[POST stock/movimiento] RPC error:', rpcError.message)
      const msg = rpcError.message || ''

      if (msg.includes('MOTIVO_REQUERIDO')) {
        return NextResponse.json(
          { error: 'Los ajustes requieren un motivo', code: 'MOTIVO_REQUERIDO' },
          { status: 400 }
        )
      }
      if (msg.includes('STOCK_INSUFICIENTE')) {
        return NextResponse.json(
          { error: 'Stock insuficiente para esta operación', code: 'STOCK_INSUFICIENTE' },
          { status: 409 }
        )
      }
      if (msg.includes('PRODUCTO_ARCHIVADO')) {
        return NextResponse.json(
          { error: 'El producto está archivado', code: 'PRODUCTO_ARCHIVADO' },
          { status: 409 }
        )
      }
      if (msg.includes('PRODUCTO_NO_ENCONTRADO')) {
        return NextResponse.json(
          { error: 'Producto no encontrado', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }
      if (msg.includes('USUARIO_NO_AUTORIZADO')) {
        return NextResponse.json(
          { error: 'No autorizado', code: 'FORBIDDEN' },
          { status: 403 }
        )
      }

      return NextResponse.json({ error: msg, code: 'RPC_ERROR' }, { status: 500 })
    }

    const resultado = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult

    return NextResponse.json({
      exitoso: true,
      stockAnterior: resultado.stock_anterior,
      stockNuevo: resultado.stock_nuevo,
    })
  } catch (error) {
    console.error('[POST stock/movimiento] Error no esperado:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}

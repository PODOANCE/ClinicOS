/**
 * GET /api/facturas/[id]
 * Obtiene detalle completo de una factura incluyendo datos de extracción IA.
 *
 * PATCH /api/facturas/[id]
 * Edita factura con auditoría atómica.
 *
 * ARQUITECTURA B.4.2 FASE 1 CORREGIDA:
 * - Autenticación via JWT (Bearer token)
 * - Autorización via matriz de permisos (roles.areas_permitidas)
 * - RPC transaccional única (actualizar_factura_con_auditoria)
 * - Atomicidad garantizada por PostgreSQL (ROLLBACK automático si falla)
 * - Snapshots capturados DENTRO de la transacción
 * - Validación Zod de entrada (tipos en runtime)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/supabase/auth-helpers'
import { puedeEditarFactura } from '@/lib/supabase/autorizar'
import { ActualizarFacturaSchema, parsearActualizacion } from '@/lib/schemas/factura'
import { ZodError } from 'zod'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: facturaId } = await params
    const supabase = createAdminClient()

    const { data: factura, error: facturaError } = await supabase
      .from('facturas')
      .select(
        `
        id,
        numero_factura,
        fecha_emision,
        fecha_vencimiento,
        importe_base,
        importe_iva,
        importe_total,
        estado_lectura,
        estado_conciliacion,
        estado_gestor,
        proveedor_id,
        drive_file_id,
        hash_pdf,
        proveedores(id, nombre, cif_nif),
        created_at,
        updated_at
      `
      )
      .eq('id', facturaId)
      .single()

    if (facturaError) {
      if (facturaError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
      }
      throw facturaError
    }

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    const { data: extraccion } = await supabase
      .from('facturas_extraccion_ia')
      .select('respuesta_json, datos_validados, errores_validacion, created_at, updated_at')
      .eq('factura_id', facturaId)
      .maybeSingle()

    return NextResponse.json({
      factura,
      extraccion: extraccion || null,
    })
  } catch (error) {
    console.error('[GET] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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

    // ====================================================================
    // 2. AUTORIZACIÓN
    // ====================================================================
    const supabase = createAdminClient()
    const { permitido, razon } = await puedeEditarFactura(user.id, supabase)

    if (!permitido) {
      return NextResponse.json(
        { error: razon || 'Sin permisos para editar facturas', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // ====================================================================
    // 3. PARSEAR Y VALIDAR INPUT (Zod)
    // ====================================================================
    let bodyRaw: unknown
    try {
      bodyRaw = await request.json()
    } catch (e) {
      return NextResponse.json(
        { error: 'Body JSON inválido', code: 'INVALID_JSON' },
        { status: 400 }
      )
    }

    let body: unknown
    try {
      body = ActualizarFacturaSchema.parse(bodyRaw)
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: String(issue.path.join('.')),
          message: issue.message,
        }))
        return NextResponse.json(
          {
            error: 'Validación fallida',
            code: 'VALIDATION_ERROR',
            details,
          },
          { status: 400 }
        )
      }
      throw error
    }

    // ====================================================================
    // 4. SEPARAR CAMBIOS DE CONTROL DE CONCURRENCIA
    // ====================================================================
    const { cambios, expected_updated_at } = parsearActualizacion(
      body as Parameters<typeof parsearActualizacion>[0]
    )

    if (Object.keys(cambios).length === 0) {
      return NextResponse.json(
        { error: 'No hay cambios para aplicar', code: 'NO_CHANGES' },
        { status: 400 }
      )
    }

    // ====================================================================
    // 5. LLAMAR RPC TRANSACCIONAL
    // ====================================================================
    // Esta es la ÚNICA vía de modificación. Todo sucede en PostgreSQL:
    // - Verificación de usuario
    // - Lock pesimista
    // - Validación de concurrencia
    // - Validación de estado
    // - Actualización
    // - Auditoría
    // TODO atómico, si falla → rollback automático

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'actualizar_factura_con_auditoria',
      {
        p_factura_id: facturaId,
        p_usuario_id: user.id, // Del JWT validado, NUNCA del body
        p_cambios: cambios, // JSONB con cambios validados
        p_expected_updated_at: new Date(expected_updated_at).toISOString(), // ISO 8601
        p_accion: 'EDITADA',
      }
    )

    if (rpcError) {
      console.error('[PATCH] RPC error:', rpcError.message)

      // Parsear mensaje de excepción para devolver el error correcto
      const mensajeRPC = rpcError.message || ''

      if (mensajeRPC.includes('CONFLICTO_CONCURRENCIA')) {
        return NextResponse.json(
          {
            error: 'Conflicto de concurrencia: factura fue modificada por otro usuario',
            code: 'CONFLICT',
          },
          { status: 409 }
        )
      }

      if (mensajeRPC.includes('FACTURA_APROBADA')) {
        return NextResponse.json(
          { error: 'No se puede editar una factura aprobada', code: 'APPROVED' },
          { status: 409 }
        )
      }

      if (mensajeRPC.includes('CAMPO_NO_PERMITIDO')) {
        return NextResponse.json(
          { error: 'Campo no permitido', code: 'INVALID_FIELD' },
          { status: 400 }
        )
      }

      if (mensajeRPC.includes('IMPORTES_INCONSISTENTES')) {
        return NextResponse.json(
          { error: 'Importes inconsistentes (base + iva ≠ total)', code: 'INVALID_AMOUNTS' },
          { status: 400 }
        )
      }

      if (mensajeRPC.includes('PROVEEDOR_NO_EXISTE')) {
        return NextResponse.json(
          { error: 'Proveedor no existe', code: 'INVALID_PROVIDER' },
          { status: 400 }
        )
      }

      if (mensajeRPC.includes('FACTURA_NO_ENCONTRADA')) {
        return NextResponse.json(
          { error: 'Factura no encontrada', code: 'NOT_FOUND' },
          { status: 404 }
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

    const resultado = rpcResult[0]

    if (!resultado.exitoso) {
      return NextResponse.json(
        { error: resultado.mensaje, code: 'RPC_ERROR' },
        { status: 500 }
      )
    }

    // ====================================================================
    // 6. RETORNAR ÉXITO
    // ====================================================================

    return NextResponse.json({
      exitoso: true,
      facturaId: resultado.factura_id,
      historialId: resultado.historial_id,
      nuevoUpdatedAt: resultado.nuevo_updated_at,
      mensaje: 'Factura actualizada y auditada',
    })
  } catch (error) {
    console.error('[PATCH] Error no esperado:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/facturas/[id]/reprocesar
 *
 * Reprocesa una factura con Claude para generar una nueva extracción IA.
 * Reutiliza funciones reales de B.3 (validarDatos, buscarProveedorPorCifNif, etc.)
 *
 * ARQUITECTURA:
 * - Autorización: admin solo (verificarAdmin())
 * - Validaciones: no aprobada, no en LECTURA_PENDIENTE, no hay reprocesamiento activo
 * - Flow: INSERT (EN_PROCESO) → Claude → INSERT extracción → UPDATE (COMPLETADO)
 * - Errores: UPDATE (ERROR) dentro del catch
 *
 * GARANTÍAS:
 * - Una sola operación activa (PENDIENTE/EN_PROCESO) por factura
 * - usuario_id = auth.uid() en la extracción generada
 * - NO modifica extraccion_ia_id ni proveedor_id (aplicación separada)
 * - Validación determinista con validarDatos() de B.3
 * - Metadatos completos (_metadatos, _proveedor_id)
 * - Auditoría en facturas_historial (RPC finalizar lo hace atómico)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/supabase/auth-helpers'
import { verificarAdmin } from '@/lib/permissions/admin-helpers'
import {
  descargarPdf,
  validarDatos,
  buscarProveedorPorCifNif,
  generarMetadatosExtraccion,
} from '@/lib/services/facturas-lectura'
import { extraerTextoDelPdf, extraerDatosFacturaConClaude } from '@/lib/services/claude'

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
        { error: 'Solo admin puede reprocesar facturas', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // ====================================================================
    // 3. OBTENER FACTURA Y VALIDAR ESTADOS
    // ====================================================================
    const { data: factura, error: facturaError } = await supabase
      .from('facturas')
      .select(
        'id, numero_factura, drive_file_id, estado_lectura, estado_revision, proveedor_id'
      )
      .eq('id', facturaId)
      .single()

    if (facturaError || !factura) {
      return NextResponse.json(
        { error: 'Factura no encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Rechazar si está aprobada
    if (factura.estado_revision === 'APROBADA_MANUALMENTE') {
      return NextResponse.json(
        {
          error: 'No se puede reprocesar una factura aprobada',
          code: 'FACTURA_APROBADA'
        },
        { status: 409 }
      )
    }

    // Rechazar si está en LECTURA_PENDIENTE (B.3 en curso)
    if (factura.estado_lectura === 'LECTURA_PENDIENTE') {
      return NextResponse.json(
        {
          error: 'Factura está en procesamiento automático. Espera a que termine',
          code: 'LECTURA_PENDIENTE'
        },
        { status: 409 }
      )
    }

    // ====================================================================
    // 3. VERIFICAR QUE NO HAY REPROCESAMIENTO ACTIVO
    // ====================================================================
    const { data: operacionActiva } = await supabase
      .from('facturas_reprocesamiento_ia')
      .select('id')
      .eq('factura_id', facturaId)
      .in('estado', ['PENDIENTE', 'EN_PROCESO'])
      .maybeSingle()

    if (operacionActiva) {
      return NextResponse.json(
        {
          error: 'Ya existe un reprocesamiento en curso para esta factura',
          code: 'REPROCESAMIENTO_EN_CURSO'
        },
        { status: 409 }
      )
    }

    // ====================================================================
    // 4. CREAR REGISTRO DE OPERACIÓN (EN_PROCESO)
    // ====================================================================
    const now = new Date().toISOString()
    const { data: operacion, error: operacionError } = await supabase
      .from('facturas_reprocesamiento_ia')
      .insert({
        factura_id: facturaId,
        usuario_id: user.id,
        estado: 'EN_PROCESO',
        iniciado_en: now
      })
      .select('id')
      .single()

    // Manejar conflicto UNIQUE INDEX parcial
    if (operacionError) {
      if (
        operacionError.code === '23505' ||
        operacionError.message?.includes('UNIQUE') ||
        operacionError.message?.includes('idx_reprocesamiento_activo')
      ) {
        return NextResponse.json(
          { error: 'Ya existe un reprocesamiento en curso', code: 'REPROCESAMIENTO_EN_CURSO' },
          { status: 409 }
        )
      }
      console.error('[POST reprocesar] Error al crear operación:', operacionError)
      return NextResponse.json(
        { error: 'Error al iniciar reprocesamiento', code: 'OPERATION_ERROR' },
        { status: 500 }
      )
    }

    if (!operacion) {
      return NextResponse.json(
        { error: 'Error al iniciar reprocesamiento', code: 'OPERATION_ERROR' },
        { status: 500 }
      )
    }

    const operacionId = operacion.id

    try {
      // ====================================================================
      // 5. DESCARGAR PDF
      // ====================================================================
      if (!factura.drive_file_id) {
        throw new Error('PDF no disponible')
      }

      const pdfBuffer = await descargarPdf(factura.drive_file_id)

      // ====================================================================
      // 6. EXTRAER TEXTO Y DATOS CON CLAUDE
      // ====================================================================
      const textoExtraido = await extraerTextoDelPdf(pdfBuffer)

      if (!textoExtraido) {
        throw new Error('PDF no contiene texto suficiente')
      }

      const claudeResult = await extraerDatosFacturaConClaude(textoExtraido)

      // ====================================================================
      // 7. VALIDAR DATOS (REUTILIZAR B.3)
      // ====================================================================
      const erroresValidacion = validarDatos(claudeResult)

      // ====================================================================
      // 8. BUSCAR PROVEEDOR (REUTILIZAR B.3, pero NO aplicar aún)
      // ====================================================================
      let proveedorId: string | null = null
      if (erroresValidacion.length === 0 && claudeResult.nif_cif_proveedor) {
        proveedorId = await buscarProveedorPorCifNif(claudeResult.nif_cif_proveedor)
      }

      // ====================================================================
      // 9. GENERAR METADATOS (REUTILIZAR B.3)
      // ====================================================================
      const metadatos = generarMetadatosExtraccion(textoExtraido)

      // ====================================================================
      // 10. GUARDAR NUEVA EXTRACCIÓN EN facturas_extraccion_ia
      // Semántica B.3: guardar respuesta_json + _metadatos + _proveedor_id
      // ====================================================================
      const respuestaJsonConMetadatos = {
        ...claudeResult,
        _metadatos: metadatos,
        _proveedor_id: proveedorId,
      }

      const { data: extraccion, error: extraccionError } = await supabase
        .from('facturas_extraccion_ia')
        .insert({
          factura_id: facturaId,
          usuario_id: user.id,
          respuesta_json: respuestaJsonConMetadatos,
          datos_validados: erroresValidacion.length === 0 ? claudeResult : null,
          errores_validacion: erroresValidacion.length > 0 ? erroresValidacion.map((e) => e.mensaje) : null,
        })
        .select('id')
        .single()

      if (extraccionError || !extraccion) {
        throw new Error(`Error al guardar extracción: ${extraccionError?.message}`)
      }

      // ====================================================================
      // 11. FINALIZAR REPROCESAMIENTO (COMPLETADO + auditoría, ATÓMICO)
      // ====================================================================
      const { data: finalizarResult, error: finalizarError } = await supabase.rpc(
        'finalizar_reprocesamiento_ia',
        {
          p_operacion_id: operacionId,
          p_factura_id: facturaId,
          p_extraccion_id: extraccion.id,
          p_usuario_id: user.id,
        }
      )

      if (finalizarError) {
        throw new Error(`Error finalizando reprocesamiento: ${finalizarError.message}`)
      }

      if (!finalizarResult || finalizarResult.length === 0) {
        throw new Error('Respuesta RPC vacía')
      }

      const [finalizarRes] = finalizarResult
      if (!finalizarRes.exitoso) {
        throw new Error(`Error en RPC finalizar: ${finalizarRes.mensaje}`)
      }

      // ====================================================================
      // 12. RETORNAR ÉXITO
      // ====================================================================
      return NextResponse.json({
        exitoso: true,
        facturaId,
        extraccionId: extraccion.id,
        respuestaJson: claudeResult,
      })
    } catch (error) {
      // ====================================================================
      // MANEJO DE ERRORES: Marcar operación como ERROR
      // ====================================================================
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      console.error('[POST reprocesar] Error:', errorMessage)

      try {
        await supabase
          .from('facturas_reprocesamiento_ia')
          .update({
            estado: 'ERROR',
            error_mensaje: errorMessage,
            completado_en: new Date().toISOString(),
          })
          .eq('id', operacionId)
      } catch (updateError) {
        console.error('[POST reprocesar] Error marcando ERROR:', updateError)
      }

      return NextResponse.json(
        { exitoso: false, facturaId, error: errorMessage, code: 'EXTRACTION_FAILED' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[POST reprocesar] Error no esperado:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

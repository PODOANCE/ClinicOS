/**
 * POST /api/panel/importar
 *
 * Importa el Excel mensual de facturación (registro de transacciones línea
 * a línea) y calcula los agregados que necesita Panel de Control:
 * facturación del mes (con desglose de forma de pago), servicios
 * realizados, servicios por profesional y comisiones por profesional
 * (con/sin plantillas).
 *
 * - Autorización: permiso de edición de PanelControl
 * - Un Excel = un mes: sobrescribe (upsert) los agregados de ese mes en las
 *   4 tablas usando sus claves únicas existentes (centro_id+año+mes[+...]),
 *   así que volver a subir el mismo mes actualiza en vez de duplicar.
 * - No toca "pacientes_nuevos" (no se puede derivar de este archivo).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/supabase/auth-helpers'
import { getUserRoles } from '@/lib/permissions/admin-helpers'
import { canUserAccess } from '@/lib/permissions/validation'
import { ErrorArchivoPanel, parsearExcelPanelMensual } from '@/lib/services/panel-importacion'

const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024
const TAMANO_LOTE = 200

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado', code: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const roles = await getUserRoles(user.id, supabase)
    if (!canUserAccess(roles, 'PanelControl', 'editar')) {
      return NextResponse.json(
        { error: 'Sin permisos para importar datos de Panel de Control', code: 'FORBIDDEN' },
        { status: 403 }
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

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { error: 'Se esperaba multipart/form-data con un archivo', code: 'FORMATO_PETICION_INVALIDO' },
        { status: 400 }
      )
    }

    const archivo = formData.get('archivo')
    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo en el campo "archivo"', code: 'ARCHIVO_AUSENTE' }, { status: 400 })
    }
    if (!archivo.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Solo se admiten archivos .xlsx', code: 'FORMATO_NO_ADMITIDO' }, { status: 400 })
    }
    if (archivo.size === 0) {
      return NextResponse.json({ error: 'El archivo está vacío', code: 'ARCHIVO_VACIO' }, { status: 400 })
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      return NextResponse.json(
        { error: 'El archivo supera el tamaño máximo permitido (5 MB)', code: 'ARCHIVO_DEMASIADO_GRANDE' },
        { status: 400 }
      )
    }

    const contenido = Buffer.from(await archivo.arrayBuffer())

    let resultado
    try {
      resultado = await parsearExcelPanelMensual(contenido)
    } catch (error) {
      if (error instanceof ErrorArchivoPanel) {
        return NextResponse.json({ error: error.message, code: 'ARCHIVO_INVALIDO' }, { status: 400 })
      }
      throw error
    }

    const { anio, mes, centro_id } = { anio: resultado.anio, mes: resultado.mes, centro_id: usuario.centro_id }
    const actor = { created_by: user.id, updated_by: user.id }

    const { error: errorFacturacion } = await supabase.from('panel_facturacion_mensual').upsert(
      {
        anio,
        mes,
        facturacion: resultado.facturacionTotal,
        facturacion_efectivo: resultado.facturacionEfectivo,
        facturacion_tarjeta: resultado.facturacionTarjeta,
        facturacion_transferencia: resultado.facturacionTransferencia,
        centro_id,
        ...actor,
      },
      { onConflict: 'centro_id,anio,mes' }
    )
    if (errorFacturacion) {
      console.error('[POST panel/importar] Error guardando facturación:', errorFacturacion.message)
      return NextResponse.json(
        { error: `Error guardando facturación: ${errorFacturacion.message}`, code: 'ERROR_FACTURACION' },
        { status: 500 }
      )
    }

    for (let inicio = 0; inicio < resultado.serviciosRealizados.length; inicio += TAMANO_LOTE) {
      const lote = resultado.serviciosRealizados.slice(inicio, inicio + TAMANO_LOTE).map((s) => ({
        servicio: s.servicio,
        anio,
        mes,
        cantidad: s.cantidad,
        centro_id,
        ...actor,
      }))
      const { error } = await supabase
        .from('panel_servicios_realizados')
        .upsert(lote, { onConflict: 'centro_id,servicio,anio,mes' })
      if (error) {
        console.error('[POST panel/importar] Error guardando servicios realizados:', error.message)
        return NextResponse.json(
          { error: `Error guardando servicios realizados: ${error.message}`, code: 'ERROR_SERVICIOS' },
          { status: 500 }
        )
      }
    }

    for (let inicio = 0; inicio < resultado.serviciosPorProfesional.length; inicio += TAMANO_LOTE) {
      const lote = resultado.serviciosPorProfesional.slice(inicio, inicio + TAMANO_LOTE).map((s) => ({
        servicio: s.servicio,
        profesional: s.profesional,
        anio,
        mes,
        cantidad: s.cantidad,
        centro_id,
        ...actor,
      }))
      const { error } = await supabase
        .from('panel_servicios_por_profesional')
        .upsert(lote, { onConflict: 'centro_id,servicio,anio,mes,profesional' })
      if (error) {
        console.error('[POST panel/importar] Error guardando servicios por profesional:', error.message)
        return NextResponse.json(
          { error: `Error guardando servicios por profesional: ${error.message}`, code: 'ERROR_SERVICIOS_PROFESIONAL' },
          { status: 500 }
        )
      }
    }

    const loteComisiones = resultado.comisionesPorProfesional.map((c) => ({
      anio,
      mes,
      profesional: c.profesional,
      fact_con_plantillas: c.fact_con_plantillas,
      fact_sin_plantillas: c.fact_sin_plantillas,
      total_plantillas: c.total_plantillas,
      centro_id,
      ...actor,
    }))
    if (loteComisiones.length > 0) {
      const { error } = await supabase
        .from('panel_comisiones_mensual')
        .upsert(loteComisiones, { onConflict: 'centro_id,anio,mes,profesional' })
      if (error) {
        console.error('[POST panel/importar] Error guardando comisiones:', error.message)
        return NextResponse.json(
          { error: `Error guardando comisiones: ${error.message}`, code: 'ERROR_COMISIONES' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      archivo: archivo.name,
      anio,
      mes,
      filasProcesadas: resultado.filasProcesadas,
      facturacionTotal: resultado.facturacionTotal,
      facturacionEfectivo: resultado.facturacionEfectivo,
      facturacionTarjeta: resultado.facturacionTarjeta,
      facturacionTransferencia: resultado.facturacionTransferencia,
      formasPagoNoReconocidas: resultado.formasPagoNoReconocidas,
      serviciosDistintos: resultado.serviciosRealizados.length,
      profesionales: resultado.comisionesPorProfesional.length,
      errores: resultado.errores,
    })
  } catch (error) {
    console.error('[POST panel/importar] Error no esperado:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

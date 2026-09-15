/**
 * POST /api/banco/importar
 *
 * Importa movimientos bancarios desde un extracto XLSX de Banco Sabadell.
 *
 * - Autorización: permiso de edición de facturas
 * - Idempotencia: UNIQUE sobre `huella` + inserción que ignora conflictos
 * - No ejecuta el matching: importación y conciliación son operaciones separadas
 */

import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/supabase/auth-helpers'
import { puedeEditarFactura } from '@/lib/supabase/autorizar'
import {
  ErrorArchivo,
  parsearExtractoBancario,
  type MovimientoNormalizado,
} from '@/lib/services/banco-importacion'

const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024
const TAMANO_LOTE = 500

// created_by/updated_by tienen FK a usuarios_sistema, donde no existen los
// usuarios de la aplicación: el actor técnico es el único valor admitido.
const ACTOR_SISTEMA = '00000000-0000-0000-0000-000000000000'

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

    const { permitido, razon } = await puedeEditarFactura(user.id, supabase)
    if (!permitido) {
      return NextResponse.json(
        { error: razon || 'Sin permisos para importar movimientos', code: 'FORBIDDEN' },
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
      return NextResponse.json(
        { error: 'Falta el archivo en el campo "archivo"', code: 'ARCHIVO_AUSENTE' },
        { status: 400 }
      )
    }

    if (!archivo.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'Solo se admiten archivos .xlsx', code: 'FORMATO_NO_ADMITIDO' },
        { status: 400 }
      )
    }

    if (archivo.size === 0) {
      return NextResponse.json(
        { error: 'El archivo está vacío', code: 'ARCHIVO_VACIO' },
        { status: 400 }
      )
    }

    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      return NextResponse.json(
        { error: 'El archivo supera el tamaño máximo permitido (5 MB)', code: 'ARCHIVO_DEMASIADO_GRANDE' },
        { status: 400 }
      )
    }

    const contenido = Buffer.from(await archivo.arrayBuffer())

    let parseo
    try {
      parseo = await parsearExtractoBancario(contenido, usuario.centro_id)
    } catch (error) {
      if (error instanceof ErrorArchivo) {
        return NextResponse.json(
          { error: error.message, code: 'ARCHIVO_INVALIDO' },
          { status: 400 }
        )
      }
      throw error
    }

    const loteId = randomUUID()
    const filas = parseo.movimientos.map((movimiento: MovimientoNormalizado) => ({
      fecha: movimiento.fecha,
      concepto: movimiento.concepto,
      importe: movimiento.importe,
      sentido: movimiento.sentido,
      huella: movimiento.huella,
      origen: 'CSV_IMPORTADO',
      estado: 'PENDIENTE_JUSTIFICAR',
      archivo_importacion_id: loteId,
      centro_id: usuario.centro_id,
      created_by: ACTOR_SISTEMA,
      updated_by: ACTOR_SISTEMA,
    }))

    let insertados = 0
    for (let inicio = 0; inicio < filas.length; inicio += TAMANO_LOTE) {
      const lote = filas.slice(inicio, inicio + TAMANO_LOTE)

      const { data, error } = await supabase
        .from('movimientos_bancarios')
        .upsert(lote, { onConflict: 'huella', ignoreDuplicates: true })
        .select('id')

      if (error) {
        console.error('[POST banco/importar] Error insertando lote:', error.message)
        return NextResponse.json(
          {
            error: `Error guardando movimientos: ${error.message}`,
            code: 'ERROR_INSERCION',
            loteId,
            insertadosAntesDelError: insertados,
          },
          { status: 500 }
        )
      }

      insertados += data?.length ?? 0
    }

    return NextResponse.json({
      loteId,
      archivo: archivo.name,
      periodo: parseo.periodo,
      totalFilas: parseo.totalFilas,
      insertados,
      yaExistentes: filas.length - insertados,
      errores: parseo.errores,
    })
  } catch (error) {
    console.error('[POST banco/importar] Error no esperado:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}

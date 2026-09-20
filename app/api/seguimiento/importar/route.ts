/**
 * POST /api/seguimiento/importar
 *
 * Importa citas de biomecánica desde un export de Organízate (Estadísticas
 * > Citas - General > Exportar a Excel). Admite subir varios exports
 * seguidos en un mismo archivo (cabeceras repetidas se ignoran solas),
 * igual que la plantilla Excel original.
 *
 * - Autorización: permiso de edición de Seguimiento
 * - Idempotencia: UNIQUE sobre `huella` + inserción que ignora conflictos
 * - Tras insertar las citas, crea una fila de gestión vacía (si no existía
 *   ya) para cada paciente nuevo detectado — nunca sobrescribe una
 *   existente.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/supabase/auth-helpers'
import { getUserRoles } from '@/lib/permissions/admin-helpers'
import { canUserAccess } from '@/lib/permissions/validation'
import {
  ErrorArchivoSeguimiento,
  parsearExportOrganizate,
  type CitaNormalizada,
} from '@/lib/services/seguimiento-importacion'

const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024
const TAMANO_LOTE = 500

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado', code: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const roles = await getUserRoles(user.id, supabase)
    if (!canUserAccess(roles, 'Seguimiento', 'editar')) {
      return NextResponse.json(
        { error: 'Sin permisos para importar citas de seguimiento', code: 'FORBIDDEN' },
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
    const nombreArchivo = archivo.name.toLowerCase()
    if (!nombreArchivo.endsWith('.xlsx') && !nombreArchivo.endsWith('.csv')) {
      return NextResponse.json({ error: 'Solo se admiten archivos .xlsx o .csv', code: 'FORMATO_NO_ADMITIDO' }, { status: 400 })
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

    let parseo
    try {
      parseo = await parsearExportOrganizate(contenido)
    } catch (error) {
      if (error instanceof ErrorArchivoSeguimiento) {
        return NextResponse.json({ error: error.message, code: 'ARCHIVO_INVALIDO' }, { status: 400 })
      }
      throw error
    }

    const filas = parseo.citas.map((c: CitaNormalizada) => ({
      fecha: c.fecha,
      hora: c.hora,
      agenda: c.agenda,
      sala: c.sala,
      paciente_raw: c.paciente_raw,
      paciente_clave: c.paciente_clave,
      tratamiento: c.tratamiento,
      precio: c.precio,
      estado_cita: c.estado_cita,
      huella: c.huella,
      es_seguimiento: c.es_seguimiento,
      centro_id: usuario.centro_id,
      created_by: user.id,
      updated_by: user.id,
    }))

    let insertados = 0
    for (let inicio = 0; inicio < filas.length; inicio += TAMANO_LOTE) {
      const lote = filas.slice(inicio, inicio + TAMANO_LOTE)
      const { data, error } = await supabase
        .from('seguimiento_citas')
        .upsert(lote, { onConflict: 'huella', ignoreDuplicates: true })
        .select('id')

      if (error) {
        console.error('[POST seguimiento/importar] Error insertando lote:', error.message)
        return NextResponse.json(
          { error: `Error guardando citas: ${error.message}`, code: 'ERROR_INSERCION', insertadasAntesDelError: insertados },
          { status: 500 }
        )
      }
      insertados += data?.length ?? 0
    }

    // Crea una fila de gestión vacía para cada paciente nuevo detectado —
    // solo para quien tiene alguna cita de seguimiento (biomecánica/
    // plantillas/revisión); el resto de tratamientos se guarda igual, pero
    // no debe hacer aparecer pacientes ajenos en el panel de recontacto.
    const pacientesUnicos = new Map<string, string>()
    for (const c of parseo.citas) {
      if (!c.es_seguimiento) continue
      if (!pacientesUnicos.has(c.paciente_clave)) pacientesUnicos.set(c.paciente_clave, c.paciente_raw)
    }
    const filasGestion = Array.from(pacientesUnicos.entries()).map(([clave, nombre]) => ({
      paciente_clave: clave,
      nombre_mostrar: nombre,
      centro_id: usuario.centro_id,
      created_by: user.id,
      updated_by: user.id,
    }))

    let pacientesNuevos = 0
    for (let inicio = 0; inicio < filasGestion.length; inicio += TAMANO_LOTE) {
      const lote = filasGestion.slice(inicio, inicio + TAMANO_LOTE)
      const { data, error } = await supabase
        .from('seguimiento_gestion')
        .upsert(lote, { onConflict: 'paciente_clave,centro_id', ignoreDuplicates: true })
        .select('id')

      if (error) {
        console.error('[POST seguimiento/importar] Error creando gestión:', error.message)
        // Las citas ya se guardaron; esto no debería bloquear la respuesta.
        break
      }
      pacientesNuevos += data?.length ?? 0
    }

    return NextResponse.json({
      archivo: archivo.name,
      totalFilas: parseo.totalFilas,
      insertadas: insertados,
      yaExistentes: filas.length - insertados,
      pacientesNuevos,
      otrosServicios: parseo.otrosServicios,
      errores: parseo.errores,
    })
  } catch (error) {
    console.error('[POST seguimiento/importar] Error no esperado:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/recordatorios/generar
 *
 * A partir del export de citas de Organízate (mismo formato que Seguimiento:
 * XLSX o CSV con ";"), genera el texto de recordatorio de cada visita de un
 * día concreto, usando la plantilla guardada del centro. No escribe nada en
 * la base de datos: es una utilidad de solo lectura/generación, el envío lo
 * hace una persona a mano por WhatsApp.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/supabase/auth-helpers'
import { getUserRoles } from '@/lib/permissions/admin-helpers'
import { canUserAccess, esRolAdministracion } from '@/lib/permissions/validation'
import { ErrorArchivoRecordatorios, generarRecordatorios } from '@/lib/services/recordatorios-generador'

const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado', code: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const roles = await getUserRoles(user.id, supabase)
    // Maneja teléfonos de pacientes: solo administración, no podólogos/ortopedas.
    if (!canUserAccess(roles, 'Seguimiento', 'ver') || !esRolAdministracion(roles)) {
      return NextResponse.json({ error: 'Sin permisos para generar recordatorios', code: 'FORBIDDEN' }, { status: 403 })
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
    const fecha = formData.get('fecha')
    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo en el campo "archivo"', code: 'ARCHIVO_AUSENTE' }, { status: 400 })
    }
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: 'Falta o es inválida la fecha objetivo', code: 'FECHA_INVALIDA' }, { status: 400 })
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

    const { data: plantillaRow, error: plantillaError } = await supabase
      .from('recordatorios_plantilla')
      .select('texto')
      .eq('centro_id', usuario.centro_id)
      .maybeSingle()
    if (plantillaError) {
      return NextResponse.json({ error: plantillaError.message, code: 'ERROR_PLANTILLA' }, { status: 500 })
    }
    if (!plantillaRow) {
      return NextResponse.json(
        { error: 'No hay ninguna plantilla de recordatorio configurada para este centro', code: 'SIN_PLANTILLA' },
        { status: 400 }
      )
    }

    // Puede haber miles de teléfonos guardados: PostgREST corta cada
    // respuesta a 1000 filas pase lo que pase en .range(), hay que paginar.
    const TAMANO_PAGINA = 1000
    const telefonosPorPaciente = new Map<string, string>()
    for (let desde = 0; ; desde += TAMANO_PAGINA) {
      const { data: pagina, error: telefonosError } = await supabase
        .from('pacientes_telefono')
        .select('paciente_clave, telefono')
        .eq('centro_id', usuario.centro_id)
        .range(desde, desde + TAMANO_PAGINA - 1)
      if (telefonosError) {
        return NextResponse.json({ error: telefonosError.message, code: 'ERROR_TELEFONOS' }, { status: 500 })
      }
      for (const fila of pagina ?? []) telefonosPorPaciente.set(fila.paciente_clave, fila.telefono)
      if (!pagina || pagina.length < TAMANO_PAGINA) break
    }

    const contenido = Buffer.from(await archivo.arrayBuffer())

    let resultado
    try {
      resultado = await generarRecordatorios(contenido, fecha, plantillaRow.texto, telefonosPorPaciente)
    } catch (error) {
      if (error instanceof ErrorArchivoRecordatorios) {
        return NextResponse.json({ error: error.message, code: 'ARCHIVO_INVALIDO' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[POST recordatorios/generar] Error no esperado:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

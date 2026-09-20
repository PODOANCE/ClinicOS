/**
 * POST /api/pacientes-telefono/importar
 *
 * Importa el listado de pacientes de Organízate (Nombre, Apellidos, Tel.
 * fijo, Tel. móvil...) para poder generar enlaces directos de WhatsApp en
 * Recordatorios. Se sube de vez en cuando, no cada día: sobrescribe
 * (upsert) por nombre normalizado, así que volver a subirlo actualiza en
 * vez de duplicar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/supabase/auth-helpers'
import { getUserRoles } from '@/lib/permissions/admin-helpers'
import { canUserAccess, esRolAdministracion } from '@/lib/permissions/validation'
import { ErrorArchivoPacientesTelefono, parsearListadoPacientes } from '@/lib/services/pacientes-telefono-importacion'

const TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024
const TAMANO_LOTE = 500

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado', code: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const roles = await getUserRoles(user.id, supabase)
    // Maneja teléfonos de pacientes: solo administración, no podólogos/ortopedas.
    if (!canUserAccess(roles, 'Seguimiento', 'editar') || !esRolAdministracion(roles)) {
      return NextResponse.json(
        { error: 'Sin permisos para importar teléfonos de pacientes', code: 'FORBIDDEN' },
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
    if (archivo.size === 0) {
      return NextResponse.json({ error: 'El archivo está vacío', code: 'ARCHIVO_VACIO' }, { status: 400 })
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      return NextResponse.json(
        { error: 'El archivo supera el tamaño máximo permitido (8 MB)', code: 'ARCHIVO_DEMASIADO_GRANDE' },
        { status: 400 }
      )
    }

    const contenido = Buffer.from(await archivo.arrayBuffer())

    let pacientes
    try {
      pacientes = await parsearListadoPacientes(contenido)
    } catch (error) {
      if (error instanceof ErrorArchivoPacientesTelefono) {
        return NextResponse.json({ error: error.message, code: 'ARCHIVO_INVALIDO' }, { status: 400 })
      }
      throw error
    }

    const actor = { created_by: user.id, updated_by: user.id }
    let guardados = 0
    for (let inicio = 0; inicio < pacientes.length; inicio += TAMANO_LOTE) {
      const lote = pacientes.slice(inicio, inicio + TAMANO_LOTE).map((p) => ({
        paciente_clave: p.paciente_clave,
        nombre_mostrar: p.nombre_mostrar,
        telefono: p.telefono,
        edad: p.edad,
        centro_id: usuario.centro_id,
        ...actor,
      }))
      const { error } = await supabase
        .from('pacientes_telefono')
        .upsert(lote, { onConflict: 'centro_id,paciente_clave' })
      if (error) {
        console.error('[POST pacientes-telefono/importar] Error guardando lote:', error.message)
        return NextResponse.json(
          { error: `Error guardando teléfonos: ${error.message}`, code: 'ERROR_INSERCION', guardadosAntesDelError: guardados },
          { status: 500 }
        )
      }
      guardados += lote.length
    }

    return NextResponse.json({
      archivo: archivo.name,
      totalFilas: pacientes.length,
      guardados,
    })
  } catch (error) {
    console.error('[POST pacientes-telefono/importar] Error no esperado:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

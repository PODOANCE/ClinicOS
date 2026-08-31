import { createAdminClient } from './server'

/**
 * Verificar si usuario puede editar facturas
 *
 * Consulta la matriz de permisos en tabla roles.areas_permitidas
 * para determinar si el usuario tiene permiso "editar" en área "Facturas".
 *
 * @param userId - UUID del usuario autenticado (del JWT)
 * @param supabase - Cliente admin de Supabase
 * @returns { permitido: boolean; razon?: string }
 */
export async function puedeEditarFactura(
  userId: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<{ permitido: boolean; razon?: string }> {
  try {
    // 1. Verificar que usuario existe y está activo
    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('id, activo')
      .eq('id', userId)
      .single()

    if (usuarioError || !usuario) {
      return { permitido: false, razon: 'Usuario no encontrado' }
    }

    if (!usuario.activo) {
      return { permitido: false, razon: 'Usuario inactivo' }
    }

    // 2. Obtener roles del usuario
    const { data: rolesData, error: rolesError } = await supabase
      .from('usuarios_roles')
      .select('roles(nombre, areas_permitidas)')
      .eq('usuario_id', userId)

    if (rolesError || !rolesData || rolesData.length === 0) {
      return { permitido: false, razon: 'Usuario sin roles asignados' }
    }

    // 3. Verificar que al menos uno de sus roles tiene permiso "editar" en "Facturas"
    const tienePermisoEditar = rolesData.some((ur) => {
      const roles_obj = ur.roles as any
      if (!roles_obj || !roles_obj.areas_permitidas) return false

      const areasPermitidas = roles_obj.areas_permitidas
      const facturaPermisos = areasPermitidas['Facturas']

      // Necesita: { ver: true, editar: true } (como mínimo)
      return facturaPermisos && facturaPermisos.editar === true
    })

    if (!tienePermisoEditar) {
      return {
        permitido: false,
        razon: 'Usuario no tiene permiso para editar facturas',
      }
    }

    // ✅ Usuario autenticado, activo, con rol que permite editar facturas
    return { permitido: true }
  } catch (error) {
    console.error('[puedeEditarFactura] Error:', error)
    return {
      permitido: false,
      razon: 'Error verificando permisos',
    }
  }
}

import { createAdminClient } from '@/lib/supabase/server'
import { isSystemAdmin } from './validation'

/**
 * Obtiene roles del usuario desde usuarios_roles
 * Propaga errores de DB para distinción clara entre "no admin" y "error"
 */
export async function getUserRoles(
  userId: string,
  supabase: ReturnType<typeof createAdminClient>
) {
  const { data, error } = await supabase
    .from('usuarios_roles')
    .select('roles(nombre, areas_permitidas)')
    .eq('usuario_id', userId)

  if (error) {
    throw new Error(`DB_ERROR: ${error.message}`)
  }

  if (!data) {
    return []
  }

  return data.map((ur) => (ur.roles as any) || {}).filter((r) => r)
}

/**
 * Valida si un usuario es administrador del sistema
 * Reutiliza isSystemAdmin() — mecanismo canónico del proyecto
 * Propaga errores de DB para manejo explícito en endpoints
 */
export async function esAdmin(
  userId: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<boolean> {
  const roles = await getUserRoles(userId, supabase)
  return isSystemAdmin(roles)
}

/**
 * Verificador explícito para endpoints: retorna { esAdmin, error? }
 * Maneja DB_ERROR y errores inesperados
 */
export async function verificarAdmin(
  userId: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<{ esAdmin: boolean; error?: string }> {
  try {
    const result = await esAdmin(userId, supabase)
    return { esAdmin: result }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('DB_ERROR:')) {
      return { esAdmin: false, error: 'PERMISSION_CHECK_FAILED' }
    }
    console.error('[verificarAdmin] Error inesperado:', error)
    return { esAdmin: false, error: 'INTERNAL_ERROR' }
  }
}

import { NextRequest } from 'next/server'
import { createClient } from './browser'

/**
 * Obtiene el usuario autenticado desde el header Authorization
 *
 * Valida:
 * - Formato: "Authorization: Bearer <JWT>"
 * - Token válido mediante Supabase Auth
 *
 * NUNCA confía en un user_id del body/query.
 * La identidad SIEMPRE viene del JWT.
 *
 * @returns Usuario autenticado o null si no válido
 */
export async function getAuthenticatedUser(request: NextRequest) {
  try {
    // Obtener header Authorization
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return null
    }

    // Validar formato "Bearer <token>"
    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null
    }

    const token = parts[1]
    if (!token) {
      return null
    }

    // Validar token mediante Supabase Auth
    // Usamos createClient (anon) para validar el token
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return null
    }

    return user
  } catch (error) {
    console.error('[getAuthenticatedUser] Error:', error)
    return null
  }
}

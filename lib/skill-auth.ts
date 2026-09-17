import { NextRequest } from 'next/server'

/**
 * Autenticación para los endpoints que llamará la Skill (Claude, desde fuera
 * de ClinicOS) en vez de una persona con sesión de Supabase Auth. Es una
 * credencial técnica única, sin relación con ningún usuario ni permiso de
 * `roles` — cualquier llamada con esta clave puede hacer lo que el endpoint
 * permita, así que solo debe usarse en rutas bajo /api/skill/*.
 */
export function verificarAuthSkill(request: NextRequest): boolean {
  const esperado = process.env.SKILL_API_KEY
  if (!esperado) return false

  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  return token.length > 0 && token === esperado
}

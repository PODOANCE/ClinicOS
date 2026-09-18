import { NextRequest } from 'next/server'

/**
 * Autenticación para los endpoints que llamará la Skill (Claude, desde fuera
 * de ClinicOS) en vez de una persona con sesión de Supabase Auth. Es una
 * credencial técnica única, sin relación con ningún usuario ni permiso de
 * `roles` — cualquier llamada con esta clave puede hacer lo que el endpoint
 * permita, así que solo debe usarse en rutas bajo /api/skill/*.
 *
 * Acepta la clave en "Authorization: Bearer <clave>" (para pruebas manuales
 * con curl), en "X-Api-Key: <clave>" o en "X-Clinicos-Key: <clave>". Hacen
 * falta las dos últimas porque el conector personalizado de Claude reserva
 * el nombre "Authorization" para su propio login, y además solo deja usar
 * un puñado de nombres de cabecera ya reconocidos como personalizados (no
 * cualquier nombre inventado) — "X-Api-Key" es el estándar de facto que
 * suele estar aprobado.
 */
export function verificarAuthSkill(request: NextRequest): boolean {
  const esperado = process.env.SKILL_API_KEY
  if (!esperado) return false

  const claveApiKey = request.headers.get('x-api-key')
  if (claveApiKey) return claveApiKey === esperado

  const claveDirecta = request.headers.get('x-clinicos-key')
  if (claveDirecta) return claveDirecta === esperado

  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  return token.length > 0 && token === esperado
}

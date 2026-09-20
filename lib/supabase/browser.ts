import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let supabaseClient: ReturnType<typeof createSupabaseClient> | null = null

export function createClient() {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    )

    // Ojo: no forzar aquí un refreshSession() en 'SIGNED_IN' (se probó y se
    // quitó). Ese evento se dispara también al restaurar la sesión guardada
    // en cada carga de página, justo cuando la página ya está lanzando sus
    // propias consultas paginadas — el refresh en paralelo puede dejar una
    // petición sin token válido a mitad de vuelo y esa página vuelve vacía
    // en silencio (sin error), truncando resultados. autoRefreshToken ya
    // renueva el token a tiempo por su cuenta sin competir con nada;
    // withJWTRetry (ver stock.ts) es el sitio correcto para reaccionar a un
    // error real de JWT, no un refresh preventivo en cada sign-in.
  }
  return supabaseClient
}

export async function handleJWTError() {
  if (!supabaseClient) return

  try {
    const { data, error } = await supabaseClient.auth.refreshSession()
    if (error) {
      await supabaseClient.auth.signOut()
      if (typeof window !== 'undefined') {
        localStorage.removeItem('supabase.auth.token')
        window.location.href = '/login'
      }
    }
  } catch (err) {
    console.error('Error handling JWT:', err)
    await supabaseClient.auth.signOut()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('supabase.auth.token')
      window.location.href = '/login'
    }
  }
}

export function isJWTClockSkewError(errorMessage: string): boolean {
  return errorMessage?.includes('JWT') || errorMessage?.includes('issued at future')
}


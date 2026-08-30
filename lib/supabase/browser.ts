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

    // Manejar error de JWT futuro
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Asegurar que la sesión es válida
        const { error } = await supabaseClient!.auth.refreshSession()
        if (error) {
          console.warn('Error refreshing session:', error)
          // Limpiar sesión inválida
          await supabaseClient!.auth.signOut()
        }
      }
    })
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


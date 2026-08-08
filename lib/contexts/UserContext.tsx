'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Rol } from '@/lib/types/models'
import { getEffectivePermissions } from '@/lib/permissions/validation'
import type { AreaPermiso } from '@/lib/types/models'

interface UserSession {
  id: string | null
  email: string | null
  nombre: string | null
  roles: Rol[]
  permisos: Record<string, AreaPermiso>
  loading: boolean
  error: string | null
}

const UserContext = createContext<UserSession | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UserSession>({
    id: null,
    email: null,
    nombre: null,
    roles: [],
    permisos: {},
    loading: true,
    error: null,
  })

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const supabase = createClient()

        // 1. Obtener usuario autenticado
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
          setState(prev => ({
            ...prev,
            loading: false,
          }))
          return
        }

        // 2. Obtener perfil del usuario desde public.usuarios
        const { data: usuario, error: usuarioError } = await supabase
          .from('usuarios')
          .select('id, email, nombre, activo')
          .eq('id', user.id)
          .single()

        if (usuarioError) {
          console.error('Error cargando usuario:', usuarioError)
          setState(prev => ({
            ...prev,
            id: user.id,
            email: user.email,
            loading: false,
            error: 'Perfil no sincronizado',
          }))
          return
        }

        // 3. Obtener roles con relación a roles
        const { data: usuarioRoles, error: rolesError } = await supabase
          .from('usuarios_roles')
          .select(`
            rol:roles (
              id,
              nombre,
              areas_permitidas
            )
          `)
          .eq('usuario_id', user.id)

        if (rolesError) {
          console.error('Error cargando roles:', rolesError)
        }

        const roles = usuarioRoles?.map(ur => ur.rol).filter(Boolean) as Rol[] || []

        // 4. Calcular permisos efectivos (unión de todos los roles)
        const permisos = getEffectivePermissions(roles)

        setState({
          id: user.id,
          email: usuario?.email || user.email,
          nombre: usuario?.nombre || null,
          roles,
          permisos,
          loading: false,
          error: null,
        })
      } catch (err) {
        console.error('Error en loadUserData:', err)
        setState(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Error desconocido',
        }))
      }
    }

    loadUserData()
  }, [])

  return (
    <UserContext.Provider value={state}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within UserProvider')
  }
  return context
}

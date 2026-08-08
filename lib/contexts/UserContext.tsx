'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserSession {
  id: string | null
  email: string | null
  loading: boolean
}

const UserContext = createContext<UserSession | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UserSession>({
    id: null,
    email: null,
    loading: true,
  })

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        setState({
          id: user?.id || null,
          email: user?.email || null,
          loading: false,
        })
      } catch (err) {
        setState(prev => ({
          ...prev,
          loading: false,
        }))
      }
    }

    checkAuth()
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

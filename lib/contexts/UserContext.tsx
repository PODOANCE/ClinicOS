'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

interface UserSession {
  user: { id: string; email: string } | null
  loading: boolean
}

const UserContext = createContext<UserSession | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<UserSession>({
    user: null,
    loading: true,
  })

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        if (pathname !== '/login') {
          router.replace('/login')
        }
        setState({ user: null, loading: false })
        return
      }

      setState({
        user: { id: user.id, email: user.email ?? '' },
        loading: false,
      })
    }

    checkUser()
  }, [pathname, router])

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

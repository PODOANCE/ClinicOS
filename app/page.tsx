'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    }

    checkAuth()
  }, [router])

  return <div style={{ padding: '2rem' }}>Cargando...</div>
}

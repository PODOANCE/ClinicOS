'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/contexts/UserContext'

export function Header() {
  const router = useRouter()
  const { nombre, email, loading } = useUser()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header style={{
      backgroundColor: '#fff',
      borderBottom: '1px solid #ddd',
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>ClinicOS</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {!loading && (nombre || email) && (
          <>
            <div style={{ textAlign: 'right', fontSize: '0.875rem', color: '#666' }}>
              <div style={{ fontWeight: '500', color: '#000' }}>{nombre}</div>
              <div style={{ fontSize: '0.75rem' }}>{email}</div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              Salir
            </button>
          </>
        )}
      </div>
    </header>
  )
}

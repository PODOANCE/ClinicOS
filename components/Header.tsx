'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { useUser } from '@/lib/contexts/UserContext'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

export function Header() {
  const router = useRouter()
  const { user, loading } = useUser()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header
      style={{
        background: `linear-gradient(135deg, ${DENIM} 0%, #1e5080 100%)`,
        padding: '0.9rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}
    >
      <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#fff', letterSpacing: '-0.3px' }}>ClinicOS</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {!loading && user && (
          <>
            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)' }}>{user.email}</div>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.4rem 1rem',
                backgroundColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = PUMPKIN)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            >
              Salir
            </button>
          </>
        )}
      </div>
    </header>
  )
}

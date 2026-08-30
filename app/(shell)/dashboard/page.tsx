'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { useUser } from '@/lib/contexts/UserContext'

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading } = useUser()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return <div style={{ padding: '2rem' }}>Cargando...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>Dashboard</h2>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>

      <div style={{ backgroundColor: '#f9f9f9', padding: '2rem', borderRadius: '8px', border: '1px solid #ddd' }}>
        <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Sesión Activa</h3>
        <dl style={{ display: 'grid', gap: '0.75rem', fontSize: '0.875rem', margin: 0 }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <dt style={{ fontWeight: '600', minWidth: '80px' }}>Email:</dt>
            <dd style={{ margin: 0 }}>{user?.email}</dd>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <dt style={{ fontWeight: '600', minWidth: '80px' }}>ID:</dt>
            <dd style={{ margin: 0, fontSize: '0.75rem', color: '#666' }}>{user?.id}</dd>
          </div>
        </dl>
      </div>

      <div style={{ padding: '1rem', fontSize: '0.75rem', color: '#999', borderTop: '1px solid #ddd', marginTop: '2rem' }}>
        Fase 1 · Shell operativo · Autenticación simple
      </div>
    </div>
  )
}

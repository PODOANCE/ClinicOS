'use client'

import { useUser } from '@/lib/contexts/UserContext'

export default function DashboardPage() {
  const { email, loading } = useUser()

  if (loading) {
    return <div>Cargando...</div>
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>
        Dashboard
      </h2>

      <div style={{ display: 'grid', gap: '2rem' }}>
        <div style={{ backgroundColor: '#f9f9f9', padding: '2rem', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Sesión activa</h3>
          <p style={{ margin: '0.5rem 0', fontSize: '0.875rem' }}>
            <strong>Email:</strong> {email}
          </p>
          <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: '#666' }}>
            Shell Phase 1 funcional. Autenticación y navegación básica operativas.
          </p>
        </div>
      </div>
    </div>
  )
}

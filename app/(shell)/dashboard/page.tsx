'use client'

import { useUser } from '@/lib/contexts/UserContext'

export default function DashboardPage() {
  const { email, nombre, roles, permisos, loading, error } = useUser()

  if (loading) {
    return <div style={{ padding: '2rem' }}>Cargando...</div>
  }

  if (error) {
    return (
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>
          Dashboard
        </h2>
        <div style={{ backgroundColor: '#fff3cd', padding: '1rem', borderRadius: '8px', border: '1px solid #ffc107', color: '#856404' }}>
          <strong>⚠️ Atención:</strong> {error}
        </div>
      </div>
    )
  }

  const accessibleAreas = Object.entries(permisos)
    .filter(([_, permisos]) => permisos.ver)
    .map(([area]) => area)

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>
        Dashboard
      </h2>

      <div style={{ display: 'grid', gap: '2rem' }}>
        {/* Sección: Perfil */}
        <div style={{ backgroundColor: '#f9f9f9', padding: '2rem', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Perfil</h3>
          <dl style={{ display: 'grid', gap: '0.75rem', fontSize: '0.875rem', margin: 0 }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <dt style={{ fontWeight: '600', minWidth: '80px' }}>Email:</dt>
              <dd style={{ margin: 0 }}>{email}</dd>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <dt style={{ fontWeight: '600', minWidth: '80px' }}>Nombre:</dt>
              <dd style={{ margin: 0 }}>{nombre || '(no completado)'}</dd>
            </div>
          </dl>
        </div>

        {/* Sección: Roles */}
        {roles.length > 0 ? (
          <div style={{ backgroundColor: '#f9f9f9', padding: '2rem', borderRadius: '8px', border: '1px solid #ddd' }}>
            <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Roles Asignados</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
              {roles.map(rol => (
                <li key={rol.id} style={{ fontSize: '0.875rem' }}>
                  ✓ <strong>{rol.nombre}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div style={{ backgroundColor: '#fff3cd', padding: '2rem', borderRadius: '8px', border: '1px solid #ffc107', color: '#856404' }}>
            <strong>⚠️ Sin permisos</strong>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
              No tienes roles asignados. Contacta al administrador para obtener acceso.
            </p>
          </div>
        )}

        {/* Sección: Áreas Accesibles */}
        {roles.length > 0 && (
          <div style={{ backgroundColor: '#f9f9f9', padding: '2rem', borderRadius: '8px', border: '1px solid #ddd' }}>
            <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Áreas Accesibles</h3>
            {accessibleAreas.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
                {accessibleAreas.map(area => (
                  <li key={area} style={{ fontSize: '0.875rem' }}>
                    ✓ {area}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>
                Tus roles no incluyen acceso a ninguna área. Espera a que el administrador asigne permisos.
              </p>
            )}
          </div>
        )}

        {/* Info: Fase 1 */}
        <div style={{ padding: '1rem', fontSize: '0.75rem', color: '#999', borderTop: '1px solid #ddd', marginTop: '1rem' }}>
          Fase 1 · Shell operativo · Autenticación y navegación con permisos
        </div>
      </div>
    </div>
  )
}

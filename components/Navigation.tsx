'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@/lib/contexts/UserContext'

export function Navigation() {
  const pathname = usePathname()
  const { permisos, roles, loading } = useUser()

  // Definir todas las áreas disponibles con sus propiedades
  const allAreas = [
    { nombre: 'Dashboard', href: '/dashboard', permiso: null },  // Siempre visible
    { nombre: 'Hoy', href: '/areas/hoy', permiso: 'Hoy' },
    { nombre: 'Facturas', href: '/areas/facturas', permiso: 'Facturas' },
    { nombre: 'Stock', href: '/areas/stock', permiso: 'Stock' },
    { nombre: 'Leads', href: '/areas/leads', permiso: 'Leads' },
    { nombre: 'Vacaciones', href: '/areas/vacaciones', permiso: 'Vacaciones' },
  ]

  // Filtrar por permisos: mostrar solo si no requiere permiso o si usuario lo tiene
  const navItems = allAreas.filter(item => {
    if (!item.permiso) return true  // Dashboard siempre visible
    return permisos[item.permiso]?.ver === true
  })

  if (loading) {
    return (
      <nav style={{ width: '240px', backgroundColor: '#fff', borderRight: '1px solid #ddd', padding: '1rem' }}>
        <div style={{ fontSize: '0.875rem', color: '#999' }}>Cargando permisos...</div>
      </nav>
    )
  }

  return (
    <nav style={{ width: '240px', backgroundColor: '#fff', borderRight: '1px solid #ddd', padding: '1rem 0' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ padding: '0 1rem', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: '#999', marginBottom: '1rem' }}>
          Menú
        </h2>

        {navItems.length === 0 ? (
          // Usuario sin permisos
          <div style={{ padding: '0 1rem', fontSize: '0.875rem', color: '#999' }}>
            <p>Sin permisos asignados</p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>Contacta al administrador</p>
          </div>
        ) : (
          // Usuario con permisos
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {navItems.map(item => {
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    style={{
                      display: 'block',
                      padding: '0.75rem 1rem',
                      color: isActive ? '#000' : '#666',
                      textDecoration: 'none',
                      backgroundColor: isActive ? '#f0f0f0' : 'transparent',
                      borderLeft: isActive ? '3px solid #000' : '3px solid transparent',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#f9f9f9'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'
                    }}
                  >
                    {item.nombre}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {/* Info de debug (remover en producción) */}
        {roles.length > 0 && (
          <div style={{ padding: '1rem', marginTop: '1rem', borderTop: '1px solid #ddd', fontSize: '0.75rem', color: '#999' }}>
            <p><strong>Roles:</strong> {roles.map(r => r.nombre).join(', ')}</p>
          </div>
        )}
      </div>
    </nav>
  )
}

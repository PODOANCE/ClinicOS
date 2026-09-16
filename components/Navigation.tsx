'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@/lib/contexts/UserContext'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { canUserAccess } from '@/lib/permissions/validation'

export function Navigation() {
  const pathname = usePathname()
  const { user, loading } = useUser()
  const [puedeVerStock, setPuedeVerStock] = useState(false)
  const [puedeVerVacaciones, setPuedeVerVacaciones] = useState(false)

  useEffect(() => {
    if (!user) return
    getRolesUsuarioActual(user.id).then((roles) => {
      setPuedeVerStock(canUserAccess(roles, 'Stock', 'ver'))
      setPuedeVerVacaciones(canUserAccess(roles, 'Vacaciones', 'ver'))
    })
  }, [user])

  const navItems = [
    { nombre: 'Dashboard', href: '/dashboard' },
    { nombre: 'Hoy', href: '/hoy' },
    ...(puedeVerStock ? [{ nombre: 'Stock', href: '/stock' }] : []),
    ...(puedeVerVacaciones ? [{ nombre: 'Vacaciones', href: '/vacaciones' }] : []),
  ]

  if (loading) {
    return (
      <nav style={{ width: '240px', backgroundColor: '#fff', borderRight: '1px solid #ddd', padding: '1rem' }}>
        <div style={{ fontSize: '0.875rem', color: '#999' }}>Cargando...</div>
      </nav>
    )
  }

  return (
    <nav style={{ width: '240px', backgroundColor: '#fff', borderRight: '1px solid #ddd', padding: '1rem 0' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ padding: '0 1rem', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: '#999', marginBottom: '1rem' }}>
          Menú
        </h2>

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
                >
                  {item.nombre}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}

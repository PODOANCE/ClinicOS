'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@/lib/contexts/UserContext'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { canUserAccess, esRolAdministracion, isSystemAdmin } from '@/lib/permissions/validation'

export function Navigation() {
  const pathname = usePathname()
  const { user, loading } = useUser()
  const [puedeVerStock, setPuedeVerStock] = useState(false)
  const [puedeVerVacaciones, setPuedeVerVacaciones] = useState(false)
  const [puedeVerConciliacion, setPuedeVerConciliacion] = useState(false)
  const [puedeVerLeads, setPuedeVerLeads] = useState(false)
  const [puedeVerPanel, setPuedeVerPanel] = useState(false)
  const [puedeVerSeguimiento, setPuedeVerSeguimiento] = useState(false)
  const [puedeVerHerramientasAdmin, setPuedeVerHerramientasAdmin] = useState(false)
  const [esAdminSistema, setEsAdminSistema] = useState(false)
  const [puedeVerPresupuestos, setPuedeVerPresupuestos] = useState(false)
  const [puedeVerConsentimientos, setPuedeVerConsentimientos] = useState(false)

  useEffect(() => {
    if (!user) return
    getRolesUsuarioActual(user.id).then((roles) => {
      setPuedeVerStock(canUserAccess(roles, 'Stock', 'ver'))
      setPuedeVerVacaciones(canUserAccess(roles, 'Vacaciones', 'ver'))
      setPuedeVerConciliacion(canUserAccess(roles, 'Facturas', 'editar'))
      setPuedeVerLeads(canUserAccess(roles, 'Leads', 'ver'))
      setPuedeVerPanel(canUserAccess(roles, 'PanelControl', 'ver'))
      setPuedeVerSeguimiento(canUserAccess(roles, 'Seguimiento', 'ver'))
      // Recordatorios y Quiropodia manejan teléfonos de pacientes: solo administración, no podólogos/ortopedas.
      setPuedeVerHerramientasAdmin(canUserAccess(roles, 'Seguimiento', 'ver') && esRolAdministracion(roles))
      setEsAdminSistema(isSystemAdmin(roles))
      setPuedeVerPresupuestos(canUserAccess(roles, 'Presupuestos', 'ver'))
      setPuedeVerConsentimientos(canUserAccess(roles, 'Consentimientos', 'ver'))
    })
  }, [user])

  const navItems = [
    { nombre: 'Dashboard', href: '/dashboard' },
    { nombre: 'Hoy', href: '/hoy' },
    ...(puedeVerStock ? [{ nombre: 'Stock', href: '/stock' }] : []),
    ...(puedeVerVacaciones ? [{ nombre: 'Vacaciones', href: '/vacaciones' }] : []),
    ...(puedeVerConciliacion ? [{ nombre: 'Conciliación', href: '/conciliacion' }] : []),
    ...(puedeVerLeads ? [{ nombre: 'Leads', href: '/leads' }] : []),
    ...(puedeVerSeguimiento ? [{ nombre: 'Seguimiento', href: '/seguimiento' }] : []),
    ...(puedeVerHerramientasAdmin ? [{ nombre: 'Recordatorios', href: '/recordatorios' }] : []),
    ...(puedeVerHerramientasAdmin ? [{ nombre: 'Quiropodia', href: '/quiropodia' }] : []),
    ...(puedeVerPanel ? [{ nombre: 'Panel de Control', href: '/panel' }] : []),
    ...(puedeVerPresupuestos ? [{ nombre: 'Presupuestos', href: '/presupuestos' }] : []),
    ...(puedeVerConsentimientos ? [{ nombre: 'Consentimientos', href: '/consentimientos' }] : []),
    ...(esAdminSistema ? [{ nombre: '🏆 Mejores pacientes', href: '/mejores-pacientes' }] : []),
  ]

  const DENIM = '#183B5F'
  const PUMPKIN = '#F18852'

  if (loading) {
    return (
      <nav style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0.6rem 1.5rem' }}>
        <div style={{ fontSize: '0.8rem', color: '#999' }}>Cargando...</div>
      </nav>
    )
  }

  return (
    <nav
      style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.5rem 1.25rem',
        display: 'flex',
        gap: '0.4rem',
        flexWrap: 'wrap',
        boxShadow: '0 2px 6px rgba(24,59,95,0.05)',
      }}
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'inline-block',
              padding: '0.45rem 0.9rem',
              color: isActive ? '#fff' : '#4a5a6a',
              textDecoration: 'none',
              backgroundColor: isActive ? DENIM : 'transparent',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: isActive ? 700 : 600,
              borderBottom: !isActive ? '2px solid transparent' : undefined,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = PUMPKIN
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = '#4a5a6a'
            }}
          >
            {item.nombre}
          </Link>
        )
      })}
    </nav>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import { useUser } from '@/lib/contexts/UserContext'
import { getTasks, getNombreUsuario } from '@/lib/supabase/queries/tasks'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { canUserAccess } from '@/lib/permissions/validation'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

// Nombres como "Andrés y Celia" (cuentas compartidas por varias personas) ya
// vienen listos para el saludo; los nombres completos de una sola persona
// ("Belén Iglesias Arias") se recortan al nombre de pila.
function nombreParaSaludo(nombre: string | null): string | null {
  if (!nombre) return null
  if (nombre.includes(' y ')) return nombre
  return nombre.split(' ')[0]
}

export default function DashboardPage() {
  const { user, loading } = useUser()

  const [nombreSaludo, setNombreSaludo] = useState<string | null>(null)
  const [puedeVerFacturas, setPuedeVerFacturas] = useState(false)
  const [tareasAbiertas, setTareasAbiertas] = useState<number | null>(null)
  const [facturasPorConciliar, setFacturasPorConciliar] = useState<number | null>(null)
  const [cargandoResumen, setCargandoResumen] = useState(true)

  useEffect(() => {
    if (!user) return
    cargarResumen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function cargarResumen() {
    if (!user) return
    try {
      setCargandoResumen(true)
      const nombre = await getNombreUsuario(user.id)
      setNombreSaludo(nombreParaSaludo(nombre))

      const roles = await getRolesUsuarioActual(user.id)
      const tienePermisoFacturas = canUserAccess(roles, 'Facturas', 'editar')
      setPuedeVerFacturas(tienePermisoFacturas)

      const tareas = await getTasks(user.id)
      setTareasAbiertas(tareas.length)

      if (tienePermisoFacturas) {
        const supabase = createClient()
        const { count } = await supabase
          .from('facturas')
          .select('id', { count: 'exact', head: true })
          .eq('activo', true)
          .eq('estado_conciliacion', 'NO_CONCILIADA')
        setFacturasPorConciliar(count ?? 0)
      }
    } catch {
      // El resumen es un extra informativo: si falla, el dashboard sigue siendo usable sin él.
    } finally {
      setCargandoResumen(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Cargando...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: DENIM }}>
          ¡Hola{nombreSaludo ? `, ${nombreSaludo}` : ''}! 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Bienvenido de nuevo a ClinicOS</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <Link
          href="/hoy"
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow"
        >
          <div className="text-3xl font-bold" style={{ color: DENIM }}>
            {cargandoResumen ? '…' : tareasAbiertas}
          </div>
          <div className="text-sm text-gray-500 font-medium mt-1">Tareas abiertas</div>
        </Link>

        {puedeVerFacturas && (
          <Link
            href="/conciliacion"
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow"
          >
            <div className="text-3xl font-bold" style={{ color: (facturasPorConciliar ?? 0) > 0 ? PUMPKIN : DENIM }}>
              {cargandoResumen ? '…' : facturasPorConciliar}
            </div>
            <div className="text-sm text-gray-500 font-medium mt-1">Facturas por conciliar</div>
          </Link>
        )}
      </div>
    </div>
  )
}

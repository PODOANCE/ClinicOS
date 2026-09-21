'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/contexts/UserContext'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { getPresupuestos } from '@/lib/supabase/queries/presupuestos'
import { canUserAccess } from '@/lib/permissions/validation'
import type { Presupuesto, Rol } from '@/lib/types/models'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

function eur(n: number): string {
  return Math.round(n).toLocaleString('es-ES') + ' €'
}

function fechaDDMMAAAA(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export default function PresupuestosPage() {
  const { user, loading: userLoading } = useUser()
  const [roles, setRoles] = useState<Rol[]>([])
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function cargar() {
    if (!user) return
    try {
      setLoading(true)
      const rls = await getRolesUsuarioActual(user.id)
      setRoles(rls)
      setPresupuestos(await getPresupuestos())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando presupuestos')
    } finally {
      setLoading(false)
    }
  }

  const puedeVer = canUserAccess(roles, 'Presupuestos', 'ver')
  const puedeCrear = canUserAccess(roles, 'Presupuestos', 'crear')

  if (userLoading || loading) {
    return <div className="p-6 text-gray-500">Cargando presupuestos...</div>
  }
  if (!puedeVer) {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permiso para ver Presupuestos.</p>
      </div>
    )
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: DENIM }}>Presupuestos</h1>
          <p className="text-gray-500 mt-1 text-sm">Presupuestos generados desde ClinicOS (no sustituye a Organízate, es aparte).</p>
        </div>
        {puedeCrear && (
          <Link
            href="/presupuestos/nuevo"
            className="px-4 py-2 rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: PUMPKIN }}
          >
            + Nuevo presupuesto
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {presupuestos.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400 text-sm">Todavía no se ha generado ningún presupuesto.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2 font-medium">Nº</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Paciente</th>
                <th className="px-3 py-2 font-medium">Concepto</th>
                <th className="px-3 py-2 font-medium">Importe</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {presupuestos.map((p) => (
                <tr key={p.id} className="border-b border-gray-50">
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{p.numero}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fechaDDMMAAAA(p.fecha)}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{p.paciente_nombre}</td>
                  <td className="px-3 py-2 text-gray-600">{p.concepto}</td>
                  <td className="px-3 py-2 font-semibold" style={{ color: PUMPKIN }}>{eur(p.precio)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/presupuestos/${p.id}`} className="text-xs font-medium underline decoration-dotted" style={{ color: DENIM }}>
                      Ver / imprimir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

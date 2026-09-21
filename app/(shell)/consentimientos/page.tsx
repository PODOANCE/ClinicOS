'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/contexts/UserContext'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { getConsentimientos } from '@/lib/supabase/queries/consentimientos'
import { canUserAccess } from '@/lib/permissions/validation'
import type { Consentimiento, Rol } from '@/lib/types/models'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

function fechaDDMMAAAA(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export default function ConsentimientosPage() {
  const { user, loading: userLoading } = useUser()
  const [roles, setRoles] = useState<Rol[]>([])
  const [consentimientos, setConsentimientos] = useState<Consentimiento[]>([])
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
      setConsentimientos(await getConsentimientos())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando consentimientos')
    } finally {
      setLoading(false)
    }
  }

  const puedeVer = canUserAccess(roles, 'Consentimientos', 'ver')
  const puedeCrear = canUserAccess(roles, 'Consentimientos', 'crear')

  if (userLoading || loading) {
    return <div className="p-6 text-gray-500">Cargando consentimientos...</div>
  }
  if (!puedeVer) {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permiso para ver Consentimientos.</p>
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
          <h1 className="text-3xl font-bold" style={{ color: DENIM }}>Consentimientos</h1>
          <p className="text-gray-500 mt-1 text-sm">Se generan aquí, se imprimen y se firman a mano como hasta ahora.</p>
        </div>
        {puedeCrear && (
          <Link
            href="/consentimientos/nuevo"
            className="px-4 py-2 rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: PUMPKIN }}
          >
            + Nuevo consentimiento
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {consentimientos.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400 text-sm">Todavía no se ha generado ningún consentimiento.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Paciente</th>
                <th className="px-3 py-2 font-medium">Procedimiento</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {consentimientos.map((c) => (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{fechaDDMMAAAA(c.fecha)}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{c.paciente_nombre}</td>
                  <td className="px-3 py-2 text-gray-600">{c.procedimiento_titulo}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/consentimientos/${c.id}`} className="text-xs font-medium underline decoration-dotted" style={{ color: DENIM }}>
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

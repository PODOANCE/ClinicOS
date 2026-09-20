'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/contexts/UserContext'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { getRankingPacientes, type RankingPaciente } from '@/lib/supabase/queries/seguimiento'
import { isSystemAdmin } from '@/lib/permissions/validation'
import type { Rol } from '@/lib/types/models'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

const MEDALLAS = ['🥇', '🥈', '🥉']

function eur(n: number): string {
  return Math.round(n).toLocaleString('es-ES') + ' €'
}

export default function MejoresPacientesPage() {
  const { user, loading: userLoading } = useUser()

  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const anioActual = new Date().getFullYear()
  const [periodo, setPeriodo] = useState<number | null>(anioActual)
  const [ranking, setRanking] = useState<RankingPaciente[]>([])
  const [cargandoRanking, setCargandoRanking] = useState(false)

  useEffect(() => {
    if (user) cargarRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (user && roles.length > 0) cargarRanking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, periodo])

  async function cargarRoles() {
    if (!user) return
    try {
      setLoading(true)
      const rls = await getRolesUsuarioActual(user.id)
      setRoles(rls)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando permisos')
    } finally {
      setLoading(false)
    }
  }

  async function cargarRanking() {
    try {
      setCargandoRanking(true)
      setRanking(await getRankingPacientes(periodo, 20))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando el ranking')
    } finally {
      setCargandoRanking(false)
    }
  }

  const puedeVer = isSystemAdmin(roles)

  if (userLoading || loading) {
    return <div className="p-6 text-gray-500">Cargando...</div>
  }
  if (!puedeVer) {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permiso para ver esta página.</p>
      </div>
    )
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  const periodos: { valor: number | null; etiqueta: string }[] = [
    { valor: anioActual, etiqueta: String(anioActual) },
    { valor: anioActual - 1, etiqueta: String(anioActual - 1) },
    { valor: null, etiqueta: 'Todo (desde que hay datos)' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: DENIM }}>🏆 Mejores pacientes</h1>
        <p className="text-gray-500 mt-1 text-sm">Quién más se ha gastado en la clínica, por si os planteáis algún detalle o premio.</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {periodos.map((p) => (
          <button
            key={p.etiqueta}
            onClick={() => setPeriodo(p.valor)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold"
            style={
              periodo === p.valor
                ? { backgroundColor: DENIM, color: 'white' }
                : { backgroundColor: '#f4f7fb', color: DENIM }
            }
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {cargandoRanking ? (
          <p className="px-4 py-8 text-center text-gray-400 text-sm">Cargando ranking…</p>
        ) : ranking.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400 text-sm">No hay datos de gasto para este periodo.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Paciente</th>
                <th className="px-3 py-2 font-medium">Gasto</th>
                <th className="px-3 py-2 font-medium">Nº visitas</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.paciente_clave} className="border-b border-gray-50">
                  <td className="px-4 py-2 font-semibold text-gray-500">{MEDALLAS[i] ?? i + 1}</td>
                  <td className="px-3 py-2 font-medium">
                    <Link
                      href={`/pacientes/${encodeURIComponent(r.paciente_clave)}`}
                      className="hover:underline"
                      style={{ color: DENIM }}
                    >
                      {r.paciente_clave}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-semibold" style={{ color: PUMPKIN }}>{eur(r.gasto)}</td>
                  <td className="px-3 py-2 text-gray-600">{r.num_visitas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/lib/contexts/UserContext'
import {
  getHistorialPaciente,
  getGestionPorClave,
} from '@/lib/supabase/queries/seguimiento'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { getTelefonosPorClaves, getEdadesPorClaves } from '@/lib/supabase/queries/pacientes-telefono'
import { canUserAccess, esRolAdministracion } from '@/lib/permissions/validation'
import { fechaDDMMAAAA, GESTION_LABEL, enlaceWhatsapp } from '@/lib/services/seguimiento'
import type { SeguimientoCita, SeguimientoGestion, Rol } from '@/lib/types/models'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

function eur(n: number): string {
  return Math.round(n).toLocaleString('es-ES') + ' €'
}

export default function FichaPacientePage() {
  const params = useParams<{ clave: string }>()
  const pacienteClave = decodeURIComponent(params.clave)

  const { user, loading: userLoading } = useUser()
  const [roles, setRoles] = useState<Rol[]>([])
  const [historial, setHistorial] = useState<SeguimientoCita[]>([])
  const [gestion, setGestion] = useState<SeguimientoGestion | null>(null)
  const [telefono, setTelefono] = useState<string | null>(null)
  const [edad, setEdad] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pacienteClave])

  async function cargar() {
    if (!user) return
    try {
      setLoading(true)
      const rls = await getRolesUsuarioActual(user.id)
      setRoles(rls)

      const [hist, gest, edades] = await Promise.all([
        getHistorialPaciente(pacienteClave),
        getGestionPorClave(pacienteClave),
        getEdadesPorClaves([pacienteClave]),
      ])
      setHistorial(hist)
      setGestion(gest)
      setEdad(edades.get(pacienteClave) ?? null)

      if (esRolAdministracion(rls)) {
        const telefonos = await getTelefonosPorClaves([pacienteClave])
        setTelefono(telefonos.get(pacienteClave) ?? null)
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando la ficha del paciente')
    } finally {
      setLoading(false)
    }
  }

  const puedeVer = canUserAccess(roles, 'Seguimiento', 'ver')

  const resumen = useMemo(() => {
    const gastoTotal = historial.reduce((s, c) => s + (c.precio ?? 0), 0)
    const fechas = historial.map((c) => c.fecha).sort()
    const primeraVisita = fechas[0] ?? null
    const ultimaVisita = fechas[fechas.length - 1] ?? null

    const porTratamiento = new Map<string, { veces: number; total: number }>()
    for (const c of historial) {
      const actual = porTratamiento.get(c.tratamiento) ?? { veces: 0, total: 0 }
      actual.veces += 1
      actual.total += c.precio ?? 0
      porTratamiento.set(c.tratamiento, actual)
    }

    const porAnio = new Map<string, number>()
    for (const c of historial) {
      const anio = c.fecha.slice(0, 4)
      porAnio.set(anio, (porAnio.get(anio) ?? 0) + (c.precio ?? 0))
    }
    const anios = Array.from(porAnio.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    const maxAnio = Math.max(1, ...anios.map(([, total]) => total))

    return {
      gastoTotal,
      numVisitas: historial.length,
      primeraVisita,
      ultimaVisita,
      porTratamiento: Array.from(porTratamiento.entries()).sort((a, b) => b[1].total - a[1].total),
      anios,
      maxAnio,
    }
  }, [historial])

  const nombreMostrar = historial[0]?.paciente_raw ?? pacienteClave

  if (userLoading || loading) {
    return <div className="p-6 text-gray-500">Cargando ficha del paciente...</div>
  }
  if (!puedeVer) {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permiso para ver esta ficha.</p>
      </div>
    )
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <Link href="/seguimiento" className="text-xs font-medium underline decoration-dotted" style={{ color: PUMPKIN }}>
          ← Volver a Seguimiento
        </Link>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: DENIM }}>{nombreMostrar}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {edad !== null ? `${edad} años` : 'Edad no registrada'}
            {telefono ? ` · ${telefono}` : ''}
          </p>
        </div>
        {telefono && (
          <a
            href={enlaceWhatsapp(telefono, `Hola ${nombreMostrar} 👋, `)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-4 py-2 rounded-full text-white font-semibold flex-shrink-0"
            style={{ backgroundColor: '#25D366' }}
          >
            WhatsApp
          </a>
        )}
      </div>

      {historial.length === 0 ? (
        <p className="text-gray-500 text-sm">No hay tratamientos registrados para este paciente todavía.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="text-xs text-gray-500">💶 Gasto total</div>
              <div className="text-xl font-bold" style={{ color: DENIM }}>{eur(resumen.gastoTotal)}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="text-xs text-gray-500">Visitas</div>
              <div className="text-xl font-bold" style={{ color: DENIM }}>{resumen.numVisitas}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="text-xs text-gray-500">Primera visita</div>
              <div className="text-sm font-semibold text-gray-700">{fechaDDMMAAAA(resumen.primeraVisita)}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="text-xs text-gray-500">Última visita</div>
              <div className="text-sm font-semibold text-gray-700">{fechaDDMMAAAA(resumen.ultimaVisita)}</div>
            </div>
          </div>

          {gestion && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm">
                <span className="text-gray-500">Estado de recontacto (Seguimiento): </span>
                <span className="font-semibold" style={{ color: DENIM }}>{GESTION_LABEL[gestion.gestion_recontacto]}</span>
                {gestion.proximo_intento && (
                  <span className="text-gray-500"> · próximo intento {fechaDDMMAAAA(gestion.proximo_intento)}</span>
                )}
              </div>
              <Link href="/seguimiento" className="text-xs font-medium underline decoration-dotted" style={{ color: PUMPKIN }}>
                Gestionar en Seguimiento →
              </Link>
            </div>
          )}

          {resumen.anios.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-bold mb-3" style={{ color: DENIM }}>Gasto por año</h2>
              <div className="space-y-2">
                {resumen.anios.map(([anio, total]) => (
                  <div key={anio} className="flex items-center gap-3">
                    <div className="w-12 text-xs text-gray-500 flex-shrink-0">{anio}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(total / resumen.maxAnio) * 100}%`, backgroundColor: PUMPKIN }}
                      />
                    </div>
                    <div className="w-20 text-right text-xs font-semibold text-gray-700 flex-shrink-0">{eur(total)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2" style={{ backgroundColor: '#f4f7fb' }}>
              <h2 className="text-sm font-bold" style={{ color: DENIM }}>Gasto por tratamiento</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2 font-medium">Tratamiento</th>
                  <th className="px-3 py-2 font-medium">Veces</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {resumen.porTratamiento.map(([tratamiento, { veces, total }]) => (
                  <tr key={tratamiento} className="border-b border-gray-50">
                    <td className="px-4 py-2 text-gray-900">{tratamiento}</td>
                    <td className="px-3 py-2 text-gray-600">{veces}</td>
                    <td className="px-3 py-2 text-gray-600">{eur(total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2" style={{ backgroundColor: '#f4f7fb' }}>
              <h2 className="text-sm font-bold" style={{ color: DENIM }}>Historial de visitas</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Tratamiento</th>
                  <th className="px-3 py-2 font-medium">Precio</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50">
                    <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{fechaDDMMAAAA(c.fecha)}</td>
                    <td className="px-3 py-2 text-gray-600">{c.tratamiento}</td>
                    <td className="px-3 py-2 text-gray-600">{c.precio !== null ? eur(c.precio) : '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{c.estado_cita ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useUser } from '@/lib/contexts/UserContext'
import { createClient } from '@/lib/supabase/browser'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import {
  getPropuestasPendientes,
  aceptarPropuesta,
  rechazarPropuesta,
  type PropuestaConciliacion,
} from '@/lib/supabase/queries/conciliacion'
import { canUserAccess } from '@/lib/permissions/validation'
import type { Rol } from '@/lib/types/models'

// Mismo umbral que PARAMS.UMBRAL_VERDE en lib/services/conciliacion.ts —
// si se ajusta allí, ajustar también aquí.
const UMBRAL_VERDE = 80
const UMBRAL_AMBAR = 50

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

function esVerde(p: PropuestaConciliacion): boolean {
  return p.confianza >= UMBRAL_VERDE && p.diferencia === 0
}

function badgeConfianza(confianza: number): { label: string; className: string } {
  if (confianza >= UMBRAL_VERDE) return { label: `Alta confianza (${confianza})`, className: 'bg-emerald-100 text-emerald-800' }
  if (confianza >= UMBRAL_AMBAR) return { label: `Confianza media (${confianza})`, className: 'bg-amber-100 text-amber-800' }
  return { label: `Confianza baja (${confianza})`, className: 'bg-red-100 text-red-800' }
}

export default function ConciliacionPage() {
  const { user, loading: userLoading } = useUser()

  const [propuestas, setPropuestas] = useState<PropuestaConciliacion[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ejecutando, setEjecutando] = useState(false)
  const [ultimoResumen, setUltimoResumen] = useState<string | null>(null)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [resumenImportacion, setResumenImportacion] = useState<string | null>(null)
  const [erroresImportacion, setErroresImportacion] = useState<{ fila: number; motivo: string }[]>([])
  const inputArchivoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function cargar() {
    if (!user) return
    try {
      setLoading(true)
      const [prop, rls] = await Promise.all([getPropuestasPendientes(), getRolesUsuarioActual(user.id)])
      setPropuestas(prop)
      setRoles(rls)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando las propuestas de conciliación')
    } finally {
      setLoading(false)
    }
  }

  const puedeEditar = canUserAccess(roles, 'Facturas', 'editar')

  async function handleEjecutar() {
    setEjecutando(true)
    setUltimoResumen(null)
    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch('/api/conciliacion/ejecutar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error ejecutando la conciliación')

      setUltimoResumen(
        `${data.propuestas_creadas} propuesta(s) nueva(s) · ${data.sin_candidato} factura(s) sin movimiento · ${data.facturas_evaluadas} factura(s) evaluadas`
      )
      await cargar()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error ejecutando la conciliación')
    } finally {
      setEjecutando(false)
    }
  }

  async function handleImportar(archivo: File) {
    setImportando(true)
    setResumenImportacion(null)
    setErroresImportacion([])
    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const formData = new FormData()
      formData.append('archivo', archivo)

      const res = await fetch('/api/banco/importar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error importando el archivo')

      setResumenImportacion(
        `"${data.archivo}" · ${data.insertados} movimiento(s) nuevo(s) · ${data.yaExistentes} ya existente(s) de ${data.totalFilas} fila(s)` +
          (data.periodo ? ` · periodo ${data.periodo.desde} – ${data.periodo.hasta}` : '')
      )
      setErroresImportacion(data.errores ?? [])
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error importando el archivo')
    } finally {
      setImportando(false)
      if (inputArchivoRef.current) inputArchivoRef.current.value = ''
    }
  }

  async function handleAceptar(id: string) {
    if (!user) return
    setProcesandoId(id)
    try {
      await aceptarPropuesta(id, user.id)
      setPropuestas((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error aceptando la propuesta')
    } finally {
      setProcesandoId(null)
    }
  }

  async function handleRechazar(id: string) {
    if (!user) return
    if (!confirm('¿Rechazar esta propuesta? No volverá a proponerse este mismo emparejamiento.')) return
    setProcesandoId(id)
    try {
      await rechazarPropuesta(id, user.id)
      setPropuestas((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error rechazando la propuesta')
    } finally {
      setProcesandoId(null)
    }
  }

  if (userLoading || loading) {
    return <div className="p-6 text-gray-500">Cargando conciliación...</div>
  }

  if (!puedeEditar) {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permiso para ver Conciliación.</p>
      </div>
    )
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: DENIM }}>Conciliación</h1>
          <p className="text-gray-500 mt-1 text-sm">{propuestas.length} propuesta(s) por revisar</p>
        </div>
        <button
          onClick={handleEjecutar}
          disabled={ejecutando}
          className="px-4 py-2 rounded-full text-sm font-semibold transition-colors disabled:opacity-40"
          style={{ backgroundColor: DENIM, color: '#fff' }}
        >
          {ejecutando ? 'Ejecutando...' : '⚙️ Ejecutar conciliación'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold" style={{ color: PUMPKIN }}>📄 Importar movimientos bancarios (.xlsx)</span>
        <input
          ref={inputArchivoRef}
          type="file"
          accept=".xlsx"
          disabled={importando}
          onChange={(e) => {
            const archivo = e.target.files?.[0]
            if (archivo) handleImportar(archivo)
          }}
          className="text-sm"
        />
        {importando && <span className="text-sm text-gray-500">Importando...</span>}
      </div>

      {resumenImportacion && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-md px-4 py-2 space-y-1">
          <div>{resumenImportacion}</div>
          {erroresImportacion.length > 0 && (
            <ul className="list-disc list-inside text-xs text-blue-700">
              {erroresImportacion.map((e, i) => (
                <li key={i}>
                  Fila {e.fila}: {e.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {ultimoResumen && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-md px-4 py-2">
          {ultimoResumen}
        </div>
      )}

      {propuestas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center text-gray-400">
          No hay propuestas pendientes de revisar.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          {propuestas.map((p) => {
            const verde = esVerde(p)
            const procesando = procesandoId === p.id
            const badge = badgeConfianza(p.confianza)
            return (
              <div key={p.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                <span
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${verde ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  title={verde ? 'Alta confianza' : 'Revisar con atención'}
                />
                <div className="flex-1 min-w-0 grid md:grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase">Factura</div>
                    <div className="font-medium text-gray-900">{p.factura.numero_factura}</div>
                    <div className="text-sm text-gray-600">
                      {p.factura.proveedor_nombre ?? 'Sin proveedor'} · {p.factura.importe_total?.toFixed(2)} € ·{' '}
                      {p.factura.fecha_emision}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase">Movimiento bancario</div>
                    <div className="font-medium text-gray-900">{p.movimiento.concepto}</div>
                    <div className="text-sm text-gray-600">
                      {p.movimiento.importe?.toFixed(2)} € · {p.movimiento.fecha}
                    </div>
                  </div>
                </div>
                <div className="md:w-64 space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.diferencia === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.diferencia === 0 ? 'Importe exacto' : `Dif. ${p.diferencia.toFixed(2)} €`}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{p.notas_revision}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleAceptar(p.id)}
                    disabled={procesando}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-full text-sm font-semibold disabled:opacity-40"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => handleRechazar(p.id)}
                    disabled={procesando}
                    className="px-3 py-1.5 border border-gray-300 rounded-full text-sm font-semibold text-red-600 disabled:opacity-40"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

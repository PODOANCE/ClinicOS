'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/contexts/UserContext'
import { getUserCentro } from '@/lib/supabase/queries/tasks'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { getTemas, getVariantes, crearPresupuesto, getPresupuestos } from '@/lib/supabase/queries/presupuestos'
import { canUserAccess } from '@/lib/permissions/validation'
import type { PresupuestoTema, PresupuestoVariante, Rol } from '@/lib/types/models'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

function eur(n: number): string {
  return Math.round(n).toLocaleString('es-ES') + ' €'
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function NuevoPresupuestoPage() {
  const { user, loading: userLoading } = useUser()
  const router = useRouter()

  const [centroId, setCentroId] = useState<string | null>(null)
  const [roles, setRoles] = useState<Rol[]>([])
  const [temas, setTemas] = useState<PresupuestoTema[]>([])
  const [variantes, setVariantes] = useState<PresupuestoVariante[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [temaId, setTemaId] = useState('')
  const [varianteId, setVarianteId] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [pacienteNombre, setPacienteNombre] = useState('')
  const [pacienteDni, setPacienteDni] = useState('')
  const [pacienteDireccion, setPacienteDireccion] = useState('')

  useEffect(() => {
    if (user) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function cargar() {
    if (!user) return
    try {
      setLoading(true)
      const [ce, rls, ts, vs] = await Promise.all([
        getUserCentro(user.id),
        getRolesUsuarioActual(user.id),
        getTemas(),
        getVariantes(),
      ])
      setCentroId(ce)
      setRoles(rls)
      setTemas(ts)
      setVariantes(vs)
      if (ts.length > 0) setTemaId(ts[0].id)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando el catálogo de presupuestos')
    } finally {
      setLoading(false)
    }
  }

  const puedeCrear = canUserAccess(roles, 'Presupuestos', 'crear')

  const variantesDelTema = useMemo(() => variantes.filter((v) => v.tema_id === temaId), [variantes, temaId])
  const variante = useMemo(() => variantes.find((v) => v.id === varianteId) ?? null, [variantes, varianteId])

  useEffect(() => {
    if (variantesDelTema.length > 0 && !variantesDelTema.some((v) => v.id === varianteId)) {
      setVarianteId(variantesDelTema[0].id)
    }
  }, [variantesDelTema, varianteId])

  async function handleGuardar() {
    if (!user || !centroId || !variante || !pacienteNombre.trim()) return
    setGuardando(true)
    try {
      const anio = new Date(fecha).getFullYear()
      const yaExistentes = (await getPresupuestos()).filter((p) => p.numero.startsWith(`PRES-${anio}-`))
      const siguiente = yaExistentes.length + 1
      const numero = `PRES-${anio}-${String(siguiente).padStart(4, '0')}`

      const creado = await crearPresupuesto({
        numero,
        fecha,
        pacienteNombre: pacienteNombre.trim(),
        pacienteDni: pacienteDni.trim() || null,
        pacienteDireccion: pacienteDireccion.trim() || null,
        pacienteClave: null,
        temaId: temaId || null,
        varianteId: variante.id,
        concepto: variante.nombre,
        precio: variante.precio,
        centroId,
        actorId: user.id,
      })
      router.push(`/presupuestos/${creado.id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error creando el presupuesto')
    } finally {
      setGuardando(false)
    }
  }

  if (userLoading || loading) {
    return <div className="p-6 text-gray-500">Cargando...</div>
  }
  if (!puedeCrear) {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permiso para crear presupuestos.</p>
      </div>
    )
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: DENIM }}>Nuevo presupuesto</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tema</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              value={temaId}
              onChange={(e) => setTemaId(e.target.value)}
            >
              {temas.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Variante</label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            value={varianteId}
            onChange={(e) => setVarianteId(e.target.value)}
          >
            {variantesDelTema.map((v) => (
              <option key={v.id} value={v.id}>{v.nombre} — {eur(v.precio)}</option>
            ))}
          </select>
        </div>

        <hr className="border-gray-100" />

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del paciente</label>
          <input
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            value={pacienteNombre}
            onChange={(e) => setPacienteNombre(e.target.value)}
            placeholder="Nombre y apellidos"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">DNI (opcional)</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              value={pacienteDni}
              onChange={(e) => setPacienteDni(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dirección (opcional)</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              value={pacienteDireccion}
              onChange={(e) => setPacienteDireccion(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleGuardar}
          disabled={guardando || !pacienteNombre.trim() || !variante}
          className="px-5 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: PUMPKIN }}
        >
          {guardando ? 'Creando…' : `Generar presupuesto (${variante ? eur(variante.precio) : '—'})`}
        </button>
      </div>
    </div>
  )
}

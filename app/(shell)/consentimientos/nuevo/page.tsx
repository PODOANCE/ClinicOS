'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/contexts/UserContext'
import { getUserCentro } from '@/lib/supabase/queries/tasks'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { getTemasConsentimiento, getVariantesConsentimiento, crearConsentimiento } from '@/lib/supabase/queries/consentimientos'
import { canUserAccess } from '@/lib/permissions/validation'
import type { ConsentimientoTema, ConsentimientoVariante, Rol } from '@/lib/types/models'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function NuevoConsentimientoPage() {
  const { user, loading: userLoading } = useUser()
  const router = useRouter()

  const [centroId, setCentroId] = useState<string | null>(null)
  const [roles, setRoles] = useState<Rol[]>([])
  const [temas, setTemas] = useState<ConsentimientoTema[]>([])
  const [variantes, setVariantes] = useState<ConsentimientoVariante[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [temaId, setTemaId] = useState('')
  const [varianteId, setVarianteId] = useState('')
  const [procedimientoTitulo, setProcedimientoTitulo] = useState('')
  const [descripcionColoquial, setDescripcionColoquial] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [pacienteNombre, setPacienteNombre] = useState('')
  const [pacienteNif, setPacienteNif] = useState('')
  const [pacienteTelefono, setPacienteTelefono] = useState('')
  const [pacienteHistoriaClinica, setPacienteHistoriaClinica] = useState('')
  const [podologos, setPodologos] = useState('')

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
        getTemasConsentimiento(),
        getVariantesConsentimiento(),
      ])
      setCentroId(ce)
      setRoles(rls)
      setTemas(ts)
      setVariantes(vs)
      if (ts.length > 0) setTemaId(ts[0].id)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando el catálogo de consentimientos')
    } finally {
      setLoading(false)
    }
  }

  const puedeCrear = canUserAccess(roles, 'Consentimientos', 'crear')

  const variantesDelTema = useMemo(() => variantes.filter((v) => v.tema_id === temaId), [variantes, temaId])
  const tema = useMemo(() => temas.find((t) => t.id === temaId) ?? null, [temas, temaId])

  useEffect(() => {
    if (variantesDelTema.length > 0 && !variantesDelTema.some((v) => v.id === varianteId)) {
      setVarianteId(variantesDelTema[0].id)
    }
  }, [variantesDelTema, varianteId])

  // Al elegir variante, precarga su texto — pero se puede retocar a mano
  // antes de generar (por si el caso concreto necesita un matiz).
  useEffect(() => {
    const v = variantesDelTema.find((v) => v.id === varianteId)
    if (v) {
      setProcedimientoTitulo(v.procedimiento_titulo)
      setDescripcionColoquial(v.descripcion_coloquial)
    }
  }, [varianteId, variantesDelTema])

  async function handleGuardar() {
    if (!user || !centroId || !tema || !pacienteNombre.trim() || !podologos.trim()) return
    setGuardando(true)
    try {
      const creado = await crearConsentimiento({
        fecha,
        pacienteNombre: pacienteNombre.trim(),
        pacienteNif: pacienteNif.trim() || null,
        pacienteTelefono: pacienteTelefono.trim() || null,
        pacienteHistoriaClinica: pacienteHistoriaClinica.trim() || null,
        pacienteClave: null,
        podologos: podologos.trim(),
        temaId: tema.id,
        varianteId: varianteId || null,
        procedimientoTitulo: procedimientoTitulo.trim(),
        descripcionColoquial: descripcionColoquial.trim(),
        centroId,
        actorId: user.id,
      })
      router.push(`/consentimientos/${creado.id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error creando el consentimiento')
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
        <p className="text-red-600">No tienes permiso para crear consentimientos.</p>
      </div>
    )
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: DENIM }}>Nuevo consentimiento</h1>
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
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Título del procedimiento (se puede ajustar)</label>
          <input
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            value={procedimientoTitulo}
            onChange={(e) => setProcedimientoTitulo(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción coloquial (se puede ajustar)</label>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            rows={2}
            value={descripcionColoquial}
            onChange={(e) => setDescripcionColoquial(e.target.value)}
          />
        </div>

        <hr className="border-gray-100" />

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Podólogo/a que informa</label>
          <input
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            value={podologos}
            onChange={(e) => setPodologos(e.target.value)}
            placeholder="Ej. Paula Castillo Carpio, o Paula Castillo Carpio y Andrés Sales Aguilar"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del paciente</label>
          <input
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            value={pacienteNombre}
            onChange={(e) => setPacienteNombre(e.target.value)}
            placeholder="Nombre y apellidos"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">NIF (opcional)</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              value={pacienteNif}
              onChange={(e) => setPacienteNif(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono (opcional)</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              value={pacienteTelefono}
              onChange={(e) => setPacienteTelefono(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nº historia clínica (opcional)</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              value={pacienteHistoriaClinica}
              onChange={(e) => setPacienteHistoriaClinica(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleGuardar}
          disabled={guardando || !pacienteNombre.trim() || !podologos.trim()}
          className="px-5 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: PUMPKIN }}
        >
          {guardando ? 'Generando…' : 'Generar consentimiento'}
        </button>
      </div>
    </div>
  )
}

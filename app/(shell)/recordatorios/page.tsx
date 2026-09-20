'use client'

import { useEffect, useRef, useState } from 'react'
import { useUser } from '@/lib/contexts/UserContext'
import { createClient } from '@/lib/supabase/browser'
import { getUserCentro } from '@/lib/supabase/queries/tasks'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { getRecordatoriosPlantilla, actualizarRecordatoriosPlantilla } from '@/lib/supabase/queries/recordatorios'
import { canUserAccess, esRolAdministracion } from '@/lib/permissions/validation'
import type { Rol } from '@/lib/types/models'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

interface MensajeRecordatorio {
  paciente: string
  hora: string | null
  profesional: string | null
  telefono: string | null
  mensaje: string
  enlaceWhatsapp: string | null
}

function manana(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default function RecordatoriosPage() {
  const { user, loading: userLoading } = useUser()

  const [centroId, setCentroId] = useState<string | null>(null)
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [plantilla, setPlantilla] = useState('')
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false)
  const [avisoPlantilla, setAvisoPlantilla] = useState<string | null>(null)

  const [fecha, setFecha] = useState(manana())
  const [generando, setGenerando] = useState(false)
  const [errorGenerar, setErrorGenerar] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<MensajeRecordatorio[] | null>(null)
  const [tieneTelefonos, setTieneTelefonos] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
  const inputArchivoRef = useRef<HTMLInputElement>(null)

  const [importandoTelefonos, setImportandoTelefonos] = useState(false)
  const [resultadoTelefonos, setResultadoTelefonos] = useState<string | null>(null)
  const inputTelefonosRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function cargar() {
    if (!user) return
    try {
      setLoading(true)
      const [ce, rls] = await Promise.all([getUserCentro(user.id), getRolesUsuarioActual(user.id)])
      setCentroId(ce)
      setRoles(rls)
      if (ce) {
        const p = await getRecordatoriosPlantilla(ce, 'CITA_MANANA')
        setPlantilla(p?.texto ?? '')
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando recordatorios')
    } finally {
      setLoading(false)
    }
  }

  // Maneja teléfonos de pacientes: solo administración, no podólogos/ortopedas.
  const puedeVer = canUserAccess(roles, 'Seguimiento', 'ver') && esRolAdministracion(roles)
  const puedeEditar = canUserAccess(roles, 'Seguimiento', 'editar') && esRolAdministracion(roles)

  async function handleGuardarPlantilla() {
    if (!user || !centroId) return
    setGuardandoPlantilla(true)
    try {
      await actualizarRecordatoriosPlantilla({ centroId, tipo: 'CITA_MANANA', texto: plantilla, actorId: user.id })
      setAvisoPlantilla('Plantilla guardada.')
      setTimeout(() => setAvisoPlantilla(null), 3000)
    } catch (err) {
      setAvisoPlantilla(err instanceof Error ? err.message : 'Error guardando la plantilla')
    } finally {
      setGuardandoPlantilla(false)
    }
  }

  async function handleGenerar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setGenerando(true)
    setErrorGenerar(null)
    setMensajes(null)
    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const formData = new FormData()
      formData.append('archivo', archivo)
      formData.append('fecha', fecha)

      const res = await fetch('/api/recordatorios/generar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error generando los recordatorios')

      setMensajes(data.mensajes)
      setTieneTelefonos(data.tieneTelefonos)
    } catch (err) {
      setErrorGenerar(err instanceof Error ? err.message : 'Error generando los recordatorios')
    } finally {
      setGenerando(false)
      if (inputArchivoRef.current) inputArchivoRef.current.value = ''
    }
  }

  async function handleImportarTelefonos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setImportandoTelefonos(true)
    setResultadoTelefonos(null)
    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const formData = new FormData()
      formData.append('archivo', archivo)

      const res = await fetch('/api/pacientes-telefono/importar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error importando el listado')

      setResultadoTelefonos(`${data.guardados} teléfonos guardados de ${data.totalFilas} pacientes en el listado.`)
    } catch (err) {
      setResultadoTelefonos(err instanceof Error ? err.message : 'Error importando el listado')
    } finally {
      setImportandoTelefonos(false)
      if (inputTelefonosRef.current) inputTelefonosRef.current.value = ''
    }
  }

  async function copiarMensaje(clave: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(clave)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      alert('No se pudo copiar. Selecciona el texto a mano.')
    }
  }

  if (userLoading || loading) {
    return <div className="p-6 text-gray-500">Cargando recordatorios...</div>
  }
  if (!puedeVer) {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permiso para ver Recordatorios.</p>
      </div>
    )
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: DENIM }}>Recordatorios</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Genera el texto de recordatorio de las citas de un día, listo para copiar y enviar por WhatsApp a mano.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
        <h2 className="font-semibold text-sm" style={{ color: DENIM }}>Plantilla del mensaje</h2>
        <p className="text-xs text-gray-500">
          Usa <code className="bg-gray-100 px-1 rounded">{'{nombre}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{fecha}'}</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">{'{hora}'}</code> y <code className="bg-gray-100 px-1 rounded">{'{profesional}'}</code> donde
          quieras que se rellenen los datos de cada cita. El resto del texto es siempre igual.
        </p>
        <textarea
          value={plantilla}
          onChange={(e) => setPlantilla(e.target.value)}
          disabled={!puedeEditar}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        {puedeEditar && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleGuardarPlantilla}
              disabled={guardandoPlantilla}
              className="px-4 py-1.5 rounded-full text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: DENIM }}
            >
              {guardandoPlantilla ? 'Guardando…' : 'Guardar plantilla'}
            </button>
            {avisoPlantilla && <span className="text-xs text-gray-500">{avisoPlantilla}</span>}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
        <h2 className="font-semibold text-sm" style={{ color: DENIM }}>Teléfonos de pacientes</h2>
        <p className="text-xs text-gray-500">
          Sube de vez en cuando el listado de pacientes de Organízate (con teléfono) para que los recordatorios
          puedan abrir WhatsApp directo. No hace falta subirlo cada día, solo cuando quieras refrescarlo.
        </p>
        {puedeEditar && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => inputTelefonosRef.current?.click()}
              disabled={importandoTelefonos}
              className="px-4 py-1.5 rounded-full text-sm font-semibold border border-gray-300 text-gray-700 disabled:opacity-50"
            >
              {importandoTelefonos ? 'Importando…' : '📇 Subir listado de pacientes'}
            </button>
            <input
              ref={inputTelefonosRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleImportarTelefonos}
            />
            {resultadoTelefonos && <span className="text-xs text-gray-500">{resultadoTelefonos}</span>}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
        <h2 className="font-semibold text-sm" style={{ color: DENIM }}>Generar recordatorios de un día</h2>
        <p className="text-xs text-gray-500">
          Sube el export de "Citas" de Organízate del día que quieras recordar (normalmente, el de mañana).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600">
            Día:{' '}
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm ml-1"
            />
          </label>
          <button
            onClick={() => inputArchivoRef.current?.click()}
            disabled={generando}
            className="px-4 py-1.5 rounded-full text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: PUMPKIN }}
          >
            {generando ? 'Generando…' : '📥 Subir export y generar'}
          </button>
          <input ref={inputArchivoRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleGenerar} />
        </div>
        {errorGenerar && <p className="text-xs text-red-600">{errorGenerar}</p>}
      </div>

      {mensajes && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2 flex items-center justify-between" style={{ backgroundColor: '#f4f7fb' }}>
            <h3 className="text-sm font-bold" style={{ color: DENIM }}>
              {mensajes.length} cita{mensajes.length === 1 ? '' : 's'} para {fecha}
            </h3>
            {!tieneTelefonos && (
              <span className="text-xs text-gray-500">
                Sin teléfono en el archivo: copia el texto y busca el contacto a mano en WhatsApp.
              </span>
            )}
          </div>
          {mensajes.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">No hay citas ese día en el archivo subido.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {mensajes.map((m, i) => {
                const clave = `${m.paciente}-${i}`
                return (
                  <div key={clave} className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="sm:w-48 flex-shrink-0">
                      <div className="font-medium text-gray-900">{m.paciente}</div>
                      <div className="text-xs text-gray-500">
                        {m.hora ?? '—'} · {m.profesional ?? '—'}
                      </div>
                    </div>
                    <div className="flex-1 text-sm text-gray-700 whitespace-pre-wrap">{m.mensaje}</div>
                    <div className="flex-shrink-0 flex gap-2">
                      <button
                        onClick={() => copiarMensaje(clave, m.mensaje)}
                        className="text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        {copiado === clave ? '✓ Copiado' : 'Copiar'}
                      </button>
                      {m.enlaceWhatsapp && (
                        <a
                          href={m.enlaceWhatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 rounded-full text-white"
                          style={{ backgroundColor: '#25D366' }}
                        >
                          Abrir WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

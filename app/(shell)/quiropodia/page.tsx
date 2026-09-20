'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/contexts/UserContext'
import { getUserCentro } from '@/lib/supabase/queries/tasks'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { getCitasQuiropodia, getUltimasVisitasPorPaciente } from '@/lib/supabase/queries/seguimiento'
import { getRecordatoriosPlantilla, actualizarRecordatoriosPlantilla } from '@/lib/supabase/queries/recordatorios'
import { getTelefonosPorClaves } from '@/lib/supabase/queries/pacientes-telefono'
import { canUserAccess, esRolAdministracion } from '@/lib/permissions/validation'
import { fechaDDMMAAAA, enlaceWhatsapp, mesesEntre, aFecha } from '@/lib/services/seguimiento'
import { calcularQuiropodia, UMBRAL_MESES_QUIROPODIA, type PacienteQuiropodia } from '@/lib/services/quiropodia'
import type { SeguimientoCita, Rol } from '@/lib/types/models'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

// Si estuvo en la clínica hace menos de esto (por otro motivo: plantillas,
// láser...), se avisa para no decirle "hace tiempo que no te vemos" a
// alguien que en realidad vino la semana pasada.
const MESES_AVISO_VISITA_RECIENTE = 3

const PLANTILLA_DEFECTO =
  'Hola {nombre} 👋, hace tiempo que no te vemos por Podología y Biomecánica Rivas para tu revisión de quiropodia. ¿Te viene bien que te agendemos una cita? Contesta a este mensaje y te lo organizamos. ¡Un saludo!'

export default function QuiropodiaPage() {
  const { user, loading: userLoading } = useUser()

  const [centroId, setCentroId] = useState<string | null>(null)
  const [roles, setRoles] = useState<Rol[]>([])
  const [citas, setCitas] = useState<SeguimientoCita[]>([])
  const [ultimasVisitas, setUltimasVisitas] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [plantilla, setPlantilla] = useState(PLANTILLA_DEFECTO)
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false)
  const [avisoPlantilla, setAvisoPlantilla] = useState<string | null>(null)

  const [generando, setGenerando] = useState(false)
  const [mensajes, setMensajes] = useState<{ paciente: string; telefono: string | null; mensaje: string; enlace: string | null }[] | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => {
    if (user) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function cargar() {
    if (!user) return
    try {
      setLoading(true)
      const [ce, rls, cts, ultimas] = await Promise.all([
        getUserCentro(user.id),
        getRolesUsuarioActual(user.id),
        getCitasQuiropodia(),
        getUltimasVisitasPorPaciente(),
      ])
      setCentroId(ce)
      setRoles(rls)
      setCitas(cts)
      setUltimasVisitas(ultimas)
      if (ce) {
        const p = await getRecordatoriosPlantilla(ce, 'QUIROPODIA')
        setPlantilla(p?.texto ?? PLANTILLA_DEFECTO)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando Quiropodia')
    } finally {
      setLoading(false)
    }
  }

  const puedeVer = canUserAccess(roles, 'Seguimiento', 'ver') && esRolAdministracion(roles)
  const puedeEditar = canUserAccess(roles, 'Seguimiento', 'editar') && esRolAdministracion(roles)

  const pendientes: PacienteQuiropodia[] = useMemo(() => {
    return calcularQuiropodia(citas).filter((p) => p.meses_desde_ultima >= UMBRAL_MESES_QUIROPODIA)
  }, [citas])

  async function handleGuardarPlantilla() {
    if (!user || !centroId) return
    setGuardandoPlantilla(true)
    try {
      await actualizarRecordatoriosPlantilla({ centroId, tipo: 'QUIROPODIA', texto: plantilla, actorId: user.id })
      setAvisoPlantilla('Plantilla guardada.')
      setTimeout(() => setAvisoPlantilla(null), 3000)
    } catch (err) {
      setAvisoPlantilla(err instanceof Error ? err.message : 'Error guardando la plantilla')
    } finally {
      setGuardandoPlantilla(false)
    }
  }

  async function handleGenerar() {
    setGenerando(true)
    try {
      const claves = pendientes.map((p) => p.paciente_clave)
      const telefonos = await getTelefonosPorClaves(claves)
      const generados = pendientes.map((p) => {
        const telefono = telefonos.get(p.paciente_clave) ?? null
        const mensaje = plantilla.replace(/\{nombre\}/g, p.nombre_mostrar)
        return {
          paciente: p.nombre_mostrar,
          telefono,
          mensaje,
          enlace: telefono ? enlaceWhatsapp(telefono, mensaje) : null,
        }
      })
      setMensajes(generados)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error generando los mensajes')
    } finally {
      setGenerando(false)
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
    return <div className="p-6 text-gray-500">Cargando Quiropodia...</div>
  }
  if (!puedeVer) {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permiso para ver Quiropodia.</p>
      </div>
    )
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: DENIM }}>Quiropodia</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Aviso anual: pacientes sin visita de quiropodia desde hace {UMBRAL_MESES_QUIROPODIA} meses o más.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
        <h2 className="font-semibold text-sm" style={{ color: DENIM }}>Plantilla del mensaje</h2>
        <p className="text-xs text-gray-500">
          Usa <code className="bg-gray-100 px-1 rounded">{'{nombre}'}</code> donde quieras el nombre del paciente.
        </p>
        <textarea
          value={plantilla}
          onChange={(e) => setPlantilla(e.target.value)}
          disabled={!puedeEditar}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-3 flex-wrap">
          {puedeEditar && (
            <button
              onClick={handleGuardarPlantilla}
              disabled={guardandoPlantilla}
              className="px-4 py-1.5 rounded-full text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: DENIM }}
            >
              {guardandoPlantilla ? 'Guardando…' : 'Guardar plantilla'}
            </button>
          )}
          <button
            onClick={handleGenerar}
            disabled={generando || pendientes.length === 0}
            className="px-4 py-1.5 rounded-full text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: PUMPKIN }}
          >
            {generando ? 'Generando…' : `Generar ${pendientes.length} mensajes`}
          </button>
          {avisoPlantilla && <span className="text-xs text-gray-500">{avisoPlantilla}</span>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2" style={{ backgroundColor: '#f4f7fb' }}>
          <h2 className="text-sm font-bold" style={{ color: DENIM }}>{pendientes.length} pacientes por recontactar</h2>
        </div>
        {pendientes.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400 text-sm">Nadie lleva {UMBRAL_MESES_QUIROPODIA}+ meses sin venir a quiropodia ahora mismo.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2 font-medium">Paciente</th>
                <th className="px-3 py-2 font-medium">Última cita quiropodia</th>
                <th className="px-3 py-2 font-medium">Meses sin venir</th>
                <th className="px-3 py-2 font-medium">Última vez en la clínica</th>
                <th className="px-3 py-2 font-medium">Nº visitas</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.map((p) => {
                const ultimaClinica = ultimasVisitas.get(p.paciente_clave) ?? null
                const mesesClinica = ultimaClinica ? mesesEntre(aFecha(ultimaClinica), new Date()) : null
                const vinoHacePoco = mesesClinica !== null && mesesClinica < MESES_AVISO_VISITA_RECIENTE
                return (
                  <tr key={p.paciente_clave} className="border-b border-gray-50">
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/pacientes/${encodeURIComponent(p.paciente_clave)}`} className="hover:underline" style={{ color: DENIM }}>
                        {p.nombre_mostrar}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fechaDDMMAAAA(p.ultima_visita)}</td>
                    <td className="px-3 py-2 text-gray-600">{p.meses_desde_ultima}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={vinoHacePoco ? 'text-amber-700 font-semibold' : 'text-gray-600'}>
                        {fechaDDMMAAAA(ultimaClinica)}
                      </span>
                      {vinoHacePoco && (
                        <span
                          className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full"
                          title="Estuvo en la clínica hace poco por otro motivo — revisa antes de decir que hace tiempo que no viene."
                        >
                          ⚠️ vino hace poco (otro motivo)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{p.num_visitas}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {mensajes && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-bold" style={{ color: DENIM }}>Mensajes generados</h2>
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {mensajes.map((m, i) => {
              const clave = `${m.paciente}-${i}`
              return (
                <div key={clave} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="sm:w-40 flex-shrink-0 font-medium text-gray-900 text-sm">{m.paciente}</div>
                  <div className="flex-1 text-xs text-gray-600">{m.mensaje}</div>
                  <div className="flex-shrink-0 flex gap-2">
                    <button
                      onClick={() => copiarMensaje(clave, m.mensaje)}
                      className="text-xs px-3 py-1 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      {copiado === clave ? '✓ Copiado' : 'Copiar'}
                    </button>
                    {m.enlace ? (
                      <a
                        href={m.enlace}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1 rounded-full text-white"
                        style={{ backgroundColor: '#25D366' }}
                      >
                        WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400 px-1">sin teléfono</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

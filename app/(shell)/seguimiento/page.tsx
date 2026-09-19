'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '@/lib/contexts/UserContext'
import { createClient } from '@/lib/supabase/browser'
import { getUserCentro } from '@/lib/supabase/queries/tasks'
import { getSeguimientoCitas, getSeguimientoGestion, actualizarGestion } from '@/lib/supabase/queries/seguimiento'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { getRecordatoriosPlantilla, actualizarRecordatoriosPlantilla } from '@/lib/supabase/queries/recordatorios'
import { getTelefonosPorClaves, getEdadesPorClaves } from '@/lib/supabase/queries/pacientes-telefono'
import { canUserAccess } from '@/lib/permissions/validation'
import {
  calcularSeguimiento,
  calcularResumen,
  calcularResumenPorPodologo,
  type PacienteSeguimiento,
} from '@/lib/services/seguimiento'
import type { SeguimientoCita, SeguimientoGestion, SeguimientoGestionEstado, Rol } from '@/lib/types/models'

// Mismo criterio que wa.me: sin "+" ni espacios, con prefijo de país (se
// asume España si el número guardado no trae ya uno).
function enlaceWhatsapp(telefono: string, mensaje: string): string {
  const digitos = telefono.replace(/[^\d]/g, '')
  const conPrefijo = digitos.length === 9 ? `34${digitos}` : digitos
  return `https://wa.me/${conPrefijo}?text=${encodeURIComponent(mensaje)}`
}

// Todas las fechas de esta página vienen en ISO (aaaa-mm-dd) de la base de
// datos; se muestran en DD/MM/AAAA para que no haya lío con el formato.
function fechaDDMMAAAA(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

const GESTION_LABEL: Record<SeguimientoGestionEstado, string> = {
  PENDIENTE: 'Pendiente',
  LLAMADO_NO_CONTESTA: 'Llamada - no contesta',
  CANCELA_TODO_OK: 'Llamada - cancela la revisión (todo ok)',
  RECHAZA: 'Llamada - rechaza la revisión',
  CITA_AGENDADA: 'Cita agendada',
  VOLVER_A_LLAMAR: 'Volver a llamar',
}

// Precio real de una revisión (mismo que en el Excel/Panel de Control):
// cada vez que se marca "Cita agendada" es una revisión que hemos
// recuperado en vez de perderla.
const PRECIO_REVISION = 45

type FiltroEstado = 'TODOS' | 'SIN_CITA' | 'CITADA'
type FiltroPrioridad = 'TODAS' | 'SIN_REVISION' | 'VENCIDA' | 'AL_DIA'
type CampoOrden =
  | 'podologo_estudio'
  | 'tipo'
  | 'edad'
  | 'plantillas'
  | 'primer_estudio'
  | 'ultima_cita'
  | 'meses'
  | 'num_revisiones'
  | 'estado'
  | 'prioridad'

function badgeEstado(estado: string) {
  if (estado === 'Revisión citada') return 'bg-emerald-100 text-emerald-800'
  return 'bg-red-100 text-red-800'
}

function badgePrioridad(prioridad: string) {
  if (prioridad === 'Sin revisión previa') return 'bg-amber-100 text-amber-800'
  if (prioridad === 'VENCIDA') return 'bg-red-100 text-red-800'
  if (prioridad === 'Al día') return 'bg-emerald-100 text-emerald-800'
  return 'bg-gray-100 text-gray-500'
}

const ORDEN_PRIORIDAD: Record<string, number> = {
  'Sin revisión previa': 0,
  VENCIDA: 1,
  'Al día': 2,
  '—': 3,
}

function compararCampo(
  a: PacienteSeguimiento,
  b: PacienteSeguimiento,
  campo: CampoOrden,
  edades: Map<string, number>
): number {
  switch (campo) {
    case 'podologo_estudio':
      return (a.podologo_estudio ?? '').localeCompare(b.podologo_estudio ?? '', 'es')
    case 'tipo':
      return a.tipo.localeCompare(b.tipo, 'es')
    case 'edad': {
      const ea = edades.get(a.paciente_clave) ?? -1
      const eb = edades.get(b.paciente_clave) ?? -1
      return ea - eb
    }
    case 'plantillas':
      return Number(a.lleva_plantillas) - Number(b.lleva_plantillas)
    case 'primer_estudio':
      return (a.primer_estudio ?? '').localeCompare(b.primer_estudio ?? '')
    case 'ultima_cita':
      return (a.ultima_cita ?? '').localeCompare(b.ultima_cita ?? '')
    case 'meses':
      return (a.meses_desde_ultima ?? -1) - (b.meses_desde_ultima ?? -1)
    case 'num_revisiones':
      return a.num_revisiones - b.num_revisiones
    case 'estado':
      return a.estado.localeCompare(b.estado, 'es')
    case 'prioridad': {
      const diff = ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad]
      if (diff !== 0) return diff
      // Con la misma prioridad, quien lleva plantillas va primero: es más
      // importante no dejarlo a su aire que a alguien que solo se hizo el estudio.
      if (a.lleva_plantillas !== b.lleva_plantillas) return a.lleva_plantillas ? -1 : 1
      return (b.meses_desde_ultima ?? 0) - (a.meses_desde_ultima ?? 0)
    }
  }
}

function CabeceraOrdenable({
  campo,
  ordenCampo,
  ordenAsc,
  onClick,
  children,
  className,
}: {
  campo: CampoOrden
  ordenCampo: CampoOrden
  ordenAsc: boolean
  onClick: (campo: CampoOrden) => void
  children: React.ReactNode
  className?: string
}) {
  const activo = ordenCampo === campo
  return (
    <th className={`px-3 py-2 font-medium ${className ?? ''}`}>
      <button
        onClick={() => onClick(campo)}
        className={`flex items-center gap-1 hover:text-gray-800 whitespace-nowrap ${activo ? 'text-gray-800' : ''}`}
      >
        {children}
        <span className="text-[10px] w-2.5 inline-block">{activo ? (ordenAsc ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  )
}

export default function SeguimientoPage() {
  const { user, loading: userLoading } = useUser()

  const [citas, setCitas] = useState<SeguimientoCita[]>([])
  const [gestiones, setGestiones] = useState<SeguimientoGestion[]>([])
  const [edadesPorClave, setEdadesPorClave] = useState<Map<string, number>>(new Map())
  const [centroId, setCentroId] = useState<string | null>(null)
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('SIN_CITA')
  const [filtroPrioridad, setFiltroPrioridad] = useState<FiltroPrioridad>('TODAS')
  const [filtroPodologo, setFiltroPodologo] = useState<string>('TODOS')
  const [soloConPlantillas, setSoloConPlantillas] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarResumen, setMostrarResumen] = useState(false)
  const [ordenCampo, setOrdenCampo] = useState<CampoOrden>('prioridad')
  const [ordenAsc, setOrdenAsc] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)

  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState<string | null>(null)
  const inputArchivoRef = useRef<HTMLInputElement>(null)

  const [plantillaRecontacto, setPlantillaRecontacto] = useState('')
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false)
  const [avisoPlantilla, setAvisoPlantilla] = useState<string | null>(null)
  const [mostrarRecontacto, setMostrarRecontacto] = useState(false)
  const [generandoRecontacto, setGenerandoRecontacto] = useState(false)
  const [mensajesRecontacto, setMensajesRecontacto] = useState<{ paciente: string; telefono: string | null; mensaje: string; enlace: string | null }[] | null>(null)
  const [copiadoRecontacto, setCopiadoRecontacto] = useState<string | null>(null)
  const [celebracion, setCelebracion] = useState<{ id: number; mensaje: string } | null>(null)

  useEffect(() => {
    if (user) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function cargar() {
    if (!user) return
    try {
      setLoading(true)
      const [c, g, ce, rls] = await Promise.all([
        getSeguimientoCitas(),
        getSeguimientoGestion(),
        getUserCentro(user.id),
        getRolesUsuarioActual(user.id),
      ])
      setCitas(c)
      setGestiones(g)
      setCentroId(ce)
      setRoles(rls)
      if (ce) {
        const p = await getRecordatoriosPlantilla(ce, 'RECONTACTO')
        setPlantillaRecontacto(p?.texto ?? '')
      }
      const clavesUnicas = [...new Set(c.map((cita) => cita.paciente_clave))]
      setEdadesPorClave(await getEdadesPorClaves(clavesUnicas))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando el seguimiento')
    } finally {
      setLoading(false)
    }
  }

  const puedeVer = canUserAccess(roles, 'Seguimiento', 'ver')
  const puedeEditar = canUserAccess(roles, 'Seguimiento', 'editar')

  const pacientes = useMemo(() => calcularSeguimiento(citas, gestiones), [citas, gestiones])
  const resumen = useMemo(() => calcularResumen(pacientes), [pacientes])
  const resumenPodologo = useMemo(() => calcularResumenPorPodologo(pacientes), [pacientes])

  // Revisiones reagendadas este mes (estado actual "Cita agendada",
  // marcado dentro del mes en curso) — cada una son 45€ que no se perdían.
  const reagendadasEsteMes = useMemo(() => {
    const hoy = new Date()
    return pacientes.filter((p) => {
      if (p.gestion_recontacto !== 'CITA_AGENDADA' || !p.gestion_actualizada_en) return false
      const f = new Date(p.gestion_actualizada_en)
      return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth()
    }).length
  }, [pacientes])

  const podologos = useMemo(() => {
    const set = new Set(pacientes.map((p) => p.podologo_estudio).filter((v): v is string => !!v))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [pacientes])

  const pacientesFiltrados = useMemo(() => {
    let lista = pacientes
    if (filtroEstado === 'SIN_CITA') lista = lista.filter((p) => p.estado === 'SIN CITA - recontactar')
    if (filtroEstado === 'CITADA') lista = lista.filter((p) => p.estado === 'Revisión citada')
    if (filtroPrioridad === 'SIN_REVISION') lista = lista.filter((p) => p.prioridad === 'Sin revisión previa')
    if (filtroPrioridad === 'VENCIDA') lista = lista.filter((p) => p.prioridad === 'VENCIDA')
    if (filtroPrioridad === 'AL_DIA') lista = lista.filter((p) => p.prioridad === 'Al día')
    if (filtroPodologo !== 'TODOS') lista = lista.filter((p) => p.podologo_estudio === filtroPodologo)
    if (soloConPlantillas) lista = lista.filter((p) => p.lleva_plantillas)
    if (busqueda.trim()) {
      const q = busqueda.trim().toUpperCase()
      lista = lista.filter((p) => p.nombre_mostrar.toUpperCase().includes(q))
    }
    return [...lista].sort((a, b) => compararCampo(a, b, ordenCampo, edadesPorClave) * (ordenAsc ? 1 : -1))
  }, [pacientes, filtroEstado, filtroPrioridad, filtroPodologo, soloConPlantillas, busqueda, ordenCampo, ordenAsc, edadesPorClave])

  function handleOrdenar(campo: CampoOrden) {
    if (campo === ordenCampo) {
      setOrdenAsc((v) => !v)
    } else {
      setOrdenCampo(campo)
      setOrdenAsc(true)
    }
  }

  async function handleActualizarGestion(
    p: PacienteSeguimiento,
    campos: Partial<{
      citaFuturaManual: boolean
      citaFuturaFecha: string | null
      gestionRecontacto: SeguimientoGestionEstado
      proximoIntento: string | null
      notas: string | null
    }>
  ) {
    if (!user || !centroId) return
    try {
      await actualizarGestion({
        pacienteClave: p.paciente_clave,
        nombreMostrar: p.nombre_mostrar,
        centroId,
        actorId: user.id,
        ...campos,
      })
      if (campos.citaFuturaManual !== undefined) {
        setAviso(
          campos.citaFuturaManual
            ? `${p.nombre_mostrar}: cita futura el ${fechaDDMMAAAA(campos.citaFuturaFecha ?? null)} → pasa a "Revisión citada" y desaparece del filtro "Sin cita".`
            : `${p.nombre_mostrar}: fecha borrada → vuelve a "Sin cita - recontactar".`
        )
        setTimeout(() => setAviso(null), 6000)
      }
      if (campos.gestionRecontacto === 'CITA_AGENDADA' && p.gestion_recontacto !== 'CITA_AGENDADA') {
        const totalMes = (reagendadasEsteMes + 1) * PRECIO_REVISION
        const idCelebracion = Date.now()
        setCelebracion({
          id: idCelebracion,
          mensaje: `+${PRECIO_REVISION}€ · ${p.nombre_mostrar} reagendada. Llevamos ${totalMes}€ este mes. ¡BIEN HECHO! 🎉`,
        })
        setTimeout(() => {
          setCelebracion((actual) => (actual?.id === idCelebracion ? null : actual))
        }, 4000)
      }
      await cargar()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error guardando el cambio')
    }
  }

  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setImportando(true)
    setResultadoImport(null)
    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const formData = new FormData()
      formData.append('archivo', archivo)

      const res = await fetch('/api/seguimiento/importar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error importando el archivo')

      setResultadoImport(
        `Importadas ${data.insertadas} citas nuevas (${data.yaExistentes} ya existían), ${data.pacientesNuevos} pacientes nuevos.` +
          (data.descartadasNoBiomecanica ? ` ${data.descartadasNoBiomecanica} filas de otros servicios (no biomecánica/plantillas) ignoradas.` : '') +
          (data.errores?.length ? ` ${data.errores.length} filas con error, revisadas.` : '')
      )
      await cargar()
    } catch (err) {
      setResultadoImport(err instanceof Error ? err.message : 'Error importando el archivo')
    } finally {
      setImportando(false)
      if (inputArchivoRef.current) inputArchivoRef.current.value = ''
    }
  }

  async function handleGuardarPlantillaRecontacto() {
    if (!user || !centroId) return
    setGuardandoPlantilla(true)
    try {
      await actualizarRecordatoriosPlantilla({ centroId, tipo: 'RECONTACTO', texto: plantillaRecontacto, actorId: user.id })
      setAvisoPlantilla('Plantilla guardada.')
      setTimeout(() => setAvisoPlantilla(null), 3000)
    } catch (err) {
      setAvisoPlantilla(err instanceof Error ? err.message : 'Error guardando la plantilla')
    } finally {
      setGuardandoPlantilla(false)
    }
  }

  async function handleGenerarRecontacto() {
    setGenerandoRecontacto(true)
    setMensajesRecontacto(null)
    try {
      const claves = pacientesFiltrados.map((p) => p.paciente_clave)
      const telefonos = await getTelefonosPorClaves(claves)
      const mensajes = pacientesFiltrados.map((p) => {
        const mensaje = plantillaRecontacto.replace(/\{nombre\}/g, p.nombre_mostrar)
        const telefono = telefonos.get(p.paciente_clave) ?? null
        return {
          paciente: p.nombre_mostrar,
          telefono,
          mensaje,
          enlace: telefono ? enlaceWhatsapp(telefono, mensaje) : null,
        }
      })
      setMensajesRecontacto(mensajes)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error generando los mensajes')
    } finally {
      setGenerandoRecontacto(false)
    }
  }

  async function copiarMensajeRecontacto(clave: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiadoRecontacto(clave)
      setTimeout(() => setCopiadoRecontacto(null), 2000)
    } catch {
      alert('No se pudo copiar. Selecciona el texto a mano.')
    }
  }

  if (userLoading || loading) {
    return <div className="p-6 text-gray-500">Cargando seguimiento...</div>
  }

  if (!puedeVer) {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permiso para ver Seguimiento.</p>
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
          <h1 className="text-3xl font-bold" style={{ color: DENIM }}>Seguimiento</h1>
          <p className="text-gray-500 mt-1 text-sm">Revisiones de biomecánica — quién falta por recontactar</p>
        </div>
        {puedeEditar && (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => inputArchivoRef.current?.click()}
              disabled={importando}
              className="px-4 py-2 rounded-full text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: PUMPKIN }}
            >
              {importando ? 'Importando…' : '📥 Importar citas de Organízate'}
            </button>
            <input ref={inputArchivoRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImportar} />
            {resultadoImport && <p className="text-xs text-gray-500 max-w-xs text-right">{resultadoImport}</p>}
          </div>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-3">
          <div className="text-2xl font-bold" style={{ color: DENIM }}>{resumen.total}</div>
          <div className="text-xs text-gray-500 font-medium mt-0.5">Pacientes</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-2xl font-bold text-amber-700">{resumen.sin_revision_previa}</div>
          <div className="text-xs text-amber-700 font-medium mt-0.5">Sin revisión previa</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="text-2xl font-bold text-red-700">{resumen.vencidas}</div>
          <div className="text-xs text-red-700 font-medium mt-0.5">Vencidas</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="text-2xl font-bold text-emerald-700">{resumen.revision_citada}</div>
          <div className="text-xs text-emerald-700 font-medium mt-0.5">Revisión citada</div>
        </div>
        <div className="rounded-xl border-2 px-4 py-3" style={{ borderColor: PUMPKIN, backgroundColor: '#FEF1EA' }}>
          <div className="text-2xl font-bold" style={{ color: PUMPKIN }}>{resumen.con_plantillas_pendientes}</div>
          <div className="text-xs font-medium mt-0.5" style={{ color: PUMPKIN }}>🦶 Con plantillas, sin cita</div>
        </div>
        <div className="rounded-xl border-2 px-4 py-3" style={{ borderColor: '#16a34a', backgroundColor: '#f0fdf4' }}>
          <div className="text-2xl font-bold text-green-700">{reagendadasEsteMes * PRECIO_REVISION}€</div>
          <div className="text-xs font-medium mt-0.5 text-green-700">💶 Recuperado este mes ({reagendadasEsteMes})</div>
        </div>
      </div>

      {celebracion && (
        <div
          key={celebracion.id}
          className="celebracion-toast fixed top-16 left-1/2 z-[60] px-5 py-3 rounded-full shadow-lg text-white font-bold text-sm whitespace-nowrap"
          style={{ backgroundColor: '#16a34a' }}
        >
          {celebracion.mensaje}
        </div>
      )}

      {aviso && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-md px-4 py-2 flex items-center justify-between gap-3">
          <span>ℹ️ {aviso}</span>
          <button onClick={() => setAviso(null)} className="text-blue-400 hover:text-blue-700 flex-shrink-0">✕</button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {(['SIN_CITA', 'CITADA', 'TODOS'] as FiltroEstado[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltroEstado(f)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-colors"
            style={
              filtroEstado === f
                ? { backgroundColor: DENIM, color: '#fff' }
                : { backgroundColor: '#fff', color: '#4a5a6a', border: '1px solid #e2e8f0' }
            }
          >
            {f === 'SIN_CITA' ? 'Sin cita' : f === 'CITADA' ? 'Revisión citada' : 'Todos'}
          </button>
        ))}

        <select
          value={filtroPrioridad}
          onChange={(e) => setFiltroPrioridad(e.target.value as FiltroPrioridad)}
          className="px-3 py-1.5 rounded-full text-sm border border-gray-300 bg-white"
        >
          <option value="TODAS">Toda prioridad</option>
          <option value="SIN_REVISION">Sin revisión previa</option>
          <option value="VENCIDA">Vencida</option>
          <option value="AL_DIA">Al día</option>
        </select>

        <button
          onClick={() => setSoloConPlantillas((v) => !v)}
          className="px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap"
          style={
            soloConPlantillas
              ? { backgroundColor: PUMPKIN, color: '#fff' }
              : { backgroundColor: '#fff', color: '#4a5a6a', border: '1px solid #e2e8f0' }
          }
          title="Solo pacientes con señal de plantillas registrada"
        >
          🦶 Con plantillas
        </button>

        <select
          value={filtroPodologo}
          onChange={(e) => setFiltroPodologo(e.target.value)}
          className="px-3 py-1.5 rounded-full text-sm border border-gray-300 bg-white"
        >
          <option value="TODOS">Todos los podólogos</option>
          {podologos.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Buscar paciente…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="px-3 py-1.5 rounded-full text-sm border border-gray-300 flex-1 min-w-[160px]"
        />

        <button
          onClick={() => setMostrarRecontacto((v) => !v)}
          className="text-xs font-medium underline decoration-dotted ml-auto"
          style={{ color: PUMPKIN }}
        >
          {mostrarRecontacto ? 'Ocultar recontacto por WhatsApp' : '💬 Recontactar por WhatsApp'}
        </button>
        <button
          onClick={() => setMostrarResumen((v) => !v)}
          className="text-xs font-medium underline decoration-dotted"
          style={{ color: DENIM }}
        >
          {mostrarResumen ? 'Ocultar resumen por podólogo' : 'Ver resumen por podólogo'}
        </button>
      </div>

      {mostrarRecontacto && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-bold" style={{ color: DENIM }}>Recontactar por WhatsApp</h3>
          <p className="text-xs text-gray-500">
            Genera un mensaje por cada paciente de la lista de abajo (respeta los filtros y el orden que tengas puestos
            ahora mismo — {pacientesFiltrados.length} paciente{pacientesFiltrados.length === 1 ? '' : 's'}). Usa{' '}
            <code className="bg-gray-100 px-1 rounded">{'{nombre}'}</code> en la plantilla donde quieras el nombre.
          </p>
          <textarea
            value={plantillaRecontacto}
            onChange={(e) => setPlantillaRecontacto(e.target.value)}
            disabled={!puedeEditar}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-3 flex-wrap">
            {puedeEditar && (
              <button
                onClick={handleGuardarPlantillaRecontacto}
                disabled={guardandoPlantilla}
                className="px-4 py-1.5 rounded-full text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: DENIM }}
              >
                {guardandoPlantilla ? 'Guardando…' : 'Guardar plantilla'}
              </button>
            )}
            <button
              onClick={handleGenerarRecontacto}
              disabled={generandoRecontacto || pacientesFiltrados.length === 0}
              className="px-4 py-1.5 rounded-full text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: PUMPKIN }}
            >
              {generandoRecontacto ? 'Generando…' : `Generar ${pacientesFiltrados.length} mensajes`}
            </button>
            {avisoPlantilla && <span className="text-xs text-gray-500">{avisoPlantilla}</span>}
          </div>

          {mensajesRecontacto && (
            <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {mensajesRecontacto.map((m, i) => {
                const clave = `${m.paciente}-${i}`
                return (
                  <div key={clave} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="sm:w-40 flex-shrink-0 font-medium text-gray-900 text-sm">{m.paciente}</div>
                    <div className="flex-1 text-xs text-gray-600">{m.mensaje}</div>
                    <div className="flex-shrink-0 flex gap-2">
                      <button
                        onClick={() => copiarMensajeRecontacto(clave, m.mensaje)}
                        className="text-xs px-3 py-1 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        {copiadoRecontacto === clave ? '✓ Copiado' : 'Copiar'}
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
          )}
        </div>
      )}

      {mostrarResumen && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2" style={{ backgroundColor: '#f4f7fb' }}>
            <h3 className="text-sm font-bold" style={{ color: DENIM }}>Resumen por podólogo (según quién hizo el estudio)</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2 font-medium">Podólogo</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Sin cita</th>
                <th className="px-4 py-2 font-medium">Con cita</th>
                <th className="px-4 py-2 font-medium">% sin cita</th>
              </tr>
            </thead>
            <tbody>
              {resumenPodologo.map((r) => (
                <tr key={r.podologo} className="border-b border-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{r.podologo}</td>
                  <td className="px-4 py-2">{r.total_pacientes}</td>
                  <td className="px-4 py-2">{r.sin_cita}</td>
                  <td className="px-4 py-2">{r.con_cita}</td>
                  <td className="px-4 py-2">{Math.round(r.porcentaje_sin_cita * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabla principal */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100" style={{ backgroundColor: '#f4f7fb' }}>
              <th className="px-4 py-2 font-medium">Paciente</th>
              <CabeceraOrdenable campo="podologo_estudio" ordenCampo={ordenCampo} ordenAsc={ordenAsc} onClick={handleOrdenar}>Podólogo</CabeceraOrdenable>
              <CabeceraOrdenable campo="tipo" ordenCampo={ordenCampo} ordenAsc={ordenAsc} onClick={handleOrdenar}>Tipo</CabeceraOrdenable>
              <CabeceraOrdenable campo="edad" ordenCampo={ordenCampo} ordenAsc={ordenAsc} onClick={handleOrdenar}>Edad</CabeceraOrdenable>
              <CabeceraOrdenable campo="plantillas" ordenCampo={ordenCampo} ordenAsc={ordenAsc} onClick={handleOrdenar}>🦶 Plantillas</CabeceraOrdenable>
              <CabeceraOrdenable campo="primer_estudio" ordenCampo={ordenCampo} ordenAsc={ordenAsc} onClick={handleOrdenar}>1er estudio</CabeceraOrdenable>
              <CabeceraOrdenable campo="ultima_cita" ordenCampo={ordenCampo} ordenAsc={ordenAsc} onClick={handleOrdenar}>Última cita</CabeceraOrdenable>
              <CabeceraOrdenable campo="meses" ordenCampo={ordenCampo} ordenAsc={ordenAsc} onClick={handleOrdenar}>Meses</CabeceraOrdenable>
              <CabeceraOrdenable campo="num_revisiones" ordenCampo={ordenCampo} ordenAsc={ordenAsc} onClick={handleOrdenar}>Nº rev.</CabeceraOrdenable>
              <CabeceraOrdenable campo="estado" ordenCampo={ordenCampo} ordenAsc={ordenAsc} onClick={handleOrdenar}>Estado</CabeceraOrdenable>
              <CabeceraOrdenable campo="prioridad" ordenCampo={ordenCampo} ordenAsc={ordenAsc} onClick={handleOrdenar}>Prioridad</CabeceraOrdenable>
              <th className="px-3 py-2 font-medium">Cita futura (fecha, manual)</th>
              <th className="px-3 py-2 font-medium">Gestión recontacto</th>
              <th className="px-3 py-2 font-medium">Próximo intento</th>
              <th className="px-3 py-2 font-medium">Notas</th>
            </tr>
          </thead>
          <tbody>
            {pacientesFiltrados.map((p) => (
              <tr key={p.paciente_clave} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{p.nombre_mostrar}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.podologo_estudio ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{p.tipo}</td>
                <td className="px-3 py-2 text-gray-600">{edadesPorClave.get(p.paciente_clave) ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {p.lleva_plantillas ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                      style={{ backgroundColor: '#FEF1EA', color: PUMPKIN }}
                      title={`Señal de plantillas: ${fechaDDMMAAAA(p.fecha_entrega_plantillas)}`}
                    >
                      Sí ({fechaDDMMAAAA(p.fecha_entrega_plantillas)})
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fechaDDMMAAAA(p.primer_estudio)}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fechaDDMMAAAA(p.ultima_cita)}</td>
                <td className="px-3 py-2 text-gray-600">{p.meses_desde_ultima ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{p.num_revisiones}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${badgeEstado(p.estado)}`}>
                    {p.estado}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${badgePrioridad(p.prioridad)}`}>
                    {p.prioridad}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {p.cita_futura_fecha ? (
                    <input
                      type="date"
                      defaultValue={p.cita_futura_fecha}
                      disabled={!puedeEditar}
                      onChange={(e) => {
                        const valor = e.target.value || null
                        handleActualizarGestion(p, { citaFuturaManual: !!valor, citaFuturaFecha: valor })
                      }}
                      className="border border-gray-300 rounded px-1.5 py-1 text-xs"
                      title="Cambia la fecha si la cita se mueve, o bórrala para quitarla."
                    />
                  ) : (
                    <input
                      type="date"
                      disabled={!puedeEditar}
                      ref={(el) => {
                        if (el) el.value = ''
                      }}
                      onFocus={(e) => {
                        // Al hacer foco (clic o tab) abre el selector directamente,
                        // en vez de dejar una caja vacía a la espera de escribir.
                        e.target.showPicker?.()
                      }}
                      onChange={(e) => {
                        const valor = e.target.value || null
                        if (valor) handleActualizarGestion(p, { citaFuturaManual: true, citaFuturaFecha: valor })
                      }}
                      className="border border-dashed border-gray-300 rounded px-1.5 py-1 text-xs text-gray-400"
                      title="Clic para elegir la fecha de la cita futura acordada por teléfono."
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={p.gestion_recontacto}
                    disabled={!puedeEditar}
                    onChange={(e) =>
                      handleActualizarGestion(p, { gestionRecontacto: e.target.value as SeguimientoGestionEstado })
                    }
                    className="border border-gray-300 rounded px-1.5 py-1 text-xs"
                  >
                    {(Object.keys(GESTION_LABEL) as SeguimientoGestionEstado[]).map((k) => (
                      <option key={k} value={k}>{GESTION_LABEL[k]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="date"
                    defaultValue={p.proximo_intento ?? ''}
                    disabled={!puedeEditar}
                    onBlur={(e) => handleActualizarGestion(p, { proximoIntento: e.target.value || null })}
                    className="border border-gray-300 rounded px-1.5 py-1 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    defaultValue={p.notas ?? ''}
                    disabled={!puedeEditar}
                    placeholder="Notas…"
                    onBlur={(e) => handleActualizarGestion(p, { notas: e.target.value || null })}
                    className="border border-gray-300 rounded px-1.5 py-1 text-xs w-32"
                  />
                </td>
              </tr>
            ))}
            {pacientesFiltrados.length === 0 && (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-gray-400">
                  No hay pacientes que coincidan con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">{pacientesFiltrados.length} de {pacientes.length} pacientes</p>
    </div>
  )
}

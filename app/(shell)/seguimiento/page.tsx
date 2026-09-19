'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '@/lib/contexts/UserContext'
import { createClient } from '@/lib/supabase/browser'
import { getUserCentro } from '@/lib/supabase/queries/tasks'
import { getSeguimientoCitas, getSeguimientoGestion, actualizarGestion } from '@/lib/supabase/queries/seguimiento'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { canUserAccess } from '@/lib/permissions/validation'
import {
  calcularSeguimiento,
  calcularResumen,
  calcularResumenPorPodologo,
  type PacienteSeguimiento,
} from '@/lib/services/seguimiento'
import type { SeguimientoCita, SeguimientoGestion, SeguimientoGestionEstado, Rol } from '@/lib/types/models'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

const GESTION_LABEL: Record<SeguimientoGestionEstado, string> = {
  PENDIENTE: 'Pendiente',
  LLAMADO_NO_CONTESTA: 'Llamado - no contesta',
  CITA_AGENDADA: 'Cita agendada',
  RECHAZA: 'Rechaza',
  VOLVER_A_LLAMAR: 'Volver a llamar',
}

type FiltroEstado = 'TODOS' | 'SIN_CITA' | 'CITADA'
type FiltroPrioridad = 'TODAS' | 'SIN_REVISION' | 'VENCIDA' | 'AL_DIA'
type OrdenPor = 'PRIORIDAD' | 'ESTUDIO_RECIENTE' | 'ESTUDIO_ANTIGUO'

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

export default function SeguimientoPage() {
  const { user, loading: userLoading } = useUser()

  const [citas, setCitas] = useState<SeguimientoCita[]>([])
  const [gestiones, setGestiones] = useState<SeguimientoGestion[]>([])
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
  const [ordenPor, setOrdenPor] = useState<OrdenPor>('PRIORIDAD')
  const [aviso, setAviso] = useState<string | null>(null)

  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState<string | null>(null)
  const inputArchivoRef = useRef<HTMLInputElement>(null)

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
    return [...lista].sort((a, b) => {
      if (ordenPor === 'ESTUDIO_RECIENTE' || ordenPor === 'ESTUDIO_ANTIGUO') {
        const fa = a.primer_estudio ?? ''
        const fb = b.primer_estudio ?? ''
        if (fa === fb) return 0
        if (fa === '') return 1 // sin fecha de estudio, al final
        if (fb === '') return -1
        return ordenPor === 'ESTUDIO_RECIENTE' ? fb.localeCompare(fa) : fa.localeCompare(fb)
      }
      const diff = ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad]
      if (diff !== 0) return diff
      // Con la misma prioridad, quien lleva plantillas va primero: es más
      // importante no dejarlo a su aire que a alguien que solo se hizo el estudio.
      if (a.lleva_plantillas !== b.lleva_plantillas) return a.lleva_plantillas ? -1 : 1
      return (b.meses_desde_ultima ?? 0) - (a.meses_desde_ultima ?? 0)
    })
  }, [pacientes, filtroEstado, filtroPrioridad, filtroPodologo, soloConPlantillas, busqueda, ordenPor])

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
            ? `${p.nombre_mostrar}: cita futura el ${campos.citaFuturaFecha} → pasa a "Revisión citada" y desaparece del filtro "Sin cita".`
            : `${p.nombre_mostrar}: fecha borrada → vuelve a "Sin cita - recontactar".`
        )
        setTimeout(() => setAviso(null), 6000)
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
      </div>

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

        <select
          value={ordenPor}
          onChange={(e) => setOrdenPor(e.target.value as OrdenPor)}
          className="px-3 py-1.5 rounded-full text-sm border border-gray-300 bg-white"
          title="Orden de la tabla"
        >
          <option value="PRIORIDAD">Orden: por prioridad</option>
          <option value="ESTUDIO_RECIENTE">Orden: 1er estudio, más recientes primero</option>
          <option value="ESTUDIO_ANTIGUO">Orden: 1er estudio, más antiguos primero</option>
        </select>

        <input
          type="text"
          placeholder="Buscar paciente…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="px-3 py-1.5 rounded-full text-sm border border-gray-300 flex-1 min-w-[160px]"
        />

        <button
          onClick={() => setMostrarResumen((v) => !v)}
          className="text-xs font-medium underline decoration-dotted ml-auto"
          style={{ color: DENIM }}
        >
          {mostrarResumen ? 'Ocultar resumen por podólogo' : 'Ver resumen por podólogo'}
        </button>
      </div>

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
              <th className="px-3 py-2 font-medium">Podólogo</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">🦶 Plantillas</th>
              <th className="px-3 py-2 font-medium">1er estudio</th>
              <th className="px-3 py-2 font-medium">Última cita</th>
              <th className="px-3 py-2 font-medium">Meses</th>
              <th className="px-3 py-2 font-medium">Nº rev.</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Prioridad</th>
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
                <td className="px-3 py-2 whitespace-nowrap">
                  {p.lleva_plantillas ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                      style={{ backgroundColor: '#FEF1EA', color: PUMPKIN }}
                      title={`Señal de plantillas: ${p.fecha_entrega_plantillas}`}
                    >
                      Sí ({p.fecha_entrega_plantillas})
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.primer_estudio ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.ultima_cita ?? '—'}</td>
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
                <td colSpan={14} className="px-4 py-8 text-center text-gray-400">
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

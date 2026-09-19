'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@/lib/contexts/UserContext'
import { getUserCentro } from '@/lib/supabase/queries/tasks'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import {
  getVacacionesTrabajadores,
  getVacacionesFestivos,
  getVacacionesPeriodos,
  crearVacacionesPeriodo,
  actualizarVacacionesPeriodo,
  eliminarVacacionesPeriodo,
  crearVacacionesFestivo,
  eliminarVacacionesFestivo,
  actualizarDiasAnuales,
} from '@/lib/supabase/queries/vacaciones'
import { canUserAccess } from '@/lib/permissions/validation'
import type {
  VacacionesTrabajador,
  VacacionesFestivo,
  VacacionesFestivoTipo,
  VacacionesPeriodo,
  VacacionesPeriodoTipo,
  Rol,
} from '@/lib/types/models'

const TIPO_LABEL: Record<VacacionesPeriodoTipo, string> = {
  VACACIONES: 'Vacaciones',
  ASUNTOS_PROPIOS: 'Asuntos propios',
  FORMACION: 'Formación',
  BAJA: 'Baja',
}

const FESTIVO_LABEL: Record<VacacionesFestivoTipo, string> = {
  NACIONAL: 'Nacional',
  AUTONOMICO: 'Autonómico',
  LOCAL: 'Local',
  CLINICA: 'Clínica',
}

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

// ── Helpers de fecha local (sin desfases de huso horario) ────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function parseLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function keyLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatearDDMMAAAA(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function isWeekday(d: Date): boolean {
  const dia = d.getDay()
  return dia !== 0 && dia !== 6
}

function diasEnPeriodo(p: VacacionesPeriodo): Date[] {
  const dias: Date[] = []
  const fin = parseLocal(p.fecha_fin)
  let cur = parseLocal(p.fecha_inicio)
  while (cur <= fin) {
    dias.push(cur)
    cur = addDays(cur, 1)
  }
  return dias
}

interface DiaEntrada {
  trabajadorId: string
  periodoId: string
  tipo: VacacionesPeriodoTipo
}

interface FormPeriodo {
  trabajador_id: string
  fecha_inicio: string
  fecha_fin: string
  tipo: VacacionesPeriodoTipo
}

const FORM_PERIODO_VACIO: FormPeriodo = {
  trabajador_id: '',
  fecha_inicio: '',
  fecha_fin: '',
  tipo: 'VACACIONES',
}

export default function VacacionesPage() {
  const { user, loading: userLoading } = useUser()

  const [trabajadores, setTrabajadores] = useState<VacacionesTrabajador[]>([])
  const [festivos, setFestivos] = useState<VacacionesFestivo[]>([])
  const [periodos, setPeriodos] = useState<VacacionesPeriodo[]>([])
  const [centroId, setCentroId] = useState<string | null>(null)
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [anioActivo, setAnioActivo] = useState(() => new Date().getFullYear())
  const [editMode, setEditMode] = useState(false)
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)
  const [panelPeriodosAbierto, setPanelPeriodosAbierto] = useState(false)
  const [filtroPeriodosTrabajadorId, setFiltroPeriodosTrabajadorId] = useState<string | null>(null)

  const [editandoDiasId, setEditandoDiasId] = useState<string | null>(null)
  const [diasEditados, setDiasEditados] = useState(0)

  const [formAltaDia, setFormAltaDia] = useState({ trabajador_id: '', tipo: 'VACACIONES' as VacacionesPeriodoTipo })
  const [formFestivoAbierto, setFormFestivoAbierto] = useState(false)
  const [formFestivo, setFormFestivo] = useState({ nombre: '', tipo: 'CLINICA' as VacacionesFestivoTipo })

  const [formPeriodo, setFormPeriodo] = useState<FormPeriodo>(FORM_PERIODO_VACIO)
  const [editandoPeriodoId, setEditandoPeriodoId] = useState<string | null>(null)
  const [formEdicionPeriodo, setFormEdicionPeriodo] = useState<FormPeriodo>(FORM_PERIODO_VACIO)

  useEffect(() => {
    if (user) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function cargar() {
    if (!user) return
    try {
      setLoading(true)
      const [trab, fest, per, ce, rls] = await Promise.all([
        getVacacionesTrabajadores(),
        getVacacionesFestivos(),
        getVacacionesPeriodos(),
        getUserCentro(user.id),
        getRolesUsuarioActual(user.id),
      ])
      setTrabajadores(trab)
      setFestivos(fest)
      setPeriodos(per)
      setCentroId(ce)
      setRoles(rls)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando las vacaciones')
    } finally {
      setLoading(false)
    }
  }

  const puedeVer = canUserAccess(roles, 'Vacaciones', 'ver')
  const puedeEditar = canUserAccess(roles, 'Vacaciones', 'editar')

  const trabajadoresPorId = useMemo(() => {
    const map = new Map<string, VacacionesTrabajador>()
    for (const t of trabajadores) map.set(t.id, t)
    return map
  }, [trabajadores])

  const festivoPorFecha = useMemo(() => {
    const map = new Map<string, VacacionesFestivo>()
    for (const f of festivos) map.set(f.fecha, f)
    return map
  }, [festivos])

  const festivoKeys = useMemo(() => new Set(festivos.map((f) => f.fecha)), [festivos])

  const trabajadoresOrdenados = useMemo(
    () => [...trabajadores].sort((a, b) => a.orden - b.orden),
    [trabajadores]
  )

  // ── Mapa de días del año visible ────────────────────────────────────
  const dayMapAnio = useMemo(() => {
    const map = new Map<string, DiaEntrada[]>()
    const inicioAnio = new Date(anioActivo, 0, 1)
    const finAnio = new Date(anioActivo, 11, 31)
    for (const p of periodos) {
      for (const d of diasEnPeriodo(p)) {
        if (d < inicioAnio || d > finAnio) continue
        const k = keyLocal(d)
        const arr = map.get(k) ?? []
        arr.push({ trabajadorId: p.trabajador_id, periodoId: p.id, tipo: p.tipo })
        map.set(k, arr)
      }
    }
    return map
  }, [periodos, anioActivo])

  // ── Días de vacaciones usados por trabajador en el año visible ────────
  const usadosPorTrabajador = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of periodos) {
      if (p.tipo !== 'VACACIONES') continue
      for (const d of diasEnPeriodo(p)) {
        if (d.getFullYear() !== anioActivo) continue
        if (!isWeekday(d)) continue
        if (festivoKeys.has(keyLocal(d))) continue
        map[p.trabajador_id] = (map[p.trabajador_id] ?? 0) + 1
      }
    }
    return map
  }, [periodos, festivoKeys, anioActivo])

  // ── Grid de un mes concreto del año activo (semanas L-D) ──────────────
  function semanasDelMes(mes: number): (Date | null)[][] {
    const primerDia = new Date(anioActivo, mes, 1)
    const ultimoDia = new Date(anioActivo, mes + 1, 0)
    const offsetInicio = (primerDia.getDay() + 6) % 7
    const dias: (Date | null)[] = Array(offsetInicio).fill(null)
    for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(anioActivo, mes, d))
    while (dias.length % 7 !== 0) dias.push(null)
    const filas: (Date | null)[][] = []
    for (let i = 0; i < dias.length; i += 7) filas.push(dias.slice(i, i + 7))
    return filas
  }

  function seleccionarDia(k: string) {
    setDiaSeleccionado(k)
    // Si estamos filtrando por un trabajador y aún no tiene nada ese día,
    // precarga el formulario de alta con él para editar más rápido.
    if (filtroPeriodosTrabajadorId) {
      const yaTiene = (dayMapAnio.get(k) ?? []).some((e) => e.trabajadorId === filtroPeriodosTrabajadorId)
      if (!yaTiene) {
        setFormAltaDia((f) => ({ ...f, trabajador_id: filtroPeriodosTrabajadorId }))
      }
    }
  }

  function irAnioAnterior() {
    setAnioActivo((a) => a - 1)
  }
  function irAnioSiguiente() {
    setAnioActivo((a) => a + 1)
  }
  function irHoy() {
    setAnioActivo(new Date().getFullYear())
  }

  function estiloFondoDia(entradas: DiaEntrada[], esFestivo: boolean, esFinde: boolean): React.CSSProperties {
    if (entradas.length === 0) {
      if (esFestivo) return { background: '#fde68a' }
      if (esFinde) return { background: '#f1f5f9' }
      return {}
    }
    if (entradas.length === 1) {
      const t = trabajadoresPorId.get(entradas[0].trabajadorId)
      return { background: t?.color ?? '#999' }
    }
    const colores = entradas.map((e) => trabajadoresPorId.get(e.trabajadorId)?.color ?? '#999')
    const paso = 100 / colores.length
    const stops = colores.map((c, i) => `${c} ${i * paso}%, ${c} ${(i + 1) * paso}%`).join(', ')
    return { background: `linear-gradient(135deg, ${stops})` }
  }

  async function handleGuardarDiasAnuales(trabajadorId: string) {
    if (!user) return
    try {
      await actualizarDiasAnuales(trabajadorId, diasEditados, user.id)
      setTrabajadores((prev) =>
        prev.map((t) => (t.id === trabajadorId ? { ...t, dias_anuales: diasEditados } : t))
      )
      setEditandoDiasId(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error guardando los días anuales')
    }
  }

  async function handleAnadirADia() {
    if (!user || !centroId || !diaSeleccionado || !formAltaDia.trabajador_id) return
    try {
      const nuevo = await crearVacacionesPeriodo({
        trabajador_id: formAltaDia.trabajador_id,
        fecha_inicio: diaSeleccionado,
        fecha_fin: diaSeleccionado,
        tipo: formAltaDia.tipo,
        centro_id: centroId,
        actorId: user.id,
      })
      setPeriodos((prev) => [...prev, nuevo])
      setFormAltaDia({ trabajador_id: '', tipo: 'VACACIONES' })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error añadiendo el día')
    }
  }

  async function handleQuitarDia(periodoId: string, k: string) {
    const periodo = periodos.find((p) => p.id === periodoId)
    if (!periodo || !user) return
    try {
      if (periodo.fecha_inicio === periodo.fecha_fin) {
        await eliminarVacacionesPeriodo(periodoId)
        setPeriodos((prev) => prev.filter((p) => p.id !== periodoId))
      } else if (k === periodo.fecha_inicio) {
        const nuevoInicio = keyLocal(addDays(parseLocal(k), 1))
        const actualizado = await actualizarVacacionesPeriodo(periodoId, { fecha_inicio: nuevoInicio }, user.id)
        setPeriodos((prev) => prev.map((p) => (p.id === periodoId ? actualizado : p)))
      } else if (k === periodo.fecha_fin) {
        const nuevoFin = keyLocal(addDays(parseLocal(k), -1))
        const actualizado = await actualizarVacacionesPeriodo(periodoId, { fecha_fin: nuevoFin }, user.id)
        setPeriodos((prev) => prev.map((p) => (p.id === periodoId ? actualizado : p)))
      } else {
        const finPrimero = keyLocal(addDays(parseLocal(k), -1))
        const inicioSegundo = keyLocal(addDays(parseLocal(k), 1))
        const actualizado = await actualizarVacacionesPeriodo(periodoId, { fecha_fin: finPrimero }, user.id)
        const nuevo = await crearVacacionesPeriodo({
          trabajador_id: periodo.trabajador_id,
          fecha_inicio: inicioSegundo,
          fecha_fin: periodo.fecha_fin,
          tipo: periodo.tipo,
          centro_id: periodo.centro_id,
          actorId: user.id,
        })
        setPeriodos((prev) => [...prev.map((p) => (p.id === periodoId ? actualizado : p)), nuevo])
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error quitando el día')
    }
  }

  async function handleGuardarFestivo() {
    if (!user || !centroId || !diaSeleccionado || !formFestivo.nombre.trim()) return
    try {
      const nuevo = await crearVacacionesFestivo({
        fecha: diaSeleccionado,
        nombre: formFestivo.nombre.trim(),
        tipo: formFestivo.tipo,
        centro_id: centroId,
        actorId: user.id,
      })
      setFestivos((prev) => [...prev, nuevo])
      setFormFestivoAbierto(false)
      setFormFestivo({ nombre: '', tipo: 'CLINICA' })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error guardando el festivo')
    }
  }

  async function handleQuitarFestivo(id: string) {
    try {
      await eliminarVacacionesFestivo(id)
      setFestivos((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error quitando el festivo')
    }
  }

  async function handleCrearPeriodo() {
    if (!user || !centroId) return
    if (!formPeriodo.trabajador_id || !formPeriodo.fecha_inicio || !formPeriodo.fecha_fin) {
      alert('Trabajador, fecha de inicio y fecha de fin son obligatorios')
      return
    }
    if (formPeriodo.fecha_fin < formPeriodo.fecha_inicio) {
      alert('La fecha de fin no puede ser anterior a la de inicio')
      return
    }
    try {
      const nuevo = await crearVacacionesPeriodo({
        trabajador_id: formPeriodo.trabajador_id,
        fecha_inicio: formPeriodo.fecha_inicio,
        fecha_fin: formPeriodo.fecha_fin,
        tipo: formPeriodo.tipo,
        centro_id: centroId,
        actorId: user.id,
      })
      setPeriodos((prev) => [...prev, nuevo])
      setFormPeriodo(FORM_PERIODO_VACIO)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error creando el periodo')
    }
  }

  function abrirEdicionPeriodo(p: VacacionesPeriodo) {
    setEditandoPeriodoId(p.id)
    setFormEdicionPeriodo({
      trabajador_id: p.trabajador_id,
      fecha_inicio: p.fecha_inicio,
      fecha_fin: p.fecha_fin,
      tipo: p.tipo,
    })
  }

  async function handleGuardarEdicionPeriodo(id: string) {
    if (!user) return
    if (formEdicionPeriodo.fecha_fin < formEdicionPeriodo.fecha_inicio) {
      alert('La fecha de fin no puede ser anterior a la de inicio')
      return
    }
    try {
      const actualizado = await actualizarVacacionesPeriodo(id, formEdicionPeriodo, user.id)
      setPeriodos((prev) => prev.map((p) => (p.id === id ? actualizado : p)))
      setEditandoPeriodoId(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error guardando el periodo')
    }
  }

  async function handleBorrarPeriodo(p: VacacionesPeriodo) {
    const trabajador = trabajadoresPorId.get(p.trabajador_id)
    if (!confirm(`¿Eliminar el periodo de ${trabajador?.nombre ?? ''} (${formatearDDMMAAAA(p.fecha_inicio)} – ${formatearDDMMAAAA(p.fecha_fin)})?`)) return
    try {
      await eliminarVacacionesPeriodo(p.id)
      setPeriodos((prev) => prev.filter((x) => x.id !== p.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error eliminando el periodo')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────

  if (userLoading || loading) {
    return <div className="p-6 text-gray-500">Cargando vacaciones...</div>
  }

  if (!puedeVer) {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permiso para ver Vacaciones.</p>
      </div>
    )
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  const hoyKey = keyLocal(new Date())
  const hoyMedianoche = new Date()
  hoyMedianoche.setHours(0, 0, 0, 0)

  const festivoDia = diaSeleccionado ? festivoPorFecha.get(diaSeleccionado) : undefined
  const entradasDia = diaSeleccionado ? dayMapAnio.get(diaSeleccionado) ?? [] : []
  const trabajadoresDisponiblesDia = trabajadoresOrdenados.filter(
    (t) => !entradasDia.some((e) => e.trabajadorId === t.id)
  )

  return (
    <div className="p-6 space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: DENIM }}>Vacaciones</h1>
          <p className="text-gray-500 mt-1 text-sm">Ausencias del equipo — {trabajadores.length} personas</p>
        </div>
        <div className="flex items-center gap-2">
          {puedeEditar && (
            <button
              onClick={() => setEditMode((v) => !v)}
              className="px-4 py-2 rounded-full text-sm font-semibold border transition-colors"
              style={
                editMode
                  ? { backgroundColor: DENIM, color: '#fff', borderColor: DENIM }
                  : { backgroundColor: '#fff', color: DENIM, borderColor: '#cbd5e1' }
              }
            >
              {editMode ? '✅ Listo' : '✏️ Editar'}
            </button>
          )}
          {editMode && puedeEditar && (
            <button
              onClick={() => {
                setFiltroPeriodosTrabajadorId(null)
                setPanelPeriodosAbierto(true)
              }}
              className="px-4 py-2 rounded-full text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: PUMPKIN }}
            >
              📋 Periodos
            </button>
          )}
        </div>
      </div>

      {puedeEditar && !editMode && (
        <div className="bg-gray-50 border border-gray-200 text-gray-600 text-sm rounded-md px-4 py-2">
          💡 Haz clic en cualquier día para añadir una ausencia o marcar un festivo. Dale a "✏️ Editar" para crear un rango de fechas de golpe, editar/borrar periodos completos o cambiar los días anuales de cada persona.
        </div>
      )}
      {editMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-md px-4 py-2">
          ✏️ Modo edición — añade rangos de fechas de golpe, edita o borra periodos completos y cambia los días anuales de cada persona.
        </div>
      )}

      {/* Leyenda de equipo */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-4">
        {trabajadoresOrdenados.map((t) => {
          const usados = usadosPorTrabajador[t.id] ?? 0
          const quedan = t.dias_anuales - usados
          return (
            <div
              key={t.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: `${t.color}1a` }}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
              <span className="text-sm font-semibold text-gray-800">{t.nombre}</span>
              {editMode && puedeEditar && (
                <button
                  title="Añadir un rango de fechas para esta persona"
                  onClick={() => {
                    setFormPeriodo((f) => ({ ...f, trabajador_id: t.id }))
                    setFiltroPeriodosTrabajadorId(t.id)
                    setPanelPeriodosAbierto(true)
                  }}
                  className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: t.color, color: '#fff' }}
                >
                  +
                </button>
              )}
              {editandoDiasId === t.id ? (
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    className="w-14 border border-gray-300 rounded px-1 py-0.5 text-xs"
                    value={diasEditados}
                    onChange={(e) => setDiasEditados(parseInt(e.target.value) || 0)}
                    autoFocus
                  />
                  <button
                    onClick={() => handleGuardarDiasAnuales(t.id)}
                    className="text-xs font-semibold"
                    style={{ color: DENIM }}
                  >
                    Guardar
                  </button>
                  <button onClick={() => setEditandoDiasId(null)} className="text-xs text-gray-500">
                    Cancelar
                  </button>
                </span>
              ) : (
                <span
                  className={`text-xs font-medium text-gray-600 ${editMode && puedeEditar ? 'cursor-pointer underline decoration-dotted' : ''}`}
                  onClick={() => {
                    if (!editMode || !puedeEditar) return
                    setEditandoDiasId(t.id)
                    setDiasEditados(t.dias_anuales)
                  }}
                >
                  {usados}/{t.dias_anuales} · quedan {quedan}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Navegación de año */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <button
          onClick={irAnioAnterior}
          className="w-9 h-9 rounded-full border font-bold transition-colors hover:bg-gray-50"
          style={{ borderColor: '#cbd5e1', color: DENIM }}
        >
          ←
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold" style={{ color: DENIM }}>{anioActivo}</h2>
          <button
            onClick={irHoy}
            className="text-xs px-3 py-1.5 rounded-full font-semibold text-white transition-colors"
            style={{ backgroundColor: PUMPKIN }}
          >
            Hoy
          </button>
        </div>
        <button
          onClick={irAnioSiguiente}
          className="w-9 h-9 rounded-full border font-bold transition-colors hover:bg-gray-50"
          style={{ borderColor: '#cbd5e1', color: DENIM }}
        >
          →
        </button>
      </div>

      {/* Calendario: los 12 meses del año a la vez */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }, (_, mes) => {
          const nombreMes = new Date(anioActivo, mes, 1).toLocaleDateString('es-ES', { month: 'long' })
          return (
            <div key={mes} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100" style={{ backgroundColor: '#f4f7fb' }}>
                <h3 className="text-sm font-bold capitalize" style={{ color: DENIM }}>{nombreMes}</h3>
              </div>
              <div className="grid grid-cols-7">
                {DIAS_SEMANA.map((d, idx) => (
                  <div
                    key={d}
                    className={`text-center text-[10px] font-medium py-1 ${
                      idx === 5 || idx === 6 ? 'text-gray-500 bg-gray-50' : 'text-gray-400'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>
              {semanasDelMes(mes).map((semana, i) => (
                <div key={i} className="grid grid-cols-7">
                  {semana.map((d, j) => {
                    if (!d) return <div key={j} className="h-7" />
                    const k = keyLocal(d)
                    const entradas = dayMapAnio.get(k) ?? []
                    const festivo = festivoPorFecha.get(k)
                    const esHoy = k === hoyKey
                    const esPasado = d < hoyMedianoche
                    const esFinde = j === 5 || j === 6
                    return (
                      <button
                        key={j}
                        onClick={() => seleccionarDia(k)}
                        title={festivo ? festivo.nombre : undefined}
                        className={`h-7 text-[12px] relative hover:brightness-95 transition flex items-center justify-center ${
                          esPasado ? 'opacity-50' : ''
                        }`}
                        style={{
                          ...estiloFondoDia(entradas, !!festivo, esFinde),
                          ...(esHoy ? { boxShadow: `inset 0 0 0 2px ${DENIM}` } : {}),
                        }}
                      >
                        {festivo && entradas.length > 0 && (
                          <span className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
                        )}
                        <span
                          className={
                            entradas.length > 0
                              ? 'text-white font-bold'
                              : festivo
                                ? 'text-amber-900 font-bold'
                                : esFinde
                                  ? 'text-gray-700 font-bold'
                                  : 'text-gray-900 font-bold'
                          }
                          style={entradas.length > 0 ? { textShadow: '0 1px 2px rgba(0,0,0,0.35)' } : undefined}
                        >
                          {d.getDate()}
                        </span>
                        {entradas.length > 1 && (
                          <span className="absolute -top-0.5 -right-0.5 bg-gray-900 text-white text-[8px] rounded-full w-3 h-3 flex items-center justify-center">
                            {entradas.length}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Modal de detalle del día */}
      {diaSeleccionado && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg capitalize">
                {parseLocal(diaSeleccionado).toLocaleDateString('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </h3>
              <button onClick={() => setDiaSeleccionado(null)} className="text-gray-400 hover:text-gray-700">
                ✕
              </button>
            </div>

            {festivoDia && (
              <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-sm flex items-center justify-between">
                <span>
                  🎉 <strong>{festivoDia.nombre}</strong> · {FESTIVO_LABEL[festivoDia.tipo]}
                </span>
                {puedeEditar && (
                  <button onClick={() => handleQuitarFestivo(festivoDia.id)} className="text-red-600 text-xs font-medium">
                    Quitar
                  </button>
                )}
              </div>
            )}

            {entradasDia.length === 0 && <p className="text-sm text-gray-400">Nadie ausente este día.</p>}

            <div className="space-y-2">
              {entradasDia.map((e) => {
                const t = trabajadoresPorId.get(e.trabajadorId)
                return (
                  <div key={e.periodoId} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t?.color }} />
                      {t?.nombre} <span className="text-gray-400">· {TIPO_LABEL[e.tipo]}</span>
                    </span>
                    {puedeEditar && (
                      <button
                        onClick={() => handleQuitarDia(e.periodoId, diaSeleccionado)}
                        className="text-red-600 text-xs font-medium"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {puedeEditar && (
              <div className="border-t border-gray-100 pt-3 space-y-3">
                {trabajadoresDisponiblesDia.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600">Añadir a este día</p>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                        value={formAltaDia.trabajador_id}
                        onChange={(e) => setFormAltaDia((f) => ({ ...f, trabajador_id: e.target.value }))}
                      >
                        <option value="">Trabajador…</option>
                        {trabajadoresDisponiblesDia.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nombre}
                          </option>
                        ))}
                      </select>
                      <select
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                        value={formAltaDia.tipo}
                        onChange={(e) =>
                          setFormAltaDia((f) => ({ ...f, tipo: e.target.value as VacacionesPeriodoTipo }))
                        }
                      >
                        {(Object.keys(TIPO_LABEL) as VacacionesPeriodoTipo[]).map((tp) => (
                          <option key={tp} value={tp}>
                            {TIPO_LABEL[tp]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleAnadirADia}
                      disabled={!formAltaDia.trabajador_id}
                      className="w-full py-1.5 rounded font-semibold text-white text-sm disabled:opacity-40"
                      style={{ backgroundColor: DENIM }}
                    >
                      Añadir
                    </button>
                  </div>
                )}

                {!festivoDia && (
                  <div className="space-y-2">
                    {formFestivoAbierto ? (
                      <>
                        <p className="text-xs font-medium text-gray-600">Marcar como festivo</p>
                        <input
                          placeholder="Nombre del festivo"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                          value={formFestivo.nombre}
                          onChange={(e) => setFormFestivo((f) => ({ ...f, nombre: e.target.value }))}
                        />
                        <select
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                          value={formFestivo.tipo}
                          onChange={(e) =>
                            setFormFestivo((f) => ({ ...f, tipo: e.target.value as VacacionesFestivoTipo }))
                          }
                        >
                          {(Object.keys(FESTIVO_LABEL) as VacacionesFestivoTipo[]).map((tp) => (
                            <option key={tp} value={tp}>
                              {FESTIVO_LABEL[tp]}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={handleGuardarFestivo}
                            disabled={!formFestivo.nombre.trim()}
                            className="flex-1 py-1.5 rounded font-semibold text-white text-sm disabled:opacity-40"
                            style={{ backgroundColor: DENIM }}
                          >
                            Guardar festivo
                          </button>
                          <button
                            onClick={() => setFormFestivoAbierto(false)}
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => setFormFestivoAbierto(true)}
                        className="text-sm text-blue-600 font-medium"
                      >
                        + Marcar como festivo
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Panel lateral de periodos */}
      {panelPeriodosAbierto && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setPanelPeriodosAbierto(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-lg" style={{ color: DENIM }}>
                📋 Periodos
                {filtroPeriodosTrabajadorId &&
                  ` — ${trabajadoresPorId.get(filtroPeriodosTrabajadorId)?.nombre ?? ''}`}
              </h3>
              <button onClick={() => setPanelPeriodosAbierto(false)} className="text-gray-400 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-6">
              <div className="rounded-md p-3 space-y-2" style={{ backgroundColor: '#f4f7fb' }}>
                <p className="text-xs font-semibold" style={{ color: DENIM }}>
                  Añadir un rango de fechas de golpe (en vez de día a día)
                </p>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  value={formPeriodo.trabajador_id}
                  onChange={(e) => setFormPeriodo((f) => ({ ...f, trabajador_id: e.target.value }))}
                >
                  <option value="">Trabajador…</option>
                  {trabajadoresOrdenados.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={formPeriodo.fecha_inicio}
                    onChange={(e) => setFormPeriodo((f) => ({ ...f, fecha_inicio: e.target.value }))}
                  />
                  <input
                    type="date"
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={formPeriodo.fecha_fin}
                    onChange={(e) => setFormPeriodo((f) => ({ ...f, fecha_fin: e.target.value }))}
                  />
                </div>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  value={formPeriodo.tipo}
                  onChange={(e) => setFormPeriodo((f) => ({ ...f, tipo: e.target.value as VacacionesPeriodoTipo }))}
                >
                  {(Object.keys(TIPO_LABEL) as VacacionesPeriodoTipo[]).map((tp) => (
                    <option key={tp} value={tp}>
                      {TIPO_LABEL[tp]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleCrearPeriodo}
                  className="w-full py-1.5 rounded font-semibold text-white text-sm"
                  style={{ backgroundColor: DENIM }}
                >
                  Añadir periodo
                </button>
              </div>

              {filtroPeriodosTrabajadorId && (
                <button
                  onClick={() => setFiltroPeriodosTrabajadorId(null)}
                  className="text-xs font-medium underline decoration-dotted"
                  style={{ color: DENIM }}
                >
                  Ver periodos de todos
                </button>
              )}

              <div className="space-y-2">
                {[...periodos]
                  .filter((p) => !filtroPeriodosTrabajadorId || p.trabajador_id === filtroPeriodosTrabajadorId)
                  .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
                  .map((p) => {
                    const t = trabajadoresPorId.get(p.trabajador_id)
                    if (editandoPeriodoId === p.id) {
                      return (
                        <div key={p.id} className="border border-gray-200 rounded-md p-3 space-y-2">
                          <select
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            value={formEdicionPeriodo.trabajador_id}
                            onChange={(e) =>
                              setFormEdicionPeriodo((f) => ({ ...f, trabajador_id: e.target.value }))
                            }
                          >
                            {trabajadoresOrdenados.map((tw) => (
                              <option key={tw.id} value={tw.id}>
                                {tw.nombre}
                              </option>
                            ))}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="date"
                              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                              value={formEdicionPeriodo.fecha_inicio}
                              onChange={(e) =>
                                setFormEdicionPeriodo((f) => ({ ...f, fecha_inicio: e.target.value }))
                              }
                            />
                            <input
                              type="date"
                              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                              value={formEdicionPeriodo.fecha_fin}
                              onChange={(e) => setFormEdicionPeriodo((f) => ({ ...f, fecha_fin: e.target.value }))}
                            />
                          </div>
                          <select
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            value={formEdicionPeriodo.tipo}
                            onChange={(e) =>
                              setFormEdicionPeriodo((f) => ({ ...f, tipo: e.target.value as VacacionesPeriodoTipo }))
                            }
                          >
                            {(Object.keys(TIPO_LABEL) as VacacionesPeriodoTipo[]).map((tp) => (
                              <option key={tp} value={tp}>
                                {TIPO_LABEL[tp]}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleGuardarEdicionPeriodo(p.id)}
                              className="px-3 py-1.5 rounded font-semibold text-white text-sm"
                              style={{ backgroundColor: DENIM }}
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditandoPeriodoId(null)}
                              className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div key={p.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t?.color }} />
                          <div className="min-w-0">
                            <div className="font-medium text-gray-800 truncate">{t?.nombre}</div>
                            <div className="text-xs text-gray-500">
                              {formatearDDMMAAAA(p.fecha_inicio)} – {formatearDDMMAAAA(p.fecha_fin)} · {TIPO_LABEL[p.tipo]}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                          <button onClick={() => abrirEdicionPeriodo(p)} className="text-gray-500 hover:text-gray-800">
                            Editar
                          </button>
                          <button onClick={() => handleBorrarPeriodo(p)} className="text-red-500 hover:text-red-700">
                            Borrar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                {periodos.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-6">No hay periodos registrados.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

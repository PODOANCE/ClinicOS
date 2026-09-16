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

  const [mesActual, setMesActual] = useState(() => {
    const hoy = new Date()
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  })
  const [editMode, setEditMode] = useState(false)
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)
  const [panelPeriodosAbierto, setPanelPeriodosAbierto] = useState(false)

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

  // ── Mapa de días del mes visible ──────────────────────────────────────
  const dayMapMes = useMemo(() => {
    const map = new Map<string, DiaEntrada[]>()
    const inicioMes = mesActual
    const finMes = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0)
    for (const p of periodos) {
      for (const d of diasEnPeriodo(p)) {
        if (d < inicioMes || d > finMes) continue
        const k = keyLocal(d)
        const arr = map.get(k) ?? []
        arr.push({ trabajadorId: p.trabajador_id, periodoId: p.id, tipo: p.tipo })
        map.set(k, arr)
      }
    }
    return map
  }, [periodos, mesActual])

  // ── Días de vacaciones usados por trabajador en el año visible ────────
  const usadosPorTrabajador = useMemo(() => {
    const year = mesActual.getFullYear()
    const map: Record<string, number> = {}
    for (const p of periodos) {
      if (p.tipo !== 'VACACIONES') continue
      for (const d of diasEnPeriodo(p)) {
        if (d.getFullYear() !== year) continue
        if (!isWeekday(d)) continue
        if (festivoKeys.has(keyLocal(d))) continue
        map[p.trabajador_id] = (map[p.trabajador_id] ?? 0) + 1
      }
    }
    return map
  }, [periodos, festivoKeys, mesActual])

  // ── Grid del mes (semanas de lunes a domingo) ─────────────────────────
  const semanas = useMemo(() => {
    const year = mesActual.getFullYear()
    const month = mesActual.getMonth()
    const primerDia = new Date(year, month, 1)
    const ultimoDia = new Date(year, month + 1, 0)
    const offsetInicio = (primerDia.getDay() + 6) % 7
    const dias: (Date | null)[] = Array(offsetInicio).fill(null)
    for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(year, month, d))
    while (dias.length % 7 !== 0) dias.push(null)
    const filas: (Date | null)[][] = []
    for (let i = 0; i < dias.length; i += 7) filas.push(dias.slice(i, i + 7))
    return filas
  }, [mesActual])

  function irMesAnterior() {
    setMesActual((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  }
  function irMesSiguiente() {
    setMesActual((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
  }
  function irHoy() {
    const hoy = new Date()
    setMesActual(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  }

  function estiloFondoDia(entradas: DiaEntrada[]): React.CSSProperties {
    if (entradas.length === 0) return {}
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
    if (!confirm(`¿Eliminar el periodo de ${trabajador?.nombre ?? ''} (${p.fecha_inicio} – ${p.fecha_fin})?`)) return
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

  const tituloMes =
    mesActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).charAt(0).toUpperCase() +
    mesActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).slice(1)

  const hoyKey = keyLocal(new Date())
  const hoyMedianoche = new Date()
  hoyMedianoche.setHours(0, 0, 0, 0)

  const festivoDia = diaSeleccionado ? festivoPorFecha.get(diaSeleccionado) : undefined
  const entradasDia = diaSeleccionado ? dayMapMes.get(diaSeleccionado) ?? [] : []
  const trabajadoresDisponiblesDia = trabajadoresOrdenados.filter(
    (t) => !entradasDia.some((e) => e.trabajadorId === t.id)
  )

  return (
    <div className="p-6 space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Vacaciones</h1>
          <p className="text-gray-600 mt-1 text-sm">Ausencias del equipo — {trabajadores.length} personas</p>
        </div>
        <div className="flex items-center gap-2">
          {puedeEditar && (
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`px-4 py-2 rounded-md text-sm font-medium border ${
                editMode ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              {editMode ? '✅ Listo' : '✏️ Editar'}
            </button>
          )}
          {editMode && puedeEditar && (
            <button
              onClick={() => setPanelPeriodosAbierto(true)}
              className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
            >
              📋 Periodos
            </button>
          )}
        </div>
      </div>

      {editMode && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-md px-4 py-2">
          ✏️ Modo edición — haz clic en un día para añadir una ausencia o marcar un festivo.
        </div>
      )}

      {/* Leyenda de equipo */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4">
        {trabajadoresOrdenados.map((t) => {
          const usados = usadosPorTrabajador[t.id] ?? 0
          const quedan = t.dias_anuales - usados
          return (
            <div key={t.id} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
              <span className="text-sm font-medium text-gray-800">{t.nombre}</span>
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
                    className="text-xs text-blue-600 font-medium"
                  >
                    Guardar
                  </button>
                  <button onClick={() => setEditandoDiasId(null)} className="text-xs text-gray-500">
                    Cancelar
                  </button>
                </span>
              ) : (
                <span
                  className={`text-xs text-gray-500 ${editMode && puedeEditar ? 'cursor-pointer underline decoration-dotted' : ''}`}
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

      {/* Navegación de mes */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow p-3">
        <button onClick={irMesAnterior} className="w-9 h-9 rounded border border-gray-300 text-gray-700 hover:bg-gray-100">
          ←
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800">{tituloMes}</h2>
          <button onClick={irHoy} className="text-xs px-2 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-100">
            Hoy
          </button>
        </div>
        <button onClick={irMesSiguiente} className="w-9 h-9 rounded border border-gray-300 text-gray-700 hover:bg-gray-100">
          →
        </button>
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">
              {d}
            </div>
          ))}
        </div>
        {semanas.map((semana, i) => (
          <div key={i} className="grid grid-cols-7 border-b border-gray-50 last:border-b-0">
            {semana.map((d, j) => {
              if (!d) return <div key={j} className="min-h-[64px] border-r border-gray-50 last:border-r-0 bg-gray-50/40" />
              const k = keyLocal(d)
              const entradas = dayMapMes.get(k) ?? []
              const festivo = festivoPorFecha.get(k)
              const esFinDeSemana = d.getDay() === 0 || d.getDay() === 6
              const esHoy = k === hoyKey
              const esPasado = d < hoyMedianoche
              return (
                <button
                  key={j}
                  onClick={() => setDiaSeleccionado(k)}
                  style={estiloFondoDia(entradas)}
                  className={`min-h-[64px] p-1.5 border-r border-gray-50 last:border-r-0 text-left relative hover:brightness-95 transition ${
                    esFinDeSemana && entradas.length === 0 && !festivo ? 'bg-gray-50/60' : ''
                  } ${esPasado ? 'opacity-60' : ''} ${esHoy ? 'ring-2 ring-inset ring-black' : ''}`}
                >
                  {festivo && <span className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />}
                  <span className="inline-block bg-white/85 text-gray-800 text-xs font-medium rounded px-1">
                    {d.getDate()}
                  </span>
                  {entradas.length > 1 && (
                    <span className="absolute bottom-1 right-1 bg-gray-900 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                      {entradas.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
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
                {editMode && puedeEditar && (
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
                    {editMode && puedeEditar && (
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

            {editMode && puedeEditar && (
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
                      className="w-full py-1.5 bg-black text-white rounded text-sm disabled:opacity-40"
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
                            className="flex-1 py-1.5 bg-black text-white rounded text-sm disabled:opacity-40"
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
              <h3 className="font-semibold text-lg">📋 Periodos</h3>
              <button onClick={() => setPanelPeriodosAbierto(false)} className="text-gray-400 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-6">
              <div className="bg-gray-50 rounded-md p-3 space-y-2">
                <p className="text-xs font-medium text-gray-600">Añadir periodo</p>
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
                <button onClick={handleCrearPeriodo} className="w-full py-1.5 bg-black text-white rounded text-sm">
                  Añadir periodo
                </button>
              </div>

              <div className="space-y-2">
                {[...periodos]
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
                              className="px-3 py-1.5 bg-black text-white rounded text-sm"
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
                              {p.fecha_inicio} – {p.fecha_fin} · {TIPO_LABEL[p.tipo]}
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

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@/lib/contexts/UserContext'
import { getUserCentro } from '@/lib/supabase/queries/tasks'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import {
  getPanelServicios,
  crearPanelServicio,
  actualizarPanelServicio,
  eliminarPanelServicio,
  getPanelFacturacion,
  upsertPanelFacturacion,
  getPanelServiciosRealizados,
  upsertPanelServicioRealizado,
  getPanelServiciosPorProfesional,
  upsertPanelServicioPorProfesional,
  getPanelGastos,
  crearPanelGasto,
  actualizarPanelGasto,
  eliminarPanelGasto,
  getPanelEquipo,
  crearPanelEquipoMiembro,
  actualizarPanelEquipoMiembro,
  eliminarPanelEquipoMiembro,
  getPanelComisionesReglas,
  getPanelComisionesMensual,
  upsertPanelComisionMensual,
} from '@/lib/supabase/queries/panel'
import { canUserAccess } from '@/lib/permissions/validation'
import type {
  PanelServicio,
  PanelFacturacionMensual,
  PanelServicioRealizado,
  PanelServicioPorProfesional,
  PanelGasto,
  PanelEquipoMiembro,
  PanelComisionesReglas,
  PanelComisionMensual,
  Rol,
} from '@/lib/types/models'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const COLORES_ANIO = ['#183B5F', '#F18852', '#94C0D4', '#F5CA77', '#F3B6A1']

// Mismo PIN que la herramienta original. No es la barrera de seguridad real
// (esa es RLS + el permiso PanelControl): es solo para que, si alguien deja
// la sesión abierta, no vea de un vistazo los datos financieros.
const PIN_DIRECCION = '6969'

function eur(n: number): string {
  return Math.round(n).toLocaleString('es-ES') + ' €'
}
function num(n: number): string {
  return Math.round(n).toLocaleString('es-ES')
}

type Tab = 'resumen' | 'servrealizados' | 'porprof' | 'tarifas' | 'facturacion' | 'gastos' | 'equipo' | 'capacidad' | 'comisiones'

const TABS: { id: Tab; label: string; sensible: boolean }[] = [
  { id: 'resumen', label: 'Resumen', sensible: false },
  { id: 'servrealizados', label: 'Servicios realizados', sensible: false },
  { id: 'porprof', label: 'Por profesional', sensible: true },
  { id: 'tarifas', label: 'Tarifas', sensible: true },
  { id: 'facturacion', label: 'Facturación', sensible: false },
  { id: 'gastos', label: 'Gastos', sensible: true },
  { id: 'equipo', label: 'Equipo', sensible: true },
  { id: 'capacidad', label: 'Capacidad', sensible: true },
  { id: 'comisiones', label: 'Comisiones', sensible: true },
]

// ── Fórmula de comisiones (verbatim de la herramienta original) ──────────
function calcTramo(valor: number, base: number, importeBase: number, tramo: number, incremento: number): number {
  if (valor < base) return 0
  const tramos = Math.floor((valor - base) / tramo)
  return importeBase + tramos * incremento
}

export default function PanelControlPage() {
  const { user, loading: userLoading } = useUser()

  const [servicios, setServicios] = useState<PanelServicio[]>([])
  const [facturacion, setFacturacion] = useState<PanelFacturacionMensual[]>([])
  const [serviciosRealizados, setServiciosRealizados] = useState<PanelServicioRealizado[]>([])
  const [porProfesional, setPorProfesional] = useState<PanelServicioPorProfesional[]>([])
  const [gastos, setGastos] = useState<PanelGasto[]>([])
  const [equipo, setEquipo] = useState<PanelEquipoMiembro[]>([])
  const [comisionesReglas, setComisionesReglas] = useState<PanelComisionesReglas | null>(null)
  const [comisionesMensual, setComisionesMensual] = useState<PanelComisionMensual[]>([])

  const [centroId, setCentroId] = useState<string | null>(null)
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('resumen')
  const [modoPresentacion, setModoPresentacion] = useState(true)

  useEffect(() => {
    if (user) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function cargar() {
    if (!user) return
    try {
      setLoading(true)
      const [sv, fa, sr, pp, ga, eq, cr, cm, ce, rls] = await Promise.all([
        getPanelServicios(),
        getPanelFacturacion(),
        getPanelServiciosRealizados(),
        getPanelServiciosPorProfesional(),
        getPanelGastos(),
        getPanelEquipo(),
        getPanelComisionesReglas(),
        getPanelComisionesMensual(),
        getUserCentro(user.id),
        getRolesUsuarioActual(user.id),
      ])
      setServicios(sv)
      setFacturacion(fa)
      setServiciosRealizados(sr)
      setPorProfesional(pp)
      setGastos(ga)
      setEquipo(eq)
      setComisionesReglas(cr)
      setComisionesMensual(cm)
      setCentroId(ce)
      setRoles(rls)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando el panel')
    } finally {
      setLoading(false)
    }
  }

  const puedeVer = canUserAccess(roles, 'PanelControl', 'ver')
  const puedeEditar = canUserAccess(roles, 'PanelControl', 'editar')

  const aniosDisponibles = useMemo(() => {
    const s = new Set<number>()
    facturacion.forEach((f) => s.add(f.anio))
    serviciosRealizados.forEach((f) => s.add(f.anio))
    if (s.size === 0) s.add(new Date().getFullYear())
    return Array.from(s).sort()
  }, [facturacion, serviciosRealizados])

  const [anioActivo, setAnioActivo] = useState<number | null>(null)
  const anio = anioActivo ?? aniosDisponibles[aniosDisponibles.length - 1]

  // ── RESUMEN ──────────────────────────────────────────────────────────
  const totales = useMemo(() => {
    const factAnio = facturacion.filter((f) => f.anio === anio)
    const fact = factAnio.reduce((a, f) => a + Number(f.facturacion), 0)
    const nue = factAnio.reduce((a, f) => a + f.pacientes_nuevos, 0)
    const totVar = gastos.filter((g) => g.tipo === 'VARIABLE').reduce((a, g) => a + Number(g.valor_anual), 0)
    const totFijo = gastos.filter((g) => g.tipo === 'FIJO').reduce((a, g) => a + Number(g.valor_anual), 0)
    const totSal = equipo.reduce((a, p) => a + Number(p.salario_anual), 0)
    const gastoAnual = totVar + totFijo + totSal
    const totServ = serviciosRealizados.filter((s) => s.anio === anio).reduce((a, s) => a + s.cantidad, 0)
    return { fact, nue, totVar, totFijo, totSal, gastoAnual, gastoMes: gastoAnual / 12, totServ }
  }, [facturacion, gastos, equipo, serviciosRealizados, anio])

  if (userLoading || loading) {
    return <div className="p-6 text-gray-500">Cargando panel...</div>
  }
  if (!puedeVer) {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permiso para ver el Panel de Control.</p>
      </div>
    )
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  const tabsVisibles = TABS.filter((t) => !modoPresentacion || !t.sensible)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Panel de Control 360°</h1>
          <p className="text-gray-600 mt-1 text-sm">Año {anio}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={anio}
            onChange={(e) => setAnioActivo(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {aniosDisponibles.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          {puedeEditar && (
            <button
              onClick={() => {
                if (modoPresentacion) {
                  // Quiere desbloquear: exige PIN. Ocultar de nuevo es libre.
                  const pin = prompt('PIN de dirección para ver los datos financieros:')
                  if (pin === null) return
                  if (pin !== PIN_DIRECCION) {
                    alert('PIN incorrecto')
                    return
                  }
                  setModoPresentacion(false)
                  return
                }
                setModoPresentacion(true)
                const tabActualEsSensible = TABS.find((t) => t.id === tab)?.sensible
                if (tabActualEsSensible) setTab('resumen')
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium border ${
                modoPresentacion ? 'bg-white text-gray-700 border-gray-300' : 'bg-orange-500 text-white border-orange-500'
              }`}
            >
              {modoPresentacion ? '🔒 Ver datos financieros' : '🙈 Ocultar datos financieros'}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 flex-wrap">
        {tabsVisibles.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <PanelResumen totales={totales} facturacion={facturacion.filter((f) => f.anio === anio)} />
      )}

      {tab === 'servrealizados' && (
        <PanelServiciosRealizadosTab
          anio={anio}
          servicios={serviciosRealizados}
          puedeEditar={puedeEditar}
          onGuardar={async (servicio, mes, cantidad) => {
            if (!user || !centroId) return
            const actualizado = await upsertPanelServicioRealizado({ servicio, anio, mes, cantidad, centro_id: centroId, actorId: user.id })
            setServiciosRealizados((prev) => {
              const idx = prev.findIndex((s) => s.servicio === servicio && s.anio === anio && s.mes === mes)
              if (idx === -1) return [...prev, actualizado]
              const copia = [...prev]
              copia[idx] = actualizado
              return copia
            })
          }}
        />
      )}

      {tab === 'porprof' && !modoPresentacion && (
        <PanelPorProfesionalTab
          anio={anio}
          datos={porProfesional}
          puedeEditar={puedeEditar}
          onGuardar={async (servicio, mes, profesional, cantidad) => {
            if (!user || !centroId) return
            const actualizado = await upsertPanelServicioPorProfesional({
              servicio,
              anio,
              mes,
              profesional,
              cantidad,
              centro_id: centroId,
              actorId: user.id,
            })
            setPorProfesional((prev) => {
              const idx = prev.findIndex((s) => s.servicio === servicio && s.anio === anio && s.mes === mes && s.profesional === profesional)
              if (idx === -1) return [...prev, actualizado]
              const copia = [...prev]
              copia[idx] = actualizado
              return copia
            })
          }}
        />
      )}

      {tab === 'tarifas' && !modoPresentacion && (
        <PanelTarifasTab
          servicios={servicios}
          puedeEditar={puedeEditar}
          onCrear={async () => {
            if (!user || !centroId) return
            const nuevo = await crearPanelServicio({ nombre: 'Nuevo servicio', precio: 0, centro_id: centroId, actorId: user.id })
            setServicios((prev) => [...prev, nuevo])
          }}
          onActualizar={async (id, campos) => {
            if (!user) return
            const actualizado = await actualizarPanelServicio(id, campos, user.id)
            setServicios((prev) => prev.map((s) => (s.id === id ? actualizado : s)))
          }}
          onEliminar={async (id) => {
            await eliminarPanelServicio(id)
            setServicios((prev) => prev.filter((s) => s.id !== id))
          }}
        />
      )}

      {tab === 'facturacion' && (
        <PanelFacturacionTab
          anio={anio}
          facturacion={facturacion}
          puedeEditar={puedeEditar}
          onGuardar={async (mes, campos) => {
            if (!user || !centroId) return
            const existente = facturacion.find((f) => f.anio === anio && f.mes === mes)
            const actualizado = await upsertPanelFacturacion({
              anio,
              mes,
              facturacion: campos.facturacion ?? existente?.facturacion ?? 0,
              pacientes_nuevos: campos.pacientes_nuevos ?? existente?.pacientes_nuevos ?? 0,
              centro_id: centroId,
              actorId: user.id,
            })
            setFacturacion((prev) => {
              const idx = prev.findIndex((f) => f.anio === anio && f.mes === mes)
              if (idx === -1) return [...prev, actualizado]
              const copia = [...prev]
              copia[idx] = actualizado
              return copia
            })
          }}
        />
      )}

      {tab === 'gastos' && !modoPresentacion && (
        <PanelGastosTab
          gastos={gastos}
          totalSalarios={totales.totSal}
          puedeEditar={puedeEditar}
          onCrear={async (tipo) => {
            if (!user || !centroId) return
            const nuevo = await crearPanelGasto({ tipo, concepto: 'Nuevo concepto', valor_anual: 0, centro_id: centroId, actorId: user.id })
            setGastos((prev) => [...prev, nuevo])
          }}
          onActualizar={async (id, campos) => {
            if (!user) return
            const actualizado = await actualizarPanelGasto(id, campos, user.id)
            setGastos((prev) => prev.map((g) => (g.id === id ? actualizado : g)))
          }}
          onEliminar={async (id) => {
            await eliminarPanelGasto(id)
            setGastos((prev) => prev.filter((g) => g.id !== id))
          }}
        />
      )}

      {tab === 'equipo' && !modoPresentacion && (
        <PanelEquipoTab
          equipo={equipo}
          puedeEditar={puedeEditar}
          onCrear={async () => {
            if (!user || !centroId) return
            const nuevo = await crearPanelEquipoMiembro({ nombre: 'Nuevo', rol: '', salario_anual: 0, centro_id: centroId, actorId: user.id })
            setEquipo((prev) => [...prev, nuevo])
          }}
          onActualizar={async (id, campos) => {
            if (!user) return
            const actualizado = await actualizarPanelEquipoMiembro(id, campos, user.id)
            setEquipo((prev) => prev.map((p) => (p.id === id ? actualizado : p)))
          }}
          onEliminar={async (id) => {
            await eliminarPanelEquipoMiembro(id)
            setEquipo((prev) => prev.filter((p) => p.id !== id))
          }}
        />
      )}

      {tab === 'capacidad' && !modoPresentacion && (
        <PanelCapacidadTab totales={totales} facturacion={facturacion.filter((f) => f.anio === anio)} />
      )}

      {tab === 'comisiones' && !modoPresentacion && comisionesReglas && (
        <PanelComisionesTab
          reglas={comisionesReglas}
          datos={comisionesMensual}
          puedeEditar={puedeEditar}
          onGuardar={async (anioC, mesC, profesional, campos) => {
            if (!user || !centroId) return
            const existente = comisionesMensual.find((c) => c.anio === anioC && c.mes === mesC && c.profesional === profesional)
            const actualizado = await upsertPanelComisionMensual({
              anio: anioC,
              mes: mesC,
              profesional,
              fact_con_plantillas: campos.fact_con_plantillas ?? existente?.fact_con_plantillas ?? 0,
              fact_sin_plantillas: campos.fact_sin_plantillas ?? existente?.fact_sin_plantillas ?? 0,
              total_plantillas: campos.total_plantillas ?? existente?.total_plantillas ?? 0,
              centro_id: centroId,
              actorId: user.id,
            })
            setComisionesMensual((prev) => {
              const idx = prev.findIndex((c) => c.anio === anioC && c.mes === mesC && c.profesional === profesional)
              if (idx === -1) return [...prev, actualizado]
              const copia = [...prev]
              copia[idx] = actualizado
              return copia
            })
          }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// RESUMEN
// ════════════════════════════════════════════════════════════════════════
function PanelResumen({
  totales,
  facturacion,
}: {
  totales: { fact: number; nue: number; gastoAnual: number; gastoMes: number; totServ: number }
  facturacion: PanelFacturacionMensual[]
}) {
  const maxFact = Math.max(...facturacion.map((f) => f.facturacion), 1)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Facturación anual" val={eur(totales.fact)} sub="suma de los 12 meses" />
        <Kpi label="Gasto medio mensual" val={eur(totales.gastoMes)} sub="umbral de rentabilidad" />
        <Kpi label="Gasto anual total" val={eur(totales.gastoAnual)} sub="fijos + variables + salarios" />
        <Kpi label="Resultado anual" val={eur(totales.fact - totales.gastoAnual)} sub="facturación − gastos" />
        <Kpi label="Servicios realizados" val={num(totales.totServ)} sub="total del año" />
        <Kpi label="Pacientes nuevos" val={num(totales.nue)} sub="en el año" />
      </div>

      {!totales.fact ? (
        <div className="bg-orange-50 border-l-4 border-orange-400 rounded-md p-4 text-sm">
          Aún no has introducido facturación para este año. Ve a la pestaña Facturación.
        </div>
      ) : (
        <>
          <div
            className={`rounded-md p-4 text-sm border-l-4 ${
              totales.fact >= totales.gastoAnual ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
            }`}
          >
            {totales.fact >= totales.gastoAnual ? (
              <>
                Resultado positivo: <b>{eur(totales.fact - totales.gastoAnual)}</b> por encima del umbral anual.
              </>
            ) : (
              <>
                Estás <b>{eur(totales.gastoAnual - totales.fact)}</b> por debajo del umbral anual. Revisa gastos o facturación.
              </>
            )}
          </div>
        </>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-semibold mb-3">Facturación mensual</h3>
          <div className="space-y-1.5">
            {facturacion.map((f) => (
              <BarraFila key={f.mes} label={MESES[f.mes - 1]} valor={f.facturacion} max={maxFact} texto={f.facturacion > 0 ? eur(f.facturacion) : ''} color="#183B5F" />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-semibold mb-1">¿Cubres el umbral cada mes?</h3>
          <p className="text-xs text-gray-400 mb-3">Verde = por encima del gasto medio. Rojo = por debajo.</p>
          <div className="space-y-1.5">
            {facturacion.map((f) => {
              const ok = f.facturacion >= totales.gastoMes
              return (
                <BarraFila
                  key={f.mes}
                  label={MESES[f.mes - 1]}
                  valor={f.facturacion}
                  max={totales.gastoMes || 1}
                  texto={f.facturacion ? (ok ? '✓' : '✗') : ''}
                  color={!f.facturacion ? '#cbd5e1' : ok ? '#16a34a' : '#dc2626'}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, val, sub }: { label: string; val: string; sub: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-xs font-semibold text-gray-500 uppercase">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{val}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  )
}

function BarraFila({ label, valor, max, texto, color }: { label: string; valor: number; max: number; texto: string; color: string }) {
  const w = Math.min(Math.max((valor / max) * 100, 0), 100)
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-xs text-gray-400 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
        <div className="h-full flex items-center pl-2 text-white text-xs font-semibold" style={{ width: `${w}%`, background: color }}>
          {texto}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// SERVICIOS REALIZADOS
// ════════════════════════════════════════════════════════════════════════
function PanelServiciosRealizadosTab({
  anio,
  servicios,
  puedeEditar,
  onGuardar,
}: {
  anio: number
  servicios: PanelServicioRealizado[]
  puedeEditar: boolean
  onGuardar: (servicio: string, mes: number, cantidad: number) => Promise<void>
}) {
  const nombres = useMemo(() => Array.from(new Set(servicios.map((s) => s.servicio))).sort(), [servicios])
  const [nuevoNombre, setNuevoNombre] = useState('')

  function valor(nombre: string, mes: number): number {
    return servicios.find((s) => s.servicio === nombre && s.anio === anio && s.mes === mes)?.cantidad ?? 0
  }

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h2 className="font-semibold mb-1">Conteo mensual por servicio — {anio}</h2>
      <p className="text-xs text-gray-400 mb-3">Edita las celdas directamente. Se guarda solo.</p>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="text-sm w-max min-w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left min-w-[180px]">Servicio</th>
              <th className="px-3 py-2 text-right">Total</th>
              {MESES.map((m) => (
                <th key={m} className="px-2 py-2 text-center text-xs">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nombres.map((nombre) => {
              const total = MESES.reduce((a, _m, i) => a + valor(nombre, i + 1), 0)
              return (
                <tr key={nombre} className="border-t border-gray-100">
                  <td className="sticky left-0 bg-white px-3 py-1.5 font-medium">{nombre}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{num(total)}</td>
                  {MESES.map((_m, i) => (
                    <td key={i} className="px-1 py-1">
                      <input
                        type="number"
                        disabled={!puedeEditar}
                        defaultValue={valor(nombre, i + 1)}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value) || 0
                          if (v !== valor(nombre, i + 1)) onGuardar(nombre, i + 1, v)
                        }}
                        className="w-14 text-right border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 outline-none"
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {puedeEditar && (
        <div className="mt-3 flex gap-2">
          <input
            placeholder="Nombre del nuevo servicio"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
          <button
            onClick={() => {
              if (!nuevoNombre.trim()) return
              onGuardar(nuevoNombre.trim(), 1, 0)
              setNuevoNombre('')
            }}
            className="px-3 py-1.5 bg-sky-100 text-sky-800 rounded text-sm font-medium"
          >
            + Añadir servicio
          </button>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// POR PROFESIONAL
// ════════════════════════════════════════════════════════════════════════
function PanelPorProfesionalTab({
  anio,
  datos,
  puedeEditar,
  onGuardar,
}: {
  anio: number
  datos: PanelServicioPorProfesional[]
  puedeEditar: boolean
  onGuardar: (servicio: string, mes: number, profesional: string, cantidad: number) => Promise<void>
}) {
  const [mes, setMes] = useState(1)
  const profesionales = useMemo(() => Array.from(new Set(datos.map((d) => d.profesional))).sort(), [datos])
  const servicios = useMemo(() => Array.from(new Set(datos.filter((d) => d.anio === anio).map((d) => d.servicio))).sort(), [datos, anio])

  function valor(servicio: string, profesional: string): number {
    return datos.find((d) => d.servicio === servicio && d.anio === anio && d.mes === mes && d.profesional === profesional)?.cantidad ?? 0
  }

  const totalesProf = profesionales.map((p) => servicios.reduce((a, s) => a + valor(s, p), 0))
  const maxProf = Math.max(...totalesProf, 1)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-semibold">Servicios por profesional</h2>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1.5 text-sm">
            {MESES_LARGO.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="text-sm w-max min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left min-w-[200px]">Servicio</th>
                {profesionales.map((p) => (
                  <th key={p} className="px-3 py-2 text-center">
                    {p}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {servicios.map((s) => {
                const total = profesionales.reduce((a, p) => a + valor(s, p), 0)
                return (
                  <tr key={s} className="border-t border-gray-100">
                    <td className="sticky left-0 bg-white px-3 py-1.5">{s}</td>
                    {profesionales.map((p) => (
                      <td key={p} className="px-1 py-1">
                        <input
                          type="number"
                          disabled={!puedeEditar}
                          defaultValue={valor(s, p)}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value) || 0
                            if (v !== valor(s, p)) onGuardar(s, mes, p, v)
                          }}
                          className="w-16 text-center border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 outline-none"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right font-semibold">{total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Reparto de carga de {MESES_LARGO[mes - 1]}</h3>
        <div className="space-y-2">
          {profesionales.map((p, i) => (
            <BarraFila key={p} label={p} valor={totalesProf[i]} max={maxProf} texto={`${totalesProf[i]} servicios`} color={COLORES_ANIO[i % COLORES_ANIO.length]} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// TARIFAS
// ════════════════════════════════════════════════════════════════════════
function PanelTarifasTab({
  servicios,
  puedeEditar,
  onCrear,
  onActualizar,
  onEliminar,
}: {
  servicios: PanelServicio[]
  puedeEditar: boolean
  onCrear: () => void
  onActualizar: (id: string, campos: Partial<{ nombre: string; precio: number }>) => void
  onEliminar: (id: string) => void
}) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h2 className="font-semibold mb-3">Tarifas de servicios</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
            <th className="py-2">Servicio</th>
            <th className="py-2 w-32">Precio (€)</th>
            {puedeEditar && <th className="py-2 w-10" />}
          </tr>
        </thead>
        <tbody>
          {servicios.map((s) => (
            <tr key={s.id} className="border-b border-gray-50">
              <td className="py-1.5">
                <input
                  disabled={!puedeEditar}
                  defaultValue={s.nombre}
                  onBlur={(e) => e.target.value !== s.nombre && onActualizar(s.id, { nombre: e.target.value })}
                  className="w-full border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-2 py-1 outline-none"
                />
              </td>
              <td className="py-1.5">
                <input
                  type="number"
                  disabled={!puedeEditar}
                  defaultValue={s.precio}
                  onBlur={(e) => Number(e.target.value) !== s.precio && onActualizar(s.id, { precio: Number(e.target.value) || 0 })}
                  className="w-full border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-2 py-1 outline-none text-right"
                />
              </td>
              {puedeEditar && (
                <td className="py-1.5 text-center">
                  <button onClick={() => onEliminar(s.id)} className="text-red-500 font-bold">
                    ×
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {puedeEditar && (
        <button onClick={onCrear} className="mt-3 px-3 py-1.5 bg-sky-100 text-sky-800 rounded text-sm font-medium">
          + Añadir servicio
        </button>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// FACTURACIÓN
// ════════════════════════════════════════════════════════════════════════
function PanelFacturacionTab({
  anio,
  facturacion,
  puedeEditar,
  onGuardar,
}: {
  anio: number
  facturacion: PanelFacturacionMensual[]
  puedeEditar: boolean
  onGuardar: (mes: number, campos: Partial<{ facturacion: number; pacientes_nuevos: number }>) => void
}) {
  const anios = useMemo(() => Array.from(new Set(facturacion.map((f) => f.anio))).sort(), [facturacion])
  const delAnio = facturacion.filter((f) => f.anio === anio)
  const totFact = delAnio.reduce((a, f) => a + Number(f.facturacion), 0)
  const totNue = delAnio.reduce((a, f) => a + f.pacientes_nuevos, 0)

  function valorAnio(a: number, mes: number): number {
    return facturacion.find((f) => f.anio === a && f.mes === mes)?.facturacion ?? 0
  }
  const maxComp = Math.max(...facturacion.map((f) => f.facturacion), 1)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="font-semibold mb-3">Facturación mes a mes — {anio}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
              <th className="py-2">Mes</th>
              <th className="py-2 w-36">Facturación (€)</th>
              <th className="py-2 w-36">Pacientes nuevos</th>
            </tr>
          </thead>
          <tbody>
            {MESES_LARGO.map((mLabel, i) => {
              const fila = delAnio.find((f) => f.mes === i + 1)
              return (
                <tr key={mLabel} className="border-b border-gray-50">
                  <td className="py-1.5">{mLabel}</td>
                  <td className="py-1.5">
                    <input
                      type="number"
                      disabled={!puedeEditar}
                      defaultValue={fila?.facturacion ?? 0}
                      onBlur={(e) => onGuardar(i + 1, { facturacion: Number(e.target.value) || 0 })}
                      className="w-full border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-2 py-1 outline-none text-right"
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      type="number"
                      disabled={!puedeEditar}
                      defaultValue={fila?.pacientes_nuevos ?? 0}
                      onBlur={(e) => onGuardar(i + 1, { pacientes_nuevos: Number(e.target.value) || 0 })}
                      className="w-full border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-2 py-1 outline-none text-right"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold border-t-2 border-gray-200">
              <td className="py-2">TOTAL</td>
              <td className="py-2 text-right">{num(totFact)}</td>
              <td className="py-2 text-right">{num(totNue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="font-semibold mb-3">Comparativa por años</h2>
        <div className="overflow-x-auto">
          <table className="text-sm w-max min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left">Año</th>
                {MESES.map((m) => (
                  <th key={m} className="px-2 py-2 text-center">
                    {m}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {anios.map((a) => {
                const tot = MESES.reduce((acc, _m, i) => acc + valorAnio(a, i + 1), 0)
                return (
                  <tr key={a} className="border-t border-gray-100">
                    <td className="sticky left-0 bg-white px-3 py-1.5 font-semibold">{a}</td>
                    {MESES.map((_m, i) => (
                      <td key={i} className="px-2 py-1.5 text-center text-xs">
                        {num(valorAnio(a, i + 1))}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right font-semibold">{num(tot)} €</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Evolución anual comparada</h3>
        <div className="flex gap-4 flex-wrap mb-3 text-sm">
          {anios.map((a, i) => (
            <span key={a} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ background: COLORES_ANIO[i % COLORES_ANIO.length] }} />
              {a}
            </span>
          ))}
        </div>
        <div className="space-y-4">
          {anios.map((a, i) => (
            <div key={a}>
              <div className="text-xs font-medium text-gray-500 mb-1">{a}</div>
              <div className="space-y-1">
                {MESES.map((m, j) => (
                  <BarraFila key={m} label={m} valor={valorAnio(a, j + 1)} max={maxComp} texto="" color={COLORES_ANIO[i % COLORES_ANIO.length]} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// GASTOS
// ════════════════════════════════════════════════════════════════════════
function PanelGastosTab({
  gastos,
  totalSalarios,
  puedeEditar,
  onCrear,
  onActualizar,
  onEliminar,
}: {
  gastos: PanelGasto[]
  totalSalarios: number
  puedeEditar: boolean
  onCrear: (tipo: 'VARIABLE' | 'FIJO') => void
  onActualizar: (id: string, campos: Partial<{ concepto: string; valor_anual: number }>) => void
  onEliminar: (id: string) => void
}) {
  function Tabla({ tipo, titulo }: { tipo: 'VARIABLE' | 'FIJO'; titulo: string }) {
    const items = gastos.filter((g) => g.tipo === tipo)
    const total = items.reduce((a, g) => a + Number(g.valor_anual), 0)
    return (
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="font-semibold mb-3">{titulo}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
              <th className="py-2">Concepto</th>
              <th className="py-2 w-28">€/año</th>
              {puedeEditar && <th className="py-2 w-8" />}
            </tr>
          </thead>
          <tbody>
            {items.map((g) => (
              <tr key={g.id} className="border-b border-gray-50">
                <td className="py-1.5">
                  <input
                    disabled={!puedeEditar}
                    defaultValue={g.concepto}
                    onBlur={(e) => e.target.value !== g.concepto && onActualizar(g.id, { concepto: e.target.value })}
                    className="w-full border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-2 py-1 outline-none"
                  />
                </td>
                <td className="py-1.5">
                  <input
                    type="number"
                    disabled={!puedeEditar}
                    defaultValue={g.valor_anual}
                    onBlur={(e) => Number(e.target.value) !== g.valor_anual && onActualizar(g.id, { valor_anual: Number(e.target.value) || 0 })}
                    className="w-full border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-2 py-1 outline-none text-right"
                  />
                </td>
                {puedeEditar && (
                  <td className="py-1.5 text-center">
                    <button onClick={() => onEliminar(g.id)} className="text-red-500 font-bold">
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold border-t-2 border-gray-200">
              <td className="py-2">TOTAL</td>
              <td className="py-2 text-right">{num(total)}</td>
              {puedeEditar && <td />}
            </tr>
          </tfoot>
        </table>
        {puedeEditar && (
          <button onClick={() => onCrear(tipo)} className="mt-3 px-3 py-1.5 bg-sky-100 text-sky-800 rounded text-sm font-medium">
            + Añadir
          </button>
        )}
      </div>
    )
  }

  const totVar = gastos.filter((g) => g.tipo === 'VARIABLE').reduce((a, g) => a + Number(g.valor_anual), 0)
  const totFijo = gastos.filter((g) => g.tipo === 'FIJO').reduce((a, g) => a + Number(g.valor_anual), 0)
  const total = totVar + totFijo + totalSalarios

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Tabla tipo="VARIABLE" titulo="Costes variables (anuales)" />
        <Tabla tipo="FIJO" titulo="Costes fijos de estructura (anuales)" />
      </div>
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="font-semibold mb-3">Resumen de gastos</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-gray-50">
              <td className="py-1.5">Costes variables/año</td>
              <td className="py-1.5 text-right font-semibold">{eur(totVar)}</td>
            </tr>
            <tr className="border-b border-gray-50">
              <td className="py-1.5">Costes fijos estructura/año</td>
              <td className="py-1.5 text-right font-semibold">{eur(totFijo)}</td>
            </tr>
            <tr className="border-b border-gray-50">
              <td className="py-1.5">Salarios equipo/año</td>
              <td className="py-1.5 text-right font-semibold">{eur(totalSalarios)}</td>
            </tr>
            <tr className="border-b border-gray-50 font-bold">
              <td className="py-1.5">GASTO TOTAL ANUAL</td>
              <td className="py-1.5 text-right">{eur(total)}</td>
            </tr>
            <tr className="font-bold">
              <td className="py-1.5">GASTO MEDIO MENSUAL</td>
              <td className="py-1.5 text-right">{eur(total / 12)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-400 mt-2">El gasto medio mensual es la cifra mínima que hay que facturar cada mes para no perder dinero.</p>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// EQUIPO
// ════════════════════════════════════════════════════════════════════════
function PanelEquipoTab({
  equipo,
  puedeEditar,
  onCrear,
  onActualizar,
  onEliminar,
}: {
  equipo: PanelEquipoMiembro[]
  puedeEditar: boolean
  onCrear: () => void
  onActualizar: (id: string, campos: Partial<{ nombre: string; rol: string | null; salario_anual: number }>) => void
  onEliminar: (id: string) => void
}) {
  const total = equipo.reduce((a, p) => a + Number(p.salario_anual), 0)
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h2 className="font-semibold mb-3">Equipo</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
            <th className="py-2">Nombre</th>
            <th className="py-2">Rol</th>
            <th className="py-2 w-36">Salario/año (€)</th>
            {puedeEditar && <th className="py-2 w-8" />}
          </tr>
        </thead>
        <tbody>
          {equipo.map((p) => (
            <tr key={p.id} className="border-b border-gray-50">
              <td className="py-1.5">
                <input
                  disabled={!puedeEditar}
                  defaultValue={p.nombre}
                  onBlur={(e) => e.target.value !== p.nombre && onActualizar(p.id, { nombre: e.target.value })}
                  className="w-full border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-2 py-1 outline-none"
                />
              </td>
              <td className="py-1.5">
                <input
                  disabled={!puedeEditar}
                  defaultValue={p.rol ?? ''}
                  onBlur={(e) => e.target.value !== p.rol && onActualizar(p.id, { rol: e.target.value })}
                  className="w-full border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-2 py-1 outline-none"
                />
              </td>
              <td className="py-1.5">
                <input
                  type="number"
                  disabled={!puedeEditar}
                  defaultValue={p.salario_anual}
                  onBlur={(e) => Number(e.target.value) !== p.salario_anual && onActualizar(p.id, { salario_anual: Number(e.target.value) || 0 })}
                  className="w-full border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-2 py-1 outline-none text-right"
                />
              </td>
              {puedeEditar && (
                <td className="py-1.5 text-center">
                  <button onClick={() => onEliminar(p.id)} className="text-red-500 font-bold">
                    ×
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold border-t-2 border-gray-200">
            <td className="py-2">TOTAL</td>
            <td />
            <td className="py-2 text-right">{num(total)}</td>
            {puedeEditar && <td />}
          </tr>
        </tfoot>
      </table>
      {puedeEditar && (
        <button onClick={onCrear} className="mt-3 px-3 py-1.5 bg-sky-100 text-sky-800 rounded text-sm font-medium">
          + Añadir persona
        </button>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// CAPACIDAD
// ════════════════════════════════════════════════════════════════════════
function PanelCapacidadTab({
  totales,
  facturacion,
}: {
  totales: { fact: number; gastoAnual: number; gastoMes: number }
  facturacion: PanelFacturacionMensual[]
}) {
  const mesesBajoUmbral = facturacion.filter((f) => f.facturacion > 0 && f.facturacion < totales.gastoMes).length
  const margen = totales.fact - totales.gastoAnual
  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-3">
      <h2 className="font-semibold mb-2">Diagnóstico de rentabilidad</h2>
      <div className="bg-gray-50 rounded-md p-3 text-sm">
        <b>Umbral de rentabilidad:</b> necesitas facturar <b>{eur(totales.gastoMes)}/mes</b> ({eur(totales.gastoAnual)}/año) para cubrir todos los gastos.
      </div>
      {totales.fact ? (
        <div className={`rounded-md p-3 text-sm ${margen > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          {margen > 0 ? (
            <>
              Margen anual disponible: <b>{eur(margen)}</b> ({eur(margen / 12)}/mes). Con eso puedes contratar, invertir o ahorrar.
            </>
          ) : (
            <>
              Ahora mismo no cubres gastos. Objetivo prioritario: llegar a <b>{eur(totales.gastoMes)}/mes</b>.
            </>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-500">Introduce tu facturación mensual para ver el diagnóstico completo.</div>
      )}
      {mesesBajoUmbral > 0 && (
        <div className="bg-orange-50 rounded-md p-3 text-sm">
          <b>{mesesBajoUmbral} mes(es)</b> por debajo del gasto medio mensual ({eur(totales.gastoMes)}).
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// COMISIONES
// ════════════════════════════════════════════════════════════════════════
function calcularComisionMes(
  reglas: PanelComisionesReglas,
  filas: PanelComisionMensual[]
): { factTotal: number; superaClinica: boolean; superaBonus: boolean; bonusRecepcion: number; porProf: Record<string, { sp: number; pl: number; total: number; tope: boolean }> } {
  const factTotal = filas.reduce((a, f) => a + Number(f.fact_con_plantillas), 0)
  const superaClinica = factTotal >= reglas.umbral_clinica
  const superaBonus = factTotal >= reglas.umbral_bonus
  const porProf: Record<string, { sp: number; pl: number; total: number; tope: boolean }> = {}
  reglas.profesionales_comisionan.forEach((prof) => {
    const fila = filas.find((f) => f.profesional === prof)
    let sp = 0
    let pl = 0
    let total = 0
    let tope = false
    if (superaClinica) {
      sp = calcTramo(Number(fila?.fact_sin_plantillas ?? 0), reglas.sp_base, reglas.sp_importe_base, reglas.sp_tramo, reglas.sp_incremento)
      pl = calcTramo(Number(fila?.total_plantillas ?? 0), reglas.pl_base, reglas.pl_importe_base, reglas.pl_tramo, reglas.pl_incremento)
      total = sp + pl
      if (total > reglas.tope_comision) {
        total = reglas.tope_comision
        tope = true
      }
    }
    porProf[prof] = { sp, pl, total, tope }
  })
  return { factTotal, superaClinica, superaBonus, bonusRecepcion: superaBonus ? reglas.bonus_recepcion : 0, porProf }
}

function PanelComisionesTab({
  reglas,
  datos,
  puedeEditar,
  onGuardar,
}: {
  reglas: PanelComisionesReglas
  datos: PanelComisionMensual[]
  puedeEditar: boolean
  onGuardar: (anio: number, mes: number, profesional: string, campos: Partial<{ fact_con_plantillas: number; fact_sin_plantillas: number; total_plantillas: number }>) => void
}) {
  const clavesDisponibles = useMemo(() => {
    const s = new Set(datos.map((d) => `${d.anio}-${String(d.mes).padStart(2, '0')}`))
    return Array.from(s).sort().reverse()
  }, [datos])
  const [claveActiva, setClaveActiva] = useState<string | null>(null)
  const clave = claveActiva ?? clavesDisponibles[0]

  const profesionales = useMemo(() => Array.from(new Set(datos.map((d) => d.profesional))).sort(), [datos])

  if (!clave) {
    return <div className="bg-white rounded-lg shadow p-10 text-center text-gray-400">No hay meses de comisiones registrados.</div>
  }

  const [anioC, mesC] = clave.split('-').map(Number)
  const filasMes = datos.filter((d) => d.anio === anioC && d.mes === mesC)
  const resultado = calcularComisionMes(reglas, filasMes)
  const totalComisiones = Object.values(resultado.porProf).reduce((a, p) => a + p.total, 0) + resultado.bonusRecepcion

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-semibold">Comisiones — {MESES_LARGO[mesC - 1]} {anioC}</h2>
          <select value={clave} onChange={(e) => setClaveActiva(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm">
            {clavesDisponibles.map((c) => {
              const [a, m] = c.split('-').map(Number)
              return (
                <option key={c} value={c}>
                  {MESES_LARGO[m - 1]} {a}
                </option>
              )
            })}
          </select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Facturación clínica" val={eur(resultado.factTotal)} sub={`${MESES_LARGO[mesC - 1]} ${anioC}`} />
          <Kpi
            label={`¿Supera ${num(reglas.umbral_clinica)}€?`}
            val={resultado.superaClinica ? 'SÍ' : 'NO'}
            sub={resultado.superaClinica ? 'se calculan comisiones' : 'nadie comisiona'}
          />
          <Kpi label="Total comisiones" val={eur(totalComisiones)} sub="coste empresa del mes" />
          <Kpi
            label="Bonus recepción"
            val={resultado.bonusRecepcion ? eur(resultado.bonusRecepcion) : '—'}
            sub={resultado.superaBonus ? `supera ${num(reglas.umbral_bonus)}€` : `no llega a ${num(reglas.umbral_bonus)}€`}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Facturación del mes por profesional</h3>
        <p className="text-xs text-gray-400 mb-3">Edita cualquier celda. La comisión se recalcula al instante.</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
              <th className="py-2">Profesional</th>
              <th className="py-2 w-32">F. con plantillas</th>
              <th className="py-2 w-32">F. sin plantillas</th>
              <th className="py-2 w-32">Total plantillas</th>
              <th className="py-2 w-24">¿Comisiona?</th>
            </tr>
          </thead>
          <tbody>
            {profesionales.map((p) => {
              const fila = filasMes.find((f) => f.profesional === p)
              const comisiona = reglas.profesionales_comisionan.includes(p)
              return (
                <tr key={p} className="border-b border-gray-50">
                  <td className="py-1.5 font-medium">{p}</td>
                  <td className="py-1.5">
                    <input
                      type="number"
                      disabled={!puedeEditar}
                      defaultValue={fila?.fact_con_plantillas ?? 0}
                      onBlur={(e) => onGuardar(anioC, mesC, p, { fact_con_plantillas: Number(e.target.value) || 0 })}
                      className="w-full border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-2 py-1 outline-none text-right"
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      type="number"
                      disabled={!puedeEditar}
                      defaultValue={fila?.fact_sin_plantillas ?? 0}
                      onBlur={(e) => onGuardar(anioC, mesC, p, { fact_sin_plantillas: Number(e.target.value) || 0 })}
                      className="w-full border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-2 py-1 outline-none text-right"
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      type="number"
                      disabled={!puedeEditar}
                      defaultValue={fila?.total_plantillas ?? 0}
                      onBlur={(e) => onGuardar(anioC, mesC, p, { total_plantillas: Number(e.target.value) || 0 })}
                      className="w-full border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-2 py-1 outline-none text-right"
                    />
                  </td>
                  <td className="py-1.5">{comisiona ? <span className="text-green-600 font-medium">Sí</span> : <span className="text-gray-400">No</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <h3 className="font-semibold mb-3">Resultado de comisiones del mes</h3>
        {!resultado.superaClinica ? (
          <div className="bg-red-50 text-red-800 rounded-md p-3 text-sm">
            La clínica facturó <b>{eur(resultado.factTotal)}</b>, por debajo del umbral de {num(reglas.umbral_clinica)}€. Este mes <b>nadie comisiona</b>, aunque hayan alcanzado sus objetivos individuales.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="py-2">Profesional</th>
                <th className="py-2">Comisión tratamientos</th>
                <th className="py-2">Comisión plantillas</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {reglas.profesionales_comisionan.map((p) => {
                const c = resultado.porProf[p]
                return (
                  <tr key={p} className="border-b border-gray-50">
                    <td className="py-1.5 font-medium">{p}</td>
                    <td className="py-1.5">{eur(c.sp)}</td>
                    <td className="py-1.5">{eur(c.pl)}</td>
                    <td className="py-1.5 font-semibold">
                      {eur(c.total)} {c.tope && <span className="text-xs text-gray-400 font-normal">(tope {num(reglas.tope_comision)}€)</span>}
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td className="py-1.5 font-medium">Recepción</td>
                <td className="py-1.5 text-gray-400" colSpan={2}>
                  bonus si supera {num(reglas.umbral_bonus)}€
                </td>
                <td className="py-1.5 font-semibold">{resultado.bonusRecepcion ? eur(resultado.bonusRecepcion) : '—'}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

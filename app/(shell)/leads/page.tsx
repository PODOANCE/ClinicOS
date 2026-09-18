'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@/lib/contexts/UserContext'
import { getUserCentro } from '@/lib/supabase/queries/tasks'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { getLeadsLlamadas, crearLeadLlamada, eliminarLeadLlamada } from '@/lib/supabase/queries/leads'
import { canUserAccess } from '@/lib/permissions/validation'
import type { LeadLlamada, LeadsResultado, Rol } from '@/lib/types/models'

const SERVICIOS = [
  'Quiropodología',
  'Biomecánica / Plantillas',
  'Podología Infantil',
  'Papilomas',
  'Hongos',
  'Cirugía',
  'Revisión / seguimiento',
  'No sabe',
]

const CANALES = [
  'Google Maps',
  'Google Búsqueda',
  'Instagram',
  'Recomendación paciente',
  'Recomendación médico',
  'Web',
  'Seguro / mutua',
]

const MOTIVOS = ['Precio', 'Sin hueco disponible', 'Se lo piensa', 'Eligió otra clínica', 'Necesitaba más info']

const MOTIVOS_SEGUIMIENTO = ['Se lo piensa', 'Sin hueco disponible', 'Precio', 'Necesitaba más info']

const RESULTADOS: { valor: LeadsResultado; label: string; icono: string }[] = [
  { valor: 'CITA_NUEVO', label: 'Cogió cita — nuevo', icono: '✅' },
  { valor: 'CITA_CONOCIDO', label: 'Cogió cita — conocido', icono: '🔄' },
  { valor: 'NO_NUEVO', label: 'No cogió — nuevo', icono: '❌' },
  { valor: 'NO_CONOCIDO', label: 'No cogió — conocido', icono: '🔁' },
  { valor: 'SEGURO', label: 'Llamada de seguro / mutua', icono: '📋' },
]

const RESULTADO_LABEL: Record<LeadsResultado, string> = {
  CITA_NUEVO: '✅ Cita nuevo',
  CITA_CONOCIDO: '🔄 Cita conocido',
  NO_NUEVO: '❌ No cogió nuevo',
  NO_CONOCIDO: '🔁 No cogió conocido',
  SEGURO: '📋 Seguro',
}

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

const CP_MAP: { prefijos?: string[]; rango?: [number, number]; municipio: string }[] = [
  { prefijos: ['28521', '28522', '28523', '28524', '28525', '28526', '28527', '28528', '28529'], municipio: 'Rivas Vaciamadrid' },
  { prefijos: ['28500', '28510', '28511', '28512', '28513', '28514', '28515', '28516', '28517', '28518', '28519'], municipio: 'Arganda del Rey' },
  { prefijos: ['28820', '28821', '28822', '28823', '28824', '28825'], municipio: 'Coslada' },
  { prefijos: ['28830', '28831', '28832', '28833', '28834', '28835'], municipio: 'San Fernando de Henares' },
  { prefijos: ['28840'], municipio: 'Mejorada del Campo' },
  { prefijos: ['28890'], municipio: 'Loeches' },
  { prefijos: ['28530'], municipio: 'Morata de Tajuña' },
  { prefijos: ['28031', '28032', '28033', '28034', '28038', '28053', '28054'], municipio: 'Vallecas (Madrid)' },
  { rango: [28001, 28099], municipio: 'Madrid capital' },
]

function cpToMunicipio(cp: string): string {
  if (!cp || cp.length < 5) return ''
  for (const entry of CP_MAP) {
    if (entry.prefijos?.includes(cp)) return entry.municipio
    if (entry.rango) {
      const n = parseInt(cp, 10)
      if (n >= entry.rango[0] && n <= entry.rango[1]) return entry.municipio
    }
  }
  if (cp.startsWith('28')) return 'Madrid (Comunidad)'
  return 'Fuera de la Comunidad de Madrid'
}

type Tab = 'form' | 'dashboard' | 'seguimiento' | 'registros'
type FiltroPeriodo = 'mes' | 'semana' | 'dia' | 'rango' | 'todo'

interface FormState {
  servicio: string | null
  servicioOtro: string
  canal: string | null
  canalOtro: string
  cp: string
  resultado: LeadsResultado | null
  motivo: string | null
  motivoOtro: string
  reembolso: string | null
  telefono: string
}

const FORM_VACIO: FormState = {
  servicio: null,
  servicioOtro: '',
  canal: null,
  canalOtro: '',
  cp: '',
  resultado: null,
  motivo: null,
  motivoOtro: '',
  reembolso: null,
  telefono: '',
}

function OpcionBoton({
  seleccionado,
  onClick,
  children,
}: {
  seleccionado: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-3 py-2.5 rounded-lg border text-sm font-medium transition ${
        seleccionado ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
      style={seleccionado ? { backgroundColor: DENIM, borderColor: DENIM } : undefined}
    >
      {children}
    </button>
  )
}

export default function LeadsPage() {
  const { user, loading: userLoading } = useUser()

  const [leads, setLeads] = useState<LeadLlamada[]>([])
  const [centroId, setCentroId] = useState<string | null>(null)
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('form')

  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [enviando, setEnviando] = useState(false)

  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('mes')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [filtroRegistros, setFiltroRegistros] = useState<'todo' | LeadsResultado>('todo')

  useEffect(() => {
    if (user) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function cargar() {
    if (!user) return
    try {
      setLoading(true)
      const [ll, ce, rls] = await Promise.all([getLeadsLlamadas(), getUserCentro(user.id), getRolesUsuarioActual(user.id)])
      setLeads(ll)
      setCentroId(ce)
      setRoles(rls)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando los leads')
    } finally {
      setLoading(false)
    }
  }

  const puedeVer = canUserAccess(roles, 'Leads', 'ver')
  const puedeEditar = canUserAccess(roles, 'Leads', 'editar')

  const municipioCp = form.cp.length === 5 ? cpToMunicipio(form.cp) : ''
  const esNoCita = form.resultado === 'NO_NUEVO' || form.resultado === 'NO_CONOCIDO'
  const esSeguro = form.resultado === 'SEGURO'
  const puedeEnviar = !!form.servicio && !!form.resultado

  async function handleEnviar() {
    if (!user || !centroId || !puedeEnviar) return
    setEnviando(true)
    try {
      const servicio = form.servicio === '__otro__' ? `Otro: ${form.servicioOtro.trim()}` : form.servicio!
      const canal = form.canal ? (form.canal === '__otro__' ? `Otro: ${form.canalOtro.trim()}` : form.canal) : null
      const motivo = form.motivo ? (form.motivo === '__otro__' ? `Otro: ${form.motivoOtro.trim()}` : form.motivo) : null
      const localidad = form.cp.length === 5 ? `${form.cp} — ${municipioCp}` : form.cp.length > 0 ? form.cp : null

      const nuevo = await crearLeadLlamada({
        fecha: new Date().toISOString(),
        servicio,
        canal,
        localidad,
        resultado: form.resultado!,
        motivo,
        reembolso: form.reembolso,
        telefono: esNoCita && form.telefono.trim() ? form.telefono.trim() : null,
        centro_id: centroId,
        actorId: user.id,
      })
      setLeads((prev) => [nuevo, ...prev])
      setForm(FORM_VACIO)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error registrando la llamada')
    } finally {
      setEnviando(false)
    }
  }

  async function handleBorrar(id: string) {
    if (!confirm('¿Seguro que quieres borrar este registro?')) return
    try {
      await eliminarLeadLlamada(id)
      setLeads((prev) => prev.filter((l) => l.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error borrando el registro')
    }
  }

  const leadsFiltradosPeriodo = useMemo(() => {
    const now = new Date()
    if (filtroPeriodo === 'todo') return leads
    if (filtroPeriodo === 'mes') {
      return leads.filter((l) => {
        const d = new Date(l.fecha)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
    }
    if (filtroPeriodo === 'semana') {
      const hace7 = new Date(now)
      hace7.setDate(now.getDate() - 7)
      return leads.filter((l) => new Date(l.fecha) >= hace7)
    }
    if (filtroPeriodo === 'dia') {
      const hoy = now.toISOString().slice(0, 10)
      return leads.filter((l) => l.fecha.slice(0, 10) === hoy)
    }
    if (filtroPeriodo === 'rango') {
      return leads.filter((l) => {
        const d = l.fecha.slice(0, 10)
        if (fechaDesde && d < fechaDesde) return false
        if (fechaHasta && d > fechaHasta) return false
        return true
      })
    }
    return leads
  }, [leads, filtroPeriodo, fechaDesde, fechaHasta])

  const kpis = useMemo(() => {
    const total = leadsFiltradosPeriodo.length
    const citas = leadsFiltradosPeriodo.filter((l) => l.resultado === 'CITA_NUEVO').length
    const conocido = leadsFiltradosPeriodo.filter((l) => l.resultado === 'CITA_CONOCIDO').length
    const no = leadsFiltradosPeriodo.filter((l) => l.resultado === 'NO_NUEVO').length
    const noConocido = leadsFiltradosPeriodo.filter((l) => l.resultado === 'NO_CONOCIDO').length
    const seguro = leadsFiltradosPeriodo.filter((l) => l.resultado === 'SEGURO').length
    const totalCitas = citas + conocido
    const conversion = total > 0 ? Math.round((totalCitas / total) * 100) : 0
    return { total, citas, conocido, no, noConocido, seguro, totalCitas, conversion }
  }, [leadsFiltradosPeriodo])

  function contarPor(campo: 'canal' | 'servicio' | 'motivo', items: LeadLlamada[]) {
    const counts = new Map<string, number>()
    for (const l of items) {
      const val = l[campo]
      if (!val) continue
      counts.set(val, (counts.get(val) ?? 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }

  const barrasCanal = contarPor('canal', leadsFiltradosPeriodo)
  const barrasServicio = contarPor('servicio', leadsFiltradosPeriodo)
  const barrasMotivo = contarPor('motivo', leadsFiltradosPeriodo.filter((l) => l.resultado === 'NO_NUEVO'))

  const barrasLocalidad = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of leadsFiltradosPeriodo) {
      if (!l.localidad) continue
      const mun = l.localidad.split(' — ')[1]?.trim() ?? l.localidad
      counts.set(mun, (counts.get(mun) ?? 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [leadsFiltradosPeriodo])

  const ringGradient = useMemo(() => {
    const { total, citas, conocido, no, noConocido } = kpis
    if (total === 0) return '#e5e7eb'
    const pCita = (citas / total) * 100
    const pConoc = pCita + (conocido / total) * 100
    const pNo = pConoc + (no / total) * 100
    const pNoConoc = pNo + (noConocido / total) * 100
    return `conic-gradient(#22c55e 0% ${pCita}%, #2D7A9B ${pCita}% ${pConoc}%, #ef4444 ${pConoc}% ${pNo}%, #E07B39 ${pNo}% ${pNoConoc}%, #a855f7 ${pNoConoc}% 100%)`
  }, [kpis])

  const seguimiento = useMemo(
    () =>
      leads.filter(
        (l) =>
          (l.resultado === 'NO_NUEVO' || l.resultado === 'NO_CONOCIDO') &&
          l.telefono &&
          l.motivo &&
          MOTIVOS_SEGUIMIENTO.includes(l.motivo)
      ),
    [leads]
  )

  const registrosFiltrados = useMemo(
    () => (filtroRegistros === 'todo' ? leads : leads.filter((l) => l.resultado === filtroRegistros)),
    [leads, filtroRegistros]
  )

  if (userLoading || loading) {
    return <div className="p-6 text-gray-500">Cargando leads...</div>
  }

  if (!puedeVer) {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permiso para ver Leads.</p>
      </div>
    )
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: DENIM }}>Leads · Llamadas</h1>
        <p className="text-gray-500 mt-1 text-sm">{leads.length} llamada(s) registradas en total</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(
          [
            ['form', 'Nueva llamada'],
            ['dashboard', 'Estadísticas'],
            ['seguimiento', 'Seguimiento'],
            ['registros', 'Registros'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="px-5 py-2 rounded-full text-sm font-semibold transition-colors"
            style={
              tab === id
                ? { backgroundColor: DENIM, color: '#fff' }
                : { backgroundColor: '#fff', color: '#4a5a6a', border: '1px solid #e2e8f0' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'form' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Servicio de interés</label>
            <div className="grid grid-cols-2 gap-2">
              {SERVICIOS.map((s) => (
                <OpcionBoton
                  key={s}
                  seleccionado={form.servicio === s}
                  onClick={() => setForm((f) => ({ ...f, servicio: f.servicio === s ? null : s }))}
                >
                  {s}
                </OpcionBoton>
              ))}
              <OpcionBoton
                seleccionado={form.servicio === '__otro__'}
                onClick={() => setForm((f) => ({ ...f, servicio: f.servicio === '__otro__' ? null : '__otro__' }))}
              >
                Otro
              </OpcionBoton>
            </div>
            {form.servicio === '__otro__' && (
              <input
                autoFocus
                placeholder="Especifica el servicio..."
                className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.servicioOtro}
                onChange={(e) => setForm((f) => ({ ...f, servicioOtro: e.target.value }))}
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Resultado de la llamada</label>
            <div className="grid grid-cols-2 gap-2">
              {RESULTADOS.map((r) => (
                <button
                  key={r.valor}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      resultado: f.resultado === r.valor ? null : r.valor,
                      motivo: null,
                      motivoOtro: '',
                      reembolso: null,
                      telefono: '',
                    }))
                  }
                  className={`px-3 py-3 rounded-lg border text-sm font-medium flex items-center gap-2 ${
                    form.resultado === r.valor
                      ? 'text-white'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  } ${r.valor === 'SEGURO' ? 'col-span-2' : ''}`}
                  style={form.resultado === r.valor ? { backgroundColor: DENIM, borderColor: DENIM } : undefined}
                >
                  <span>{r.icono}</span>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {esNoCita && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Motivo (opcional)</label>
                <div className="grid grid-cols-2 gap-2">
                  {MOTIVOS.map((m) => (
                    <OpcionBoton
                      key={m}
                      seleccionado={form.motivo === m}
                      onClick={() => setForm((f) => ({ ...f, motivo: f.motivo === m ? null : m }))}
                    >
                      {m}
                    </OpcionBoton>
                  ))}
                  <OpcionBoton
                    seleccionado={form.motivo === '__otro__'}
                    onClick={() => setForm((f) => ({ ...f, motivo: f.motivo === '__otro__' ? null : '__otro__' }))}
                  >
                    Otro
                  </OpcionBoton>
                </div>
                {form.motivo === '__otro__' && (
                  <input
                    autoFocus
                    placeholder="Especifica el motivo..."
                    className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.motivoOtro}
                    onChange={(e) => setForm((f) => ({ ...f, motivoOtro: e.target.value }))}
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                  Teléfono para seguimiento (opcional)
                </label>
                <input
                  placeholder="Ej: 600 000 000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </div>
            </div>
          )}

          {esSeguro && (
            <div className="border-t border-gray-100 pt-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                ¿Interesado/a en factura para reembolso?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Sí, interesado', 'No, solo preguntaba'].map((r) => (
                  <OpcionBoton
                    key={r}
                    seleccionado={form.reembolso === r}
                    onClick={() => setForm((f) => ({ ...f, reembolso: f.reembolso === r ? null : r }))}
                  >
                    {r}
                  </OpcionBoton>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">¿Cómo nos ha conocido? (opcional)</label>
            <div className="grid grid-cols-2 gap-2">
              {CANALES.map((c) => (
                <OpcionBoton
                  key={c}
                  seleccionado={form.canal === c}
                  onClick={() => setForm((f) => ({ ...f, canal: f.canal === c ? null : c }))}
                >
                  {c}
                </OpcionBoton>
              ))}
              <OpcionBoton
                seleccionado={form.canal === '__otro__'}
                onClick={() => setForm((f) => ({ ...f, canal: f.canal === '__otro__' ? null : '__otro__' }))}
              >
                Otro
              </OpcionBoton>
            </div>
            {form.canal === '__otro__' && (
              <input
                autoFocus
                placeholder="Especifica cómo nos conoció..."
                className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.canalOtro}
                onChange={(e) => setForm((f) => ({ ...f, canalOtro: e.target.value }))}
              />
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Código postal (opcional)</label>
            <input
              inputMode="numeric"
              maxLength={5}
              placeholder="Ej: 28521"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg tracking-widest"
              value={form.cp}
              onChange={(e) => setForm((f) => ({ ...f, cp: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
            />
            {municipioCp && <div className="mt-1 text-sm font-medium" style={{ color: PUMPKIN }}>📍 {municipioCp}</div>}
          </div>

          <button
            onClick={handleEnviar}
            disabled={!puedeEnviar || enviando}
            className="w-full py-3 rounded-full font-semibold text-sm text-white disabled:opacity-40 transition-colors"
            style={{ backgroundColor: DENIM }}
          >
            {enviando ? 'Guardando...' : 'Registrar llamada'}
          </button>
        </div>
      )}

      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex gap-2 flex-wrap">
            {(['mes', 'semana', 'dia', 'rango', 'todo'] as FiltroPeriodo[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltroPeriodo(f)}
                className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={
                  filtroPeriodo === f
                    ? { backgroundColor: DENIM, color: '#fff' }
                    : { backgroundColor: '#fff', color: '#4a5a6a', border: '1px solid #e2e8f0' }
                }
              >
                {{ mes: 'Este mes', semana: 'Esta semana', dia: 'Hoy', rango: 'Fechas', todo: 'Todo' }[f]}
              </button>
            ))}
          </div>
          {filtroPeriodo === 'rango' && (
            <div className="flex items-center gap-2">
              <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <span>→</span>
              <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-3">
              <div className="text-2xl font-bold" style={{ color: DENIM }}>{kpis.total}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Llamadas totales</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-3">
              <div className="text-2xl font-bold" style={{ color: DENIM }}>{kpis.conversion}%</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Tasa de conversión</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="text-2xl font-bold text-emerald-700">{kpis.totalCitas}</div>
              <div className="text-xs text-emerald-700 font-medium mt-0.5">Citas conseguidas</div>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <div className="text-2xl font-bold text-red-700">{kpis.no + kpis.noConocido}</div>
              <div className="text-xs text-red-700 font-medium mt-0.5">Llamadas perdidas</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold mb-4" style={{ color: DENIM }}>Conversión de llamadas</h3>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="w-32 h-32 rounded-full flex-shrink-0" style={{ background: ringGradient }} />
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#22c55e' }} />Cita nuevo: {kpis.citas}</div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#2D7A9B' }} />Cita conocido: {kpis.conocido}</div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444' }} />No cogió nuevo: {kpis.no}</div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#E07B39' }} />No cogió conocido: {kpis.noConocido}</div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#a855f7' }} />Seguro: {kpis.seguro}</div>
              </div>
            </div>
          </div>

          {[
            ['Canal de origen', barrasCanal],
            ['Servicio más demandado', barrasServicio],
            ['Motivos de no conversión', barrasMotivo],
            ['Procedencia geográfica', barrasLocalidad],
          ].map(([titulo, barras]) => (
            <div key={titulo as string} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold mb-3" style={{ color: DENIM }}>{titulo as string}</h3>
              {(barras as [string, number][]).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">Sin datos</p>
              ) : (
                <div className="space-y-2">
                  {(barras as [string, number][]).map(([key, val]) => {
                    const max = (barras as [string, number][])[0][1]
                    return (
                      <div key={key} className="flex items-center gap-3 text-sm">
                        <div className="w-40 truncate text-gray-600">{key}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.round((val / max) * 100)}%`, backgroundColor: DENIM }}
                          />
                        </div>
                        <div className="w-6 text-right font-medium">{val}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'seguimiento' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          {seguimiento.length === 0 ? (
            <div className="p-10 text-center text-gray-400">No hay leads pendientes de seguimiento.</div>
          ) : (
            seguimiento.map((l) => (
              <div key={l.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{l.telefono}</div>
                  <div className="text-sm text-gray-500">
                    {l.servicio} · {l.canal ?? 'Sin canal'} · {new Date(l.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <span className="text-sm px-2 py-1 rounded bg-orange-50 text-orange-700">{l.motivo}</span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'registros' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {([['todo', 'Todos'], ...RESULTADOS.map((r) => [r.valor, r.label.split(' — ')[0]])] as [string, string][]).map(
              ([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFiltroRegistros(val as any)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                  style={
                    filtroRegistros === val
                      ? { backgroundColor: DENIM, color: '#fff' }
                      : { backgroundColor: '#fff', color: '#4a5a6a', border: '1px solid #e2e8f0' }
                  }
                >
                  {label}
                </button>
              )
            )}
          </div>
          <div className="text-sm text-gray-500">{registrosFiltrados.length} registro(s)</div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {registrosFiltrados.length === 0 ? (
              <div className="p-10 text-center text-gray-400">Sin registros.</div>
            ) : (
              registrosFiltrados.map((l) => (
                <div key={l.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{l.servicio}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 flex-shrink-0">
                        {RESULTADO_LABEL[l.resultado]}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {[l.canal, l.localidad, l.motivo].filter(Boolean).join(' · ')}
                      {l.telefono ? ` · ${l.telefono}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400">
                      {new Date(l.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {puedeEditar && (
                      <button onClick={() => handleBorrar(l.id)} className="text-red-500 hover:text-red-700 text-sm">
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

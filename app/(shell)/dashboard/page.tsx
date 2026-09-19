'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import { useUser } from '@/lib/contexts/UserContext'
import { getTasks, getNombreUsuario } from '@/lib/supabase/queries/tasks'
import { getRolesUsuarioActual, getStockProductos } from '@/lib/supabase/queries/stock'
import { canUserAccess } from '@/lib/permissions/validation'
import type { Tarea, StockProducto } from '@/lib/types/models'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'
const MAX_ITEMS_PREVIEW = 3

const FRASES_MOTIVACIONALES = [
  'Hoy es un buen día para cuidar pies y sonreír.',
  'Paso a paso se hace el camino.',
  'Un buen equipo hace fáciles los días difíciles.',
  'Cada paciente que ayudamos hoy es un paso adelante.',
  'La constancia es la que hace crecer la clínica.',
  'Pequeños gestos, grandes cambios en cada visita.',
  'Hoy toca dar lo mejor de nosotros, como siempre.',
  'El buen trato se nota, y aquí se nota mucho.',
  'Cuidar de los demás empieza por cuidarnos entre nosotros.',
  'Cada día es una oportunidad para mejorar un poquito más.',
  'La sonrisa de un paciente contento no tiene precio.',
  'Somos un equipo que suma, no que resta.',
  'Hoy es buen día para hacer las cosas con calma y cariño.',
  'Lo que se hace con cuidado, se nota.',
  'Gracias por el trabajo de cada día, aunque no siempre se vea.',
  'Un pequeño detalle puede hacer el día de alguien.',
  'La paciencia y las ganas mueven esta clínica hacia adelante.',
  'Hoy también toca celebrar los pequeños logros.',
  'El buen humor también se receta.',
  'Entre todos, un poco más fácil.',
]

function fraseDelDia(): string {
  const hoy = new Date()
  const inicioAnio = new Date(hoy.getFullYear(), 0, 0)
  const diaDelAnio = Math.floor((hoy.getTime() - inicioAnio.getTime()) / 86400000)
  return FRASES_MOTIVACIONALES[diaDelAnio % FRASES_MOTIVACIONALES.length]
}

function fechaHoraFormateada(fecha: Date): { fecha: string; hora: string } {
  const fechaTexto = fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const horaTexto = fecha.toLocaleTimeString('es-ES')
  return { fecha: fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1), hora: horaTexto }
}

// Nombres como "Andrés y Celia" (cuentas compartidas por varias personas) ya
// vienen listos para el saludo; los nombres completos de una sola persona
// ("Belén Iglesias Arias") se recortan al nombre de pila.
function nombreParaSaludo(nombre: string | null): string | null {
  if (!nombre) return null
  if (nombre.includes(' y ')) return nombre
  return nombre.split(' ')[0]
}

function eur(n: number): string {
  return Math.round(n).toLocaleString('es-ES') + ' €'
}

interface FacturaPendiente {
  id: string
  numero_factura: string | null
  importe_total: number | null
  proveedor: string | null
}

function TarjetaResumen({
  href,
  titulo,
  cantidad,
  cargando,
  children,
}: {
  href: string
  titulo: string
  cantidad: number | null
  cargando: boolean
  children: React.ReactNode
}) {
  const hayPendientes = (cantidad ?? 0) > 0
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-base" style={{ color: DENIM }}>
          {titulo}
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
          style={{ backgroundColor: hayPendientes ? PUMPKIN : '#94C0D4' }}
        >
          {cargando ? '…' : cantidad}
        </span>
      </div>
      <div className="text-sm text-gray-500">{children}</div>
    </Link>
  )
}

export default function DashboardPage() {
  const { user, loading } = useUser()

  const [nombreSaludo, setNombreSaludo] = useState<string | null>(null)
  const [puedeVerFacturas, setPuedeVerFacturas] = useState(false)
  const [puedeVerStock, setPuedeVerStock] = useState(false)
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [facturasPendientes, setFacturasPendientes] = useState<FacturaPendiente[]>([])
  const [materialesPorPedir, setMaterialesPorPedir] = useState<StockProducto[]>([])
  const [cargandoResumen, setCargandoResumen] = useState(true)
  const [ahora, setAhora] = useState<Date | null>(null)

  useEffect(() => {
    if (!user) return
    cargarResumen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    setAhora(new Date())
    const id = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  async function cargarResumen() {
    if (!user) return
    try {
      setCargandoResumen(true)
      const nombre = await getNombreUsuario(user.id)
      setNombreSaludo(nombreParaSaludo(nombre))

      const roles = await getRolesUsuarioActual(user.id)
      const tienePermisoFacturas = canUserAccess(roles, 'Facturas', 'editar')
      setPuedeVerFacturas(tienePermisoFacturas)
      const tienePermisoStock = canUserAccess(roles, 'Stock', 'ver')
      setPuedeVerStock(tienePermisoStock)

      const tareasAbiertas = await getTasks(user.id)
      setTareas(tareasAbiertas)

      if (tienePermisoStock) {
        const productos = await getStockProductos()
        setMaterialesPorPedir(productos.filter((p) => p.stock_actual <= p.stock_minimo))
      }

      if (tienePermisoFacturas) {
        const supabase = createClient() as any
        const { data } = await supabase
          .from('facturas')
          .select('id, numero_factura, importe_total, proveedores(nombre)')
          .eq('activo', true)
          .eq('estado_conciliacion', 'NO_CONCILIADA')
          .order('fecha_emision', { ascending: false, nullsFirst: false })
        setFacturasPendientes(
          (data ?? []).map((f: any) => ({
            id: f.id,
            numero_factura: f.numero_factura,
            importe_total: f.importe_total,
            proveedor: f.proveedores?.nombre ?? null,
          }))
        )
      }
    } catch {
      // El resumen es un extra informativo: si falla, el dashboard sigue siendo usable sin él.
    } finally {
      setCargandoResumen(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Cargando...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: DENIM }}>
            ¡Hola{nombreSaludo ? `, ${nombreSaludo}` : ''}! 👋
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Bienvenido de nuevo a ClinicOS · {fraseDelDia()}</p>
        </div>
        {ahora && (
          <div className="text-right flex-shrink-0">
            <div className="text-sm font-semibold" style={{ color: DENIM }}>
              {fechaHoraFormateada(ahora).fecha}
            </div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: PUMPKIN }}>
              {fechaHoraFormateada(ahora).hora}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
        <TarjetaResumen href="/hoy" titulo="📋 Tareas pendientes" cantidad={tareas.length} cargando={cargandoResumen}>
          {cargandoResumen ? (
            'Cargando…'
          ) : tareas.length === 0 ? (
            'Nada pendiente ahora mismo ✅'
          ) : (
            <ul className="space-y-0.5">
              {tareas.slice(0, MAX_ITEMS_PREVIEW).map((t) => (
                <li key={t.id} className="truncate">· {t.titulo}</li>
              ))}
              {tareas.length > MAX_ITEMS_PREVIEW && <li>+ {tareas.length - MAX_ITEMS_PREVIEW} más</li>}
            </ul>
          )}
        </TarjetaResumen>

        {puedeVerFacturas && (
          <TarjetaResumen
            href="/conciliacion"
            titulo="🧾 Facturas por conciliar"
            cantidad={facturasPendientes.length}
            cargando={cargandoResumen}
          >
            {cargandoResumen ? (
              'Cargando…'
            ) : facturasPendientes.length === 0 ? (
              'Todo conciliado ✅'
            ) : (
              <ul className="space-y-0.5">
                {facturasPendientes.slice(0, MAX_ITEMS_PREVIEW).map((f) => (
                  <li key={f.id} className="truncate">
                    · {f.proveedor ?? f.numero_factura ?? 'Sin proveedor'}
                    {f.importe_total ? ` — ${eur(f.importe_total)}` : ''}
                  </li>
                ))}
                {facturasPendientes.length > MAX_ITEMS_PREVIEW && (
                  <li>+ {facturasPendientes.length - MAX_ITEMS_PREVIEW} más</li>
                )}
              </ul>
            )}
          </TarjetaResumen>
        )}

        {puedeVerStock && (
          <TarjetaResumen
            href="/stock"
            titulo="📝 Lista de la compra"
            cantidad={materialesPorPedir.length}
            cargando={cargandoResumen}
          >
            {cargandoResumen ? (
              'Cargando…'
            ) : materialesPorPedir.length === 0 ? (
              'Stock al día ✅'
            ) : (
              <ul className="space-y-0.5">
                {materialesPorPedir.slice(0, MAX_ITEMS_PREVIEW).map((p) => (
                  <li key={p.id} className="truncate">
                    · {p.nombre} ({p.stock_actual} {p.unidad})
                  </li>
                ))}
                {materialesPorPedir.length > MAX_ITEMS_PREVIEW && (
                  <li>+ {materialesPorPedir.length - MAX_ITEMS_PREVIEW} más</li>
                )}
              </ul>
            )}
          </TarjetaResumen>
        )}
      </div>
    </div>
  )
}

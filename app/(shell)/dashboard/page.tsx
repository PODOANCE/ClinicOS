'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import { useUser } from '@/lib/contexts/UserContext'
import { getTasks, getNombreUsuario } from '@/lib/supabase/queries/tasks'
import { getRolesUsuarioActual } from '@/lib/supabase/queries/stock'
import { canUserAccess } from '@/lib/permissions/validation'
import type { Tarea } from '@/lib/types/models'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'
const MAX_ITEMS_PREVIEW = 3

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
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [facturasPendientes, setFacturasPendientes] = useState<FacturaPendiente[]>([])
  const [cargandoResumen, setCargandoResumen] = useState(true)

  useEffect(() => {
    if (!user) return
    cargarResumen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function cargarResumen() {
    if (!user) return
    try {
      setCargandoResumen(true)
      const nombre = await getNombreUsuario(user.id)
      setNombreSaludo(nombreParaSaludo(nombre))

      const roles = await getRolesUsuarioActual(user.id)
      const tienePermisoFacturas = canUserAccess(roles, 'Facturas', 'editar')
      setPuedeVerFacturas(tienePermisoFacturas)

      const tareasAbiertas = await getTasks(user.id)
      setTareas(tareasAbiertas)

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
      <div>
        <h1 className="text-3xl font-bold" style={{ color: DENIM }}>
          ¡Hola{nombreSaludo ? `, ${nombreSaludo}` : ''}! 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Bienvenido de nuevo a ClinicOS</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
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
      </div>
    </div>
  )
}

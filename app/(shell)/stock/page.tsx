'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@/lib/contexts/UserContext'
import { createClient } from '@/lib/supabase/browser'
import { getUserCentro } from '@/lib/supabase/queries/tasks'
import {
  getStockCategorias,
  getStockProductos,
  getRolesUsuarioActual,
  crearStockCategoria,
  crearStockProducto,
  actualizarStockProducto,
  archivarStockProducto,
} from '@/lib/supabase/queries/stock'
import { canUserAccess } from '@/lib/permissions/validation'
import type {
  StockCategoria,
  StockProducto,
  StockMovimientoTipo,
  Rol,
} from '@/lib/types/models'

type Estado = 'ok' | 'warn' | 'danger'

function getEstado(p: StockProducto): Estado {
  if (p.stock_actual <= p.stock_critico) return 'danger'
  if (p.stock_actual <= p.stock_minimo) return 'warn'
  return 'ok'
}

function necesitaPedido(p: StockProducto): boolean {
  return p.stock_actual <= p.stock_minimo
}

const dotColor: Record<Estado, string> = {
  ok: 'bg-green-500',
  warn: 'bg-yellow-500',
  danger: 'bg-red-500',
}

const badgeColor: Record<Estado, string> = {
  ok: 'bg-green-100 text-green-800',
  warn: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
}

interface ProductoForm {
  nombre: string
  unidad: string
  stock_minimo: number
  stock_critico: number
  proveedor_texto: string
  categoria_id: string
  stock_inicial: number
}

const FORM_VACIO: ProductoForm = {
  nombre: '',
  unidad: '',
  stock_minimo: 0,
  stock_critico: 0,
  proveedor_texto: '',
  categoria_id: '',
  stock_inicial: 0,
}

export default function StockPage() {
  const { user, loading: userLoading } = useUser()

  const [categorias, setCategorias] = useState<StockCategoria[]>([])
  const [productos, setProductos] = useState<StockProducto[]>([])
  const [centroId, setCentroId] = useState<string | null>(null)
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tabActivo, setTabActivo] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [pedidoAbierto, setPedidoAbierto] = useState(false)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  // Edición de producto (id del producto en edición, o null)
  const [editandoProductoId, setEditandoProductoId] = useState<string | null>(null)
  const [formEdicion, setFormEdicion] = useState<ProductoForm>(FORM_VACIO)

  // Alta de producto (id de grupo destino, o null)
  const [anadiendoAGrupoId, setAnadiendoAGrupoId] = useState<string | null>(null)
  const [formAlta, setFormAlta] = useState<ProductoForm>(FORM_VACIO)

  // Ajuste manual (producto sobre el que se está ajustando)
  const [ajustandoProducto, setAjustandoProducto] = useState<StockProducto | null>(null)
  const [ajusteSigno, setAjusteSigno] = useState<'positivo' | 'negativo'>('positivo')
  const [ajusteCantidad, setAjusteCantidad] = useState(1)
  const [ajusteMotivo, setAjusteMotivo] = useState('')

  // Grupos nuevos / renombrar
  const [anadiendoGrupoACatId, setAnadiendoGrupoACatId] = useState<string | null>(null)
  const [nombreGrupoNuevo, setNombreGrupoNuevo] = useState('')
  const [renombrandoGrupoId, setRenombrandoGrupoId] = useState<string | null>(null)
  const [nombreGrupoEditado, setNombreGrupoEditado] = useState('')

  useEffect(() => {
    if (user) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function cargar() {
    if (!user) return
    try {
      setLoading(true)
      const [cats, prods, ce, rls] = await Promise.all([
        getStockCategorias(),
        getStockProductos(),
        getUserCentro(user.id),
        getRolesUsuarioActual(user.id),
      ])
      setCategorias(cats)
      setProductos(prods)
      setCentroId(ce)
      setRoles(rls)
      setTabActivo((actual) => {
        if (actual) return actual
        const primera = cats.filter((c) => c.nivel === 1).sort((a, b) => a.orden - b.orden)[0]
        return primera ? primera.id : actual
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando el stock')
    } finally {
      setLoading(false)
    }
  }

  const puedeVer = canUserAccess(roles, 'Stock', 'ver')
  const puedeEditar = canUserAccess(roles, 'Stock', 'editar')
  const puedeCrear = canUserAccess(roles, 'Stock', 'crear')
  const puedeArchivar = canUserAccess(roles, 'Stock', 'archivar')
  const puedeGestionar = puedeEditar || puedeCrear || puedeArchivar

  const categoriasNivel1 = useMemo(
    () => categorias.filter((c) => c.nivel === 1).sort((a, b) => a.orden - b.orden),
    [categorias]
  )

  function gruposDe(catId: string): StockCategoria[] {
    return categorias
      .filter((c) => c.nivel === 2 && c.padre_id === catId)
      .sort((a, b) => a.orden - b.orden)
  }

  function productosDeGrupo(grupoId: string): StockProducto[] {
    return productos
      .filter((p) => p.categoria_id === grupoId)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }

  const resumen = useMemo(() => {
    let ok = 0
    let warn = 0
    let danger = 0
    for (const p of productos) {
      const e = getEstado(p)
      if (e === 'ok') ok++
      else if (e === 'warn') warn++
      else danger++
    }
    return { ok, warn, danger, total: productos.length, pedir: productos.filter(necesitaPedido).length }
  }, [productos])

  async function llamarMovimiento(
    productoId: string,
    tipo: StockMovimientoTipo,
    cantidad: number,
    motivo?: string
  ): Promise<number> {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch('/api/stock/movimiento', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ producto_id: productoId, tipo, cantidad, motivo }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Error registrando el movimiento')
    }
    return data.stockNuevo as number
  }

  async function handleClick(producto: StockProducto, tipo: 'ENTRADA' | 'CONSUMO') {
    if (!puedeEditar || busyIds.has(producto.id)) return
    setBusyIds((prev) => new Set(prev).add(producto.id))
    try {
      const nuevo = await llamarMovimiento(producto.id, tipo, 1)
      setProductos((prev) => prev.map((p) => (p.id === producto.id ? { ...p, stock_actual: nuevo } : p)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error registrando el movimiento')
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev)
        next.delete(producto.id)
        return next
      })
    }
  }

  async function handleGuardarAjuste() {
    if (!ajustandoProducto) return
    if (!ajusteMotivo.trim()) {
      alert('El ajuste requiere un motivo')
      return
    }
    if (ajusteCantidad <= 0) {
      alert('La cantidad debe ser mayor que cero')
      return
    }
    const tipo: StockMovimientoTipo = ajusteSigno === 'positivo' ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO'
    try {
      const nuevo = await llamarMovimiento(ajustandoProducto.id, tipo, ajusteCantidad, ajusteMotivo.trim())
      setProductos((prev) =>
        prev.map((p) => (p.id === ajustandoProducto.id ? { ...p, stock_actual: nuevo } : p))
      )
      setAjustandoProducto(null)
      setAjusteCantidad(1)
      setAjusteMotivo('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error registrando el ajuste')
    }
  }

  function abrirEdicion(p: StockProducto) {
    setEditandoProductoId(p.id)
    setFormEdicion({
      nombre: p.nombre,
      unidad: p.unidad,
      stock_minimo: p.stock_minimo,
      stock_critico: p.stock_critico,
      proveedor_texto: p.proveedor_texto ?? '',
      categoria_id: p.categoria_id,
      stock_inicial: 0,
    })
  }

  async function handleGuardarEdicion(productoId: string) {
    if (formEdicion.stock_critico > formEdicion.stock_minimo) {
      alert('El stock crítico no puede ser mayor que el mínimo')
      return
    }
    try {
      const actualizado = await actualizarStockProducto(productoId, {
        nombre: formEdicion.nombre,
        unidad: formEdicion.unidad,
        stock_minimo: formEdicion.stock_minimo,
        stock_critico: formEdicion.stock_critico,
        proveedor_texto: formEdicion.proveedor_texto.trim() || null,
        categoria_id: formEdicion.categoria_id,
      })
      setProductos((prev) => prev.map((p) => (p.id === productoId ? actualizado : p)))
      setEditandoProductoId(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error guardando los cambios')
    }
  }

  async function handleArchivarProducto(p: StockProducto) {
    if (!confirm(`¿Archivar "${p.nombre}"? Dejará de aparecer en el listado; su historial se conserva.`)) return
    try {
      await archivarStockProducto(p.id)
      setProductos((prev) => prev.filter((x) => x.id !== p.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error archivando el material')
    }
  }

  async function handleCrearProducto(grupoId: string) {
    if (!formAlta.nombre.trim() || !formAlta.unidad.trim()) {
      alert('Nombre y unidad son obligatorios')
      return
    }
    if (formAlta.stock_critico > formAlta.stock_minimo) {
      alert('El stock crítico no puede ser mayor que el mínimo')
      return
    }
    if (!centroId) return
    try {
      const creado = await crearStockProducto({
        nombre: formAlta.nombre.trim(),
        unidad: formAlta.unidad.trim(),
        categoria_id: grupoId,
        stock_minimo: formAlta.stock_minimo,
        stock_critico: formAlta.stock_critico,
        proveedor_texto: formAlta.proveedor_texto.trim() || null,
        proveedor_id: null,
        centro_id: centroId,
      })
      let stockFinal = creado.stock_actual
      if (formAlta.stock_inicial > 0) {
        stockFinal = await llamarMovimiento(creado.id, 'ENTRADA', formAlta.stock_inicial)
      }
      setProductos((prev) => [...prev, { ...creado, stock_actual: stockFinal }])
      setAnadiendoAGrupoId(null)
      setFormAlta(FORM_VACIO)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error creando el material')
    }
  }

  async function handleCrearGrupo(catPadreId: string) {
    if (!nombreGrupoNuevo.trim() || !centroId) return
    try {
      const orden = gruposDe(catPadreId).length
      const nuevo = await crearStockCategoria({
        nombre: nombreGrupoNuevo.trim(),
        nivel: 2,
        padre_id: catPadreId,
        orden,
        centro_id: centroId,
      })
      setCategorias((prev) => [...prev, nuevo])
      setAnadiendoGrupoACatId(null)
      setNombreGrupoNuevo('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error creando el grupo')
    }
  }

  async function handleRenombrarGrupo(grupoId: string) {
    if (!nombreGrupoEditado.trim()) return
    const supabase = createClient() as any
    const { data, error } = await supabase
      .from('stock_categorias')
      .update({ nombre: nombreGrupoEditado.trim() })
      .eq('id', grupoId)
      .select()
      .single()
    if (error) {
      alert('Error renombrando el grupo: ' + error.message)
      return
    }
    setCategorias((prev) => prev.map((c) => (c.id === grupoId ? data : c)))
    setRenombrandoGrupoId(null)
  }

  async function handleArchivarGrupo(grupo: StockCategoria) {
    if (productosDeGrupo(grupo.id).length > 0) {
      alert('No se puede archivar un grupo que todavía tiene materiales. Muévelos o archívalos primero.')
      return
    }
    if (!confirm(`¿Archivar el grupo "${grupo.nombre}"?`)) return
    const supabase = createClient() as any
    const { error } = await supabase
      .from('stock_categorias')
      .update({ activo: false, archived_at: new Date().toISOString() })
      .eq('id', grupo.id)
    if (error) {
      alert('Error archivando el grupo: ' + error.message)
      return
    }
    setCategorias((prev) => prev.filter((c) => c.id !== grupo.id))
  }

  // ── Lista de compra ──────────────────────────────────────────────────
  const listaCompra = useMemo(() => {
    const pendientes = productos.filter(necesitaPedido)
    const urgentes = pendientes.filter((p) => getEstado(p) === 'danger')
    const pronto = pendientes.filter((p) => getEstado(p) === 'warn')

    function agruparPorProveedor(items: StockProducto[]) {
      const grupos = new Map<string, StockProducto[]>()
      for (const p of items) {
        const key = p.proveedor_texto?.trim() || 'Sin proveedor'
        if (!grupos.has(key)) grupos.set(key, [])
        grupos.get(key)!.push(p)
      }
      return Array.from(grupos.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))
    }

    return { urgentes: agruparPorProveedor(urgentes), pronto: agruparPorProveedor(pronto) }
  }, [productos])

  function copiarListaCompra() {
    const fecha = new Date().toLocaleDateString('es-ES')
    let txt = `📋 PEDIDO STOCK — ClinicOS\n${fecha}\n\n`

    if (listaCompra.urgentes.length > 0) {
      txt += `── 🔴 URGENTE — PEDIR YA ──\n`
      for (const [prov, items] of listaCompra.urgentes) {
        txt += `\n${prov}:\n`
        for (const p of items) txt += ` • ${p.nombre} (quedan ${p.stock_actual} ${p.unidad})\n`
      }
      txt += '\n'
    }
    if (listaCompra.pronto.length > 0) {
      txt += `── 🟡 REPONER PRONTO ──\n`
      for (const [prov, items] of listaCompra.pronto) {
        txt += `\n${prov}:\n`
        for (const p of items) txt += ` • ${p.nombre} (quedan ${p.stock_actual} ${p.unidad})\n`
      }
    }

    navigator.clipboard
      .writeText(txt)
      .then(() => alert('Lista copiada al portapapeles'))
      .catch(() => alert('No se pudo copiar automáticamente'))
  }

  // ── Render ───────────────────────────────────────────────────────────

  if (userLoading || loading) {
    return <div className="p-6 text-gray-500">Cargando stock...</div>
  }

  if (!puedeVer) {
    return (
      <div className="p-6">
        <p className="text-red-600">No tienes permiso para ver el Stock.</p>
      </div>
    )
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Stock</h1>
          <p className="text-gray-600 mt-1 text-sm">
            {resumen.total} materiales ·{' '}
            <span className="text-green-700">🟢 {resumen.ok}</span> ·{' '}
            <span className="text-yellow-700">🟡 {resumen.warn}</span> ·{' '}
            <span className="text-red-700">🔴 {resumen.danger}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {puedeGestionar && (
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`px-4 py-2 rounded-md text-sm font-medium border ${
                editMode ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              {editMode ? '✅ Listo' : '✏️ Editar'}
            </button>
          )}
          <button
            onClick={() => setPedidoAbierto(true)}
            className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            📋 Necesito pedir ({resumen.pedir})
          </button>
        </div>
      </div>

      {editMode && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-md px-4 py-2">
          ✏️ Modo edición — edita materiales, renombra o crea grupos, añade o archiva materiales.
        </div>
      )}

      {/* Pestañas */}
      <div className="flex gap-2 border-b border-gray-200">
        {categoriasNivel1.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setTabActivo(cat.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tabActivo === cat.id
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {cat.nombre}
          </button>
        ))}
      </div>

      {/* Grupos de la pestaña activa */}
      {tabActivo &&
        gruposDe(tabActivo).map((grupo) => {
          const items = productosDeGrupo(grupo.id)
          const alertas = items.filter((p) => getEstado(p) !== 'ok').length

          return (
            <div key={grupo.id} className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                {renombrandoGrupoId === grupo.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 max-w-xs"
                      value={nombreGrupoEditado}
                      onChange={(e) => setNombreGrupoEditado(e.target.value)}
                      autoFocus
                    />
                    <button
                      onClick={() => handleRenombrarGrupo(grupo.id)}
                      className="text-sm text-blue-600 font-medium"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setRenombrandoGrupoId(null)}
                      className="text-sm text-gray-500"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <h3 className="font-semibold text-gray-800">
                    {grupo.nombre}
                    {alertas > 0 && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        {alertas} por revisar
                      </span>
                    )}
                  </h3>
                )}

                {editMode && renombrandoGrupoId !== grupo.id && (
                  <div className="flex items-center gap-3 text-sm">
                    {puedeEditar && (
                      <button
                        onClick={() => {
                          setRenombrandoGrupoId(grupo.id)
                          setNombreGrupoEditado(grupo.nombre)
                        }}
                        className="text-gray-500 hover:text-gray-800"
                      >
                        Renombrar
                      </button>
                    )}
                    {puedeArchivar && (
                      <button
                        onClick={() => handleArchivarGrupo(grupo)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Archivar grupo
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="divide-y divide-gray-100">
                {items.map((p) => {
                  const estado = getEstado(p)
                  const busy = busyIds.has(p.id)

                  if (editandoProductoId === p.id) {
                    return (
                      <div key={p.id} className="p-4 bg-gray-50 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                            <input
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                              value={formEdicion.nombre}
                              onChange={(e) => setFormEdicion((f) => ({ ...f, nombre: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Unidad</label>
                            <input
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                              value={formEdicion.unidad}
                              onChange={(e) => setFormEdicion((f) => ({ ...f, unidad: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Mínimo</label>
                            <input
                              type="number"
                              min={0}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                              value={formEdicion.stock_minimo}
                              onChange={(e) =>
                                setFormEdicion((f) => ({ ...f, stock_minimo: parseInt(e.target.value) || 0 }))
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Crítico</label>
                            <input
                              type="number"
                              min={0}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                              value={formEdicion.stock_critico}
                              onChange={(e) =>
                                setFormEdicion((f) => ({ ...f, stock_critico: parseInt(e.target.value) || 0 }))
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
                            <input
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                              value={formEdicion.proveedor_texto}
                              onChange={(e) =>
                                setFormEdicion((f) => ({ ...f, proveedor_texto: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Grupo</label>
                            <select
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                              value={formEdicion.categoria_id}
                              onChange={(e) =>
                                setFormEdicion((f) => ({ ...f, categoria_id: e.target.value }))
                              }
                            >
                              {categoriasNivel1.map((cat) => (
                                <optgroup key={cat.id} label={cat.nombre}>
                                  {gruposDe(cat.id).map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.nombre}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Stock actual (no editable aquí)
                            </label>
                            <input
                              disabled
                              className="w-full border border-gray-200 bg-gray-100 rounded px-2 py-1.5 text-sm text-gray-500"
                              value={`${p.stock_actual} ${p.unidad}`}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleGuardarEdicion(p.id)}
                            className="px-3 py-1.5 bg-black text-white rounded text-sm"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditandoProductoId(null)}
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor[estado]}`} />
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">{p.nombre}</div>
                          <div className="text-xs text-gray-500">
                            {p.stock_actual} {p.unidad} · mín {p.stock_minimo}
                            {editMode && ` · crít ${p.stock_critico} · ${p.proveedor_texto || 'sin proveedor'}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`hidden sm:inline-block text-xs px-2 py-0.5 rounded-full ${badgeColor[estado]}`}>
                          {estado === 'ok' ? 'OK' : estado === 'warn' ? 'Reponer' : 'Crítico'}
                        </span>

                        {puedeEditar && (
                          <>
                            <button
                              onClick={() => handleClick(p, 'CONSUMO')}
                              disabled={busy || p.stock_actual === 0}
                              className="w-8 h-8 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                            >
                              −
                            </button>
                            <button
                              onClick={() => handleClick(p, 'ENTRADA')}
                              disabled={busy}
                              className="w-8 h-8 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                            >
                              +
                            </button>
                          </>
                        )}

                        {editMode && (
                          <div className="relative group">
                            <button className="w-8 h-8 rounded border border-gray-300 text-gray-500 hover:bg-gray-100">
                              ⋯
                            </button>
                            <div className="hidden group-focus-within:block group-hover:block absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 w-40 text-sm">
                              {puedeEditar && (
                                <button
                                  onClick={() => abrirEdicion(p)}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                                >
                                  Editar
                                </button>
                              )}
                              {puedeEditar && (
                                <button
                                  onClick={() => {
                                    setAjustandoProducto(p)
                                    setAjusteSigno('positivo')
                                    setAjusteCantidad(1)
                                    setAjusteMotivo('')
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                                >
                                  Ajustar
                                </button>
                              )}
                              {puedeArchivar && (
                                <button
                                  onClick={() => handleArchivarProducto(p)}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600"
                                >
                                  Archivar
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {items.length === 0 && (
                  <div className="px-4 py-6 text-center text-gray-400 text-sm">Sin materiales en este grupo</div>
                )}

                {editMode && puedeCrear && (
                  <div className="p-4">
                    {anadiendoAGrupoId === grupo.id ? (
                      <div className="bg-gray-50 rounded-md p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            placeholder="Nombre"
                            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                            value={formAlta.nombre}
                            onChange={(e) => setFormAlta((f) => ({ ...f, nombre: e.target.value }))}
                          />
                          <input
                            placeholder="Unidad"
                            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                            value={formAlta.unidad}
                            onChange={(e) => setFormAlta((f) => ({ ...f, unidad: e.target.value }))}
                          />
                          <input
                            type="number"
                            min={0}
                            placeholder="Mínimo"
                            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                            value={formAlta.stock_minimo}
                            onChange={(e) =>
                              setFormAlta((f) => ({ ...f, stock_minimo: parseInt(e.target.value) || 0 }))
                            }
                          />
                          <input
                            type="number"
                            min={0}
                            placeholder="Crítico"
                            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                            value={formAlta.stock_critico}
                            onChange={(e) =>
                              setFormAlta((f) => ({ ...f, stock_critico: parseInt(e.target.value) || 0 }))
                            }
                          />
                          <input
                            placeholder="Proveedor"
                            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                            value={formAlta.proveedor_texto}
                            onChange={(e) => setFormAlta((f) => ({ ...f, proveedor_texto: e.target.value }))}
                          />
                          <input
                            type="number"
                            min={0}
                            placeholder="Stock inicial (opcional)"
                            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                            value={formAlta.stock_inicial}
                            onChange={(e) =>
                              setFormAlta((f) => ({ ...f, stock_inicial: parseInt(e.target.value) || 0 }))
                            }
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCrearProducto(grupo.id)}
                            className="px-3 py-1.5 bg-black text-white rounded text-sm"
                          >
                            Añadir
                          </button>
                          <button
                            onClick={() => {
                              setAnadiendoAGrupoId(null)
                              setFormAlta(FORM_VACIO)
                            }}
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAnadiendoAGrupoId(grupo.id)
                          setFormAlta(FORM_VACIO)
                        }}
                        className="text-sm text-blue-600 font-medium"
                      >
                        + Añadir material
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

      {editMode && puedeCrear && tabActivo && (
        <div>
          {anadiendoGrupoACatId === tabActivo ? (
            <div className="bg-white rounded-lg shadow p-4 flex items-center gap-2">
              <input
                placeholder="Nombre del grupo"
                className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1 max-w-xs"
                value={nombreGrupoNuevo}
                onChange={(e) => setNombreGrupoNuevo(e.target.value)}
                autoFocus
              />
              <button
                onClick={() => handleCrearGrupo(tabActivo)}
                className="px-3 py-1.5 bg-black text-white rounded text-sm"
              >
                Crear grupo
              </button>
              <button
                onClick={() => {
                  setAnadiendoGrupoACatId(null)
                  setNombreGrupoNuevo('')
                }}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setAnadiendoGrupoACatId(tabActivo)
                setNombreGrupoNuevo('')
              }}
              className="text-sm text-blue-600 font-medium"
            >
              + Añadir grupo
            </button>
          )}
        </div>
      )}

      {/* Modal de ajuste */}
      {ajustandoProducto && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-lg">Ajustar «{ajustandoProducto.nombre}»</h3>
            <p className="text-sm text-gray-500">
              Stock actual: {ajustandoProducto.stock_actual} {ajustandoProducto.unidad}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setAjusteSigno('positivo')}
                className={`flex-1 py-2 rounded border text-sm ${
                  ajusteSigno === 'positivo' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300'
                }`}
              >
                + Añadir
              </button>
              <button
                onClick={() => setAjusteSigno('negativo')}
                className={`flex-1 py-2 rounded border text-sm ${
                  ajusteSigno === 'negativo' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300'
                }`}
              >
                − Quitar
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
              <input
                type="number"
                min={1}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                value={ajusteCantidad}
                onChange={(e) => setAjusteCantidad(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Motivo (obligatorio)</label>
              <input
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                placeholder="Ej. recuento físico, rotura..."
                value={ajusteMotivo}
                onChange={(e) => setAjusteMotivo(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setAjustandoProducto(null)}
                className="px-4 py-2 border border-gray-300 rounded text-sm"
              >
                Cancelar
              </button>
              <button onClick={handleGuardarAjuste} className="px-4 py-2 bg-black text-white rounded text-sm">
                Guardar ajuste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel "Necesito pedir" */}
      {pedidoAbierto && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setPedidoAbierto(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-lg">📋 Lista de pedido</h3>
              <button onClick={() => setPedidoAbierto(false)} className="text-gray-400 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-6">
              {listaCompra.urgentes.length === 0 && listaCompra.pronto.length === 0 ? (
                <p className="text-center text-gray-500 py-8">✅ Todo el stock está al día. No hay nada que pedir.</p>
              ) : (
                <>
                  {listaCompra.urgentes.length > 0 && (
                    <div>
                      <h4 className="text-red-600 font-semibold text-sm mb-2">
                        🔴 Pedir YA — {listaCompra.urgentes.reduce((n, [, items]) => n + items.length, 0)} producto(s)
                      </h4>
                      {listaCompra.urgentes.map(([prov, items]) => (
                        <div key={prov} className="mb-3">
                          <div className="text-xs font-medium text-gray-500 mb-1">→ {prov}</div>
                          {items.map((p) => (
                            <div key={p.id} className="flex justify-between text-sm py-1">
                              <span>{p.nombre}</span>
                              <span className="text-gray-500">
                                Quedan {p.stock_actual} {p.unidad} · mín {p.stock_minimo}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  {listaCompra.pronto.length > 0 && (
                    <div>
                      <h4 className="text-yellow-600 font-semibold text-sm mb-2">
                        🟡 Reponer pronto — {listaCompra.pronto.reduce((n, [, items]) => n + items.length, 0)} producto(s)
                      </h4>
                      {listaCompra.pronto.map(([prov, items]) => (
                        <div key={prov} className="mb-3">
                          <div className="text-xs font-medium text-gray-500 mb-1">→ {prov}</div>
                          {items.map((p) => (
                            <div key={p.id} className="flex justify-between text-sm py-1">
                              <span>{p.nombre}</span>
                              <span className="text-gray-500">
                                Quedan {p.stock_actual} {p.unidad} · mín {p.stock_minimo}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={copiarListaCompra}
                    className="w-full py-2.5 bg-black text-white rounded-md text-sm font-medium"
                  >
                    📋 Copiar lista de pedido
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

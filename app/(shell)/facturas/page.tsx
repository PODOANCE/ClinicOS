'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Factura {
  id: string
  numero_factura: string
  fecha_emision: string
  importe_base: number
  importe_iva: number
  importe_total: number
  estado_lectura: string
  estado_conciliacion: string
  estado_gestor: string
  proveedor_id: string | null
  proveedores: { id: string; nombre: string; cif_nif: string } | null
  created_at: string
  updated_at: string
}

const estadoColores: Record<string, string> = {
  PENDIENTE: 'bg-gray-100 text-gray-800',
  LECTURA_PENDIENTE: 'bg-blue-100 text-blue-800',
  LECTURA_EXITOSA: 'bg-cyan-100 text-cyan-800',
  VALIDACION_EXITOSA: 'bg-green-100 text-green-800',
  ERROR_LECTURA: 'bg-red-100 text-red-800',
  REVISION_MANUAL: 'bg-yellow-100 text-yellow-800',
}

export default function FacturasPage() {
  const router = useRouter()
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [total, setTotal] = useState(0)

  useEffect(() => {
    cargarFacturas()
  }, [filtroEstado])

  async function cargarFacturas() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filtroEstado) params.append('estado', filtroEstado)

      const res = await fetch(`/api/facturas/listar?${params}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error cargando facturas')
      }

      setFacturas(data.facturas)
      setTotal(data.total)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Facturas Recibidas</h1>
        <p className="text-gray-600 mt-2">Total: {total} facturas</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filtrar por estado:
        </label>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todos</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="LECTURA_PENDIENTE">Lectura Pendiente</option>
          <option value="LECTURA_EXITOSA">Lectura Exitosa</option>
          <option value="VALIDACION_EXITOSA">Validación Exitosa</option>
          <option value="ERROR_LECTURA">Error Lectura</option>
          <option value="REVISION_MANUAL">Revisión Manual</option>
        </select>
      </div>

      {/* Tabla de facturas */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando facturas...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : facturas.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No hay facturas</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Número
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Proveedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {facturas.map((factura) => (
                  <tr
                    key={factura.id}
                    onClick={() => router.push(`/facturas/${factura.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {factura.numero_factura}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {factura.proveedores?.nombre || 'Sin asignar'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {factura.fecha_emision ? new Date(factura.fecha_emision).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {factura.importe_total?.toFixed(2) || '0.00'} €
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          estadoColores[factura.estado_lectura] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {factura.estado_lectura.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

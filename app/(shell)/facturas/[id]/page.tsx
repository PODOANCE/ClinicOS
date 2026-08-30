'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Factura {
  id: string
  numero_factura: string
  fecha_emision: string
  fecha_vencimiento: string | null
  importe_base: number
  importe_iva: number
  importe_total: number
  estado_lectura: string
  estado_conciliacion: string
  estado_gestor: string
  proveedor_id: string | null
  drive_file_id: string
  hash_pdf: string
  proveedores: { id: string; nombre: string; cif_nif: string } | null
  created_at: string
  updated_at: string
}

interface Extraccion {
  respuesta_json: Record<string, unknown>
  datos_validados: Record<string, unknown> | null
  errores_validacion: string[] | null
  created_at: string
  updated_at: string
}

interface FacturaDetail {
  factura: Factura
  extraccion: Extraccion | null
}

const estadoColores: Record<string, string> = {
  PENDIENTE: 'bg-gray-100 text-gray-800',
  LECTURA_PENDIENTE: 'bg-blue-100 text-blue-800',
  LECTURA_EXITOSA: 'bg-cyan-100 text-cyan-800',
  VALIDACION_EXITOSA: 'bg-green-100 text-green-800',
  ERROR_LECTURA: 'bg-red-100 text-red-800',
  REVISION_MANUAL: 'bg-yellow-100 text-yellow-800',
}

const getStringValue = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return null
}

export default function FacturaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [data, setData] = useState<FacturaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandAuditoria, setExpandAuditoria] = useState(false)
  const [facturaId, setFacturaId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const initializeParams = async () => {
      const { id } = await params
      if (isMounted) {
        setFacturaId(id)
        cargarDetalle(id)
      }
    }

    initializeParams()

    return () => {
      isMounted = false
    }
  }, [params])

  async function cargarDetalle(id: string) {
    try {
      setLoading(true)
      const res = await fetch(`/api/facturas/${id}`)

      if (!res.ok) {
        if (res.status === 404) {
          setError('Factura no encontrada')
        } else {
          setError('Error cargando factura')
        }
        return
      }

      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="text-center text-gray-500">Cargando factura...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6 p-6">
        <button
          onClick={() => router.push('/facturas')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Volver a Facturas
        </button>
        <div className="p-8 text-center text-red-500">{error || 'Error desconocido'}</div>
      </div>
    )
  }

  const { factura, extraccion } = data

  const driveUrl = factura.drive_file_id
    ? `https://drive.google.com/file/d/${factura.drive_file_id}/view`
    : null

  const formatearFecha = (fecha: string) => {
    if (!fecha) return '—'
    return new Date(fecha).toLocaleDateString('es-ES')
  }

  const formatearImporte = (importe: number | null) => {
    if (importe === null || importe === undefined) return '—'
    return `${importe.toFixed(2)} €`
  }

  return (
    <div className="space-y-6 p-6">
      {/* Cabecera */}
      <div>
        <button
          onClick={() => router.push('/facturas')}
          className="text-blue-600 hover:text-blue-800 mb-4 font-medium"
        >
          ← Volver a Facturas
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{factura.numero_factura}</h1>
            <p className="text-gray-600 mt-1">
              {factura.proveedores?.nombre || 'Sin proveedor asignado'}
            </p>
          </div>
          <span
            className={`px-4 py-2 inline-flex text-sm leading-5 font-semibold rounded-full ${
              estadoColores[factura.estado_lectura] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {factura.estado_lectura.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Contenedor principal: 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: Datos de factura (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sección: Datos de Factura */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Información de Factura</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Nº Factura</p>
                <p className="text-gray-900 font-medium">{factura.numero_factura}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Fecha Emisión</p>
                <p className="text-gray-900">{formatearFecha(factura.fecha_emision)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Fecha Vencimiento</p>
                <p className="text-gray-900">
                  {factura.fecha_vencimiento ? formatearFecha(factura.fecha_vencimiento) : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Proveedor</p>
                <p className="text-gray-900">
                  {factura.proveedores?.nombre || 'Sin asignar'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">CIF/NIF</p>
                <p className="text-gray-900 font-mono text-sm">
                  {factura.proveedores?.cif_nif || '—'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Concepto</p>
                <p className="text-gray-900">
                  {getStringValue(extraccion?.datos_validados?.concepto) ||
                    getStringValue(extraccion?.respuesta_json?.concepto) ||
                    '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Sección: Importes */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Importes</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Base Imponible</span>
                <span className="font-medium">{formatearImporte(factura.importe_base)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">
                  IVA{' '}
                  {getStringValue(extraccion?.datos_validados?.tipo_iva) ||
                  getStringValue(extraccion?.respuesta_json?.tipo_iva)
                    ? `(${getStringValue(extraccion?.datos_validados?.tipo_iva) || getStringValue(extraccion?.respuesta_json?.tipo_iva)}%)`
                    : ''}
                </span>
                <span className="font-medium">{formatearImporte(factura.importe_iva)}</span>
              </div>
              <div className="flex justify-between items-center py-3 text-lg font-bold">
                <span>Total</span>
                <span className="text-green-600">{formatearImporte(factura.importe_total)}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Moneda</span>
                <span className="font-medium">
                  {getStringValue(extraccion?.datos_validados?.moneda) ||
                  getStringValue(extraccion?.respuesta_json?.moneda) ||
                  'EUR'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">IBAN</span>
                <span className="font-mono text-sm">
                  {getStringValue(extraccion?.datos_validados?.iban) ||
                  getStringValue(extraccion?.respuesta_json?.iban) ||
                  '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Sección: Extracción IA */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Extracción IA</h2>

            {!extraccion ? (
              <p className="text-gray-500 italic">Factura no procesada aún</p>
            ) : (
              <div className="space-y-4">
                {/* Resultado de extracción */}
                {extraccion.datos_validados ? (
                  <div className="bg-green-50 border border-green-200 rounded p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-5 w-5 rounded-full bg-green-100">
                          <svg
                            className="h-3 w-3 text-green-600"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-green-800">
                          Datos validados correctamente
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          Extracción: {new Date(extraccion.updated_at).toLocaleString('es-ES')}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : extraccion.errores_validacion && extraccion.errores_validacion.length > 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-5 w-5 rounded-full bg-yellow-100">
                          <svg
                            className="h-3 w-3 text-yellow-600"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-yellow-800">
                          Requiere revisión manual
                        </p>
                        <ul className="mt-2 list-disc list-inside space-y-1">
                          {extraccion.errores_validacion.map((error, idx) => (
                            <li key={idx} className="text-xs text-yellow-700">
                              {error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 italic text-sm">
                    Extracción procesada pero sin datos de validación
                  </div>
                )}

                {/* Sección de Auditoría IA (desplegable) */}
                <div className="border-t pt-4">
                  <button
                    onClick={() => setExpandAuditoria(!expandAuditoria)}
                    className="text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-2"
                  >
                    <svg
                      className={`h-4 w-4 transform transition-transform ${
                        expandAuditoria ? 'rotate-90' : ''
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Auditoría IA
                  </button>

                  {expandAuditoria && (
                    <div className="mt-3 bg-gray-50 border rounded p-3">
                      <p className="text-xs font-medium text-gray-600 mb-2">
                        Respuesta JSON bruta:
                      </p>
                      <pre className="text-xs overflow-auto max-h-64 bg-gray-100 p-2 rounded text-gray-700">
                        {JSON.stringify(extraccion.respuesta_json, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: Secciones compactas (1/3) */}
        <div className="space-y-6">
          {/* Sección: Estados */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Estados</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-600 uppercase">Lectura</p>
                <span
                  className={`inline-block mt-1 px-3 py-1 text-xs font-semibold rounded-full ${
                    estadoColores[factura.estado_lectura] || 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {factura.estado_lectura.replace(/_/g, ' ')}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 uppercase">Conciliación</p>
                <p className="text-sm text-gray-900 mt-1">
                  {factura.estado_conciliacion || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 uppercase">Gestoría</p>
                <p className="text-sm text-gray-900 mt-1">
                  {factura.estado_gestor || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Sección: Documento PDF */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Documento</h2>
            {driveUrl ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4 4a2 2 0 012-2h6a1 1 0 01.894.553l2 4H4V4z" />
                    <path d="M18 12a2 2 0 01-2 2H4v-6h12a2 2 0 012 2v4z" />
                  </svg>
                  <span className="text-sm text-gray-700 truncate">PDF desde Drive</span>
                </div>
                <a
                  href={driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-block text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition"
                >
                  Abrir en Drive
                </a>
                <p className="text-xs text-gray-500 text-center">
                  Hash: <span className="font-mono text-xs">{factura.hash_pdf.substring(0, 16)}...</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Sin documento PDF</p>
            )}
          </div>

          {/* Sección: Metadatos */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Metadatos</h2>
            <div className="space-y-2 text-xs">
              <div>
                <p className="font-medium text-gray-600">Creada:</p>
                <p className="text-gray-700">{new Date(factura.created_at).toLocaleString('es-ES')}</p>
              </div>
              <div>
                <p className="font-medium text-gray-600">Actualizada:</p>
                <p className="text-gray-700">{new Date(factura.updated_at).toLocaleString('es-ES')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

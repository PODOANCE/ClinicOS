'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/lib/contexts/UserContext'
import { getPresupuesto } from '@/lib/supabase/queries/presupuestos'
import { calcularFinanciacion } from '@/lib/services/financiacion'
import type { Presupuesto } from '@/lib/types/models'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

function eur(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fechaLarga(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// Líneas siempre incluidas en el precio de una cirugía (igual que en el
// presupuesto de Organízate): se muestran a 0€ para detallar qué incluye.
const LINEAS_INCLUIDAS = [
  'Coste de las curas postoperatorias hasta el alta definitiva',
  'Gastos material estéril, desechable y fungible',
  'Gastos medicación intraoperatoria',
  'Honorarios profesionales',
]

export default function VerPresupuestoPage() {
  const params = useParams<{ id: string }>()
  const { user, loading: userLoading } = useUser()

  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function cargar() {
    try {
      setLoading(true)
      setPresupuesto(await getPresupuesto(params.id))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando el presupuesto')
    } finally {
      setLoading(false)
    }
  }

  if (userLoading || loading) {
    return <div className="p-6 text-gray-500">Cargando...</div>
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }
  if (!presupuesto) {
    return <div className="p-6 text-gray-500">No se ha encontrado ese presupuesto.</div>
  }

  const financiacion = calcularFinanciacion(presupuesto.precio)

  return (
    <div className="p-6 space-y-4">
      <div className="no-imprimir flex items-center gap-3">
        <Link href="/presupuestos" className="text-xs font-medium underline decoration-dotted" style={{ color: PUMPKIN }}>
          ← Volver a Presupuestos
        </Link>
        <button
          onClick={() => window.print()}
          className="ml-auto px-4 py-1.5 rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: DENIM }}
        >
          🖨️ Imprimir / Guardar PDF
        </button>
      </div>

      <div className="imprimir-documento bg-white rounded-xl border border-gray-200 shadow-sm p-10 max-w-3xl mx-auto">
        <div className="flex items-start justify-between pb-6 border-b-4" style={{ borderColor: PUMPKIN }}>
          <div>
            <div className="text-2xl font-bold" style={{ color: DENIM }}>Podología &amp; Biomecánica Rivas</div>
            <div className="text-xs text-gray-500 mt-1">
              PODOANCE SL · B05360292<br />
              C/ Gonzalo Torrente Ballester 1, Local 8-2 · 28521 Rivas-Vaciamadrid, Madrid
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Presupuesto nº</div>
            <div className="text-lg font-bold" style={{ color: DENIM }}>{presupuesto.numero}</div>
            <div className="text-xs text-gray-500 mt-1">{fechaLarga(presupuesto.fecha)}</div>
          </div>
        </div>

        <div className="mt-6 text-sm">
          <div className="font-semibold text-gray-900">{presupuesto.paciente_nombre}</div>
          {presupuesto.paciente_dni && <div className="text-gray-600">{presupuesto.paciente_dni}</div>}
          {presupuesto.paciente_direccion && <div className="text-gray-600">{presupuesto.paciente_direccion}</div>}
        </div>

        <table className="w-full text-sm mt-8">
          <thead>
            <tr className="text-left border-b-2" style={{ borderColor: DENIM }}>
              <th className="py-2 font-semibold" style={{ color: DENIM }}>Concepto</th>
              <th className="py-2 font-semibold text-right" style={{ color: DENIM }}>Importe</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-3 font-medium text-gray-900">{presupuesto.concepto}</td>
              <td className="py-3 text-right font-medium text-gray-900">{eur(presupuesto.precio)}</td>
            </tr>
            {LINEAS_INCLUIDAS.map((linea) => (
              <tr key={linea} className="border-b border-gray-50">
                <td className="py-2 text-gray-500">{linea} <span className="text-xs">(incluido)</span></td>
                <td className="py-2 text-right text-gray-500">0,00 €</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="text-right">
            <div className="text-xs text-gray-500">Exento de IVA (Art. 20.Uno Ley 37/1992)</div>
            <div className="text-2xl font-bold" style={{ color: PUMPKIN }}>{eur(presupuesto.precio)}</div>
          </div>
        </div>

        {financiacion.length > 0 && (
          <div className="mt-10 rounded-lg p-4" style={{ backgroundColor: '#f4f7fb' }}>
            <div className="font-semibold text-sm mb-2" style={{ color: DENIM }}>
              💳 Opciones de pago a plazos con tarjeta
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1 font-medium">Plazo</th>
                  <th className="py-1 font-medium text-right">Cuota mensual</th>
                  <th className="py-1 font-medium text-right">Total a pagar</th>
                </tr>
              </thead>
              <tbody>
                {financiacion.map((f) => (
                  <tr key={f.meses} className="border-t border-white">
                    <td className="py-1.5 text-gray-700">{f.meses} meses</td>
                    <td className="py-1.5 text-right text-gray-700">{eur(f.cuota)}/mes</td>
                    <td className="py-1.5 text-right text-gray-700">{eur(f.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-gray-400 mt-2">
              Importes orientativos de financiación a plazos con tarjeta; condiciones finales sujetas a confirmación en el momento del pago.
            </p>
          </div>
        )}

        <p className="text-[10px] text-gray-400 mt-10 leading-relaxed">
          Factura exenta de I.V.A. (Artículo 20. Uno. Ley 37/1992). PODOANCE, S.L. es el Responsable del tratamiento de los datos
          personales proporcionados bajo su consentimiento y le informa de que estos datos serán tratados de conformidad con lo
          dispuesto en el Reglamento (UE) 2016/679, de 27 de abril (GDPR), y la Ley Orgánica 3/2018, de 5 de diciembre (LOPDGDD), con
          la finalidad de mantener una relación comercial (por interés legítimo del responsable, art. 6.1.f GDPR) y conservarlos durante
          no más tiempo del necesario para mantener el fin del tratamiento o mientras existan prescripciones legales que dictaminen su
          custodia. No se comunicarán los datos a terceros, salvo obligación legal. Asimismo, se le informa de que puede ejercer los
          derechos de acceso, rectificación, portabilidad y supresión de sus datos y los de limitación y oposición a su tratamiento
          dirigiéndose a PODOANCE S.L. en C/ Gonzalo Torrente Ballester 1, LC 8-2, 28521, RIVAS VACIAMADRID - MADRID. Email:
          info@podologiarivas.com y el de reclamación a www.aepd.es.
        </p>
      </div>
    </div>
  )
}

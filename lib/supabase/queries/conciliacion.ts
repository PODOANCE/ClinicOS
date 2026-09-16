import { createClient } from '@/lib/supabase/browser'

/**
 * Lectura y resolución de propuestas de conciliación, directa contra
 * Supabase, protegida por las RLS de conciliaciones/facturas/movimientos_bancarios
 * (rol Administración o Administrador del sistema). El alta de propuestas no
 * vive aquí: la hace el motor en /api/conciliacion/ejecutar, con
 * createAdminClient, porque conciliaciones no tiene policy de INSERT para
 * el cliente.
 */

export interface PropuestaConciliacion {
  id: string
  confianza: number
  diferencia: number
  metodo: string
  notas_revision: string | null
  factura: {
    id: string
    numero_factura: string
    importe_total: number
    fecha_emision: string
    proveedor_nombre: string | null
  }
  movimiento: {
    id: string
    fecha: string
    concepto: string
    importe: number
  }
}

export async function getPropuestasPendientes(): Promise<PropuestaConciliacion[]> {
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('conciliaciones')
    .select(
      `id, confianza, diferencia, metodo, notas_revision,
       facturas ( id, numero_factura, importe_total, fecha_emision, proveedores ( nombre ) ),
       movimientos_bancarios ( id, fecha, concepto, importe )`
    )
    .eq('estado', 'PROPUESTA')
    .order('confianza', { ascending: false })

  if (error) {
    console.error('[getPropuestasPendientes] Error:', error.message)
    throw error
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    confianza: row.confianza,
    diferencia: row.diferencia,
    metodo: row.metodo,
    notas_revision: row.notas_revision,
    factura: {
      id: row.facturas?.id,
      numero_factura: row.facturas?.numero_factura,
      importe_total: row.facturas?.importe_total,
      fecha_emision: row.facturas?.fecha_emision,
      proveedor_nombre: row.facturas?.proveedores?.nombre ?? null,
    },
    movimiento: {
      id: row.movimientos_bancarios?.id,
      fecha: row.movimientos_bancarios?.fecha,
      concepto: row.movimientos_bancarios?.concepto,
      importe: row.movimientos_bancarios?.importe,
    },
  }))
}

async function obtenerPar(id: string) {
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('conciliaciones')
    .select('id, factura_id, movimiento_bancario_id')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as { id: string; factura_id: string; movimiento_bancario_id: string }
}

export async function aceptarPropuesta(id: string, actorId: string): Promise<void> {
  const supabase = createClient() as any
  const par = await obtenerPar(id)

  const { error: errConciliacion } = await supabase
    .from('conciliaciones')
    .update({ estado: 'ACEPTADA', metodo: 'REVISADA', revisado_por: actorId, revisado_en: new Date().toISOString() })
    .eq('id', id)
  if (errConciliacion) throw errConciliacion

  const { error: errFactura } = await supabase
    .from('facturas')
    .update({ estado_conciliacion: 'CONCILIADA_AUTOMATICA' })
    .eq('id', par.factura_id)
  if (errFactura) throw errFactura

  const { error: errMovimiento } = await supabase
    .from('movimientos_bancarios')
    .update({ estado: 'CONCILIADO' })
    .eq('id', par.movimiento_bancario_id)
  if (errMovimiento) throw errMovimiento
}

export async function rechazarPropuesta(id: string, actorId: string): Promise<void> {
  const supabase = createClient() as any
  const par = await obtenerPar(id)

  const { error: errConciliacion } = await supabase
    .from('conciliaciones')
    .update({ estado: 'RECHAZADA', revisado_por: actorId, revisado_en: new Date().toISOString() })
    .eq('id', id)
  if (errConciliacion) throw errConciliacion

  const { error: errFactura } = await supabase
    .from('facturas')
    .update({ estado_conciliacion: 'NO_CONCILIADA' })
    .eq('id', par.factura_id)
  if (errFactura) throw errFactura
}

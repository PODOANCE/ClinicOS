import { createClient, handleJWTError, isJWTClockSkewError } from '@/lib/supabase/browser'
import type { StockCategoria, StockProducto, Rol } from '@/lib/types/models'

/**
 * Lectura/escritura de catálogo (categorías y productos) directa contra
 * Supabase, protegida por RLS. Mismo patrón que lib/supabase/queries/tasks.ts.
 *
 * Los cambios de stock_actual NO se hacen aquí: van siempre por
 * /api/stock/movimiento, que es el único punto que puede invocar la RPC
 * registrar_movimiento_stock(). stock_actual está además protegido por un
 * trigger de base de datos que rechaza cualquier UPDATE directo.
 */

async function withJWTRetry<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  operationName: string
): Promise<T> {
  const { data, error } = await operation()

  if (error) {
    if (isJWTClockSkewError(error.message)) {
      try {
        await handleJWTError()
        const { data: retryData, error: retryError } = await operation()
        if (retryError) throw retryError
        return retryData as T
      } catch {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.')
      }
    }
    console.error(`[${operationName}] Error:`, error.message)
    throw error
  }

  return (data as T) || (null as unknown as T)
}

/**
 * Roles del usuario leídos desde el cliente (RLS: usuarios_ver_propios_roles
 * + roles_lectura_publica). Se combinan con canUserAccess() de
 * lib/permissions/validation.ts para decidir qué acciones mostrar.
 */
export async function getRolesUsuarioActual(userId: string): Promise<Rol[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('usuarios_roles')
    .select('roles(id, nombre, areas_permitidas, created_at, updated_at)')
    .eq('usuario_id', userId)

  if (error) {
    console.error('[getRolesUsuarioActual] Error:', error.message)
    return []
  }

  return ((data as any[]) || []).map((ur) => ur.roles).filter(Boolean) as Rol[]
}

export async function getStockCategorias(): Promise<StockCategoria[]> {
  const supabase = createClient()
  return withJWTRetry(
    () =>
      supabase
        .from('stock_categorias')
        .select('*')
        .is('archived_at', null)
        .order('nivel', { ascending: true })
        .order('orden', { ascending: true }) as any,
    'getStockCategorias'
  )
}

export async function getStockProductos(): Promise<StockProducto[]> {
  const supabase = createClient()
  return withJWTRetry(
    () =>
      supabase
        .from('stock_productos')
        .select('*')
        .is('archived_at', null)
        .order('nombre', { ascending: true }) as any,
    'getStockProductos'
  )
}

export async function crearStockCategoria(input: {
  nombre: string
  nivel: 1 | 2
  padre_id: string | null
  orden: number
  centro_id: string
}): Promise<StockCategoria> {
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('stock_categorias')
    .insert(input)
    .select()
    .single()

  if (error) {
    console.error('[crearStockCategoria] Error:', error.message)
    throw error
  }
  return data as StockCategoria
}

export async function crearStockProducto(input: {
  nombre: string
  unidad: string
  categoria_id: string
  stock_minimo: number
  stock_critico: number
  proveedor_texto: string | null
  proveedor_id: string | null
  centro_id: string
}): Promise<StockProducto> {
  const supabase = createClient() as any
  // stock_actual se omite deliberadamente: nace en 0 (default de columna).
  // El trigger de integridad rechaza cualquier INSERT con stock_actual != 0.
  const { data, error } = await supabase
    .from('stock_productos')
    .insert(input)
    .select()
    .single()

  if (error) {
    console.error('[crearStockProducto] Error:', error.message)
    throw error
  }
  return data as StockProducto
}

export async function actualizarStockProducto(
  id: string,
  input: Partial<{
    nombre: string
    unidad: string
    stock_minimo: number
    stock_critico: number
    proveedor_texto: string | null
    proveedor_id: string | null
    categoria_id: string
  }>
): Promise<StockProducto> {
  const supabase = createClient() as any
  const { data, error } = await supabase
    .from('stock_productos')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[actualizarStockProducto] Error:', error.message)
    throw error
  }
  return data as StockProducto
}

export async function archivarStockProducto(id: string): Promise<void> {
  const supabase = createClient() as any
  const { error } = await supabase
    .from('stock_productos')
    .update({ activo: false, archived_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[archivarStockProducto] Error:', error.message)
    throw error
  }
}

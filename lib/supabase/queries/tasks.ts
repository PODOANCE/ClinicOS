import { createClient, handleJWTError, isJWTClockSkewError } from '@/lib/supabase/browser'
import type { Tarea } from '@/lib/types/models'

const SISTEMA_UUID = '00000000-0000-0000-0000-000000000000'

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
      } catch (err) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.')
      }
    }
    throw error
  }

  return (data as T) || (null as unknown as T)
}

export async function getTasks(userId: string): Promise<Tarea[]> {
  const supabase = createClient()

  return withJWTRetry(
    () =>
      supabase
        .from('tareas')
        .select(`
          *,
          usuario_responsable:usuario_id(id, nombre)
        `)
        .eq('estado', 'abierta')
        .is('archived_at', null)
        .order('fecha_limite', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false }) as any,
    'getTasks'
  )
}

export async function getCompletedTasks(userId: string): Promise<Tarea[]> {
  const supabase = createClient()

  return withJWTRetry(
    () =>
      supabase
        .from('tareas')
        .select(`
          *,
          usuario_responsable:usuario_id(id, nombre)
        `)
        .eq('estado', 'hecha')
        .is('archived_at', null)
        .order('updated_at', { ascending: false }) as any,
    'getCompletedTasks'
  )
}

interface Usuario {
  id: string
  nombre: string
  email: string
}

export async function getUsuariosDisponibles(): Promise<Usuario[]> {
  const supabase = createClient()

  return withJWTRetry(
    () =>
      supabase
        .from('usuarios')
        .select('id, nombre, email')
        .eq('activo', true)
        .order('nombre', { ascending: true }) as any,
    'getUsuariosDisponibles'
  )
}

export async function createTask(input: {
  usuario_id: string
  titulo: string
  descripcion?: string
  fecha_limite?: string
  centro_id: string
}): Promise<Tarea> {
  const supabase = createClient()

  const taskData = {
    usuario_id: input.usuario_id,
    titulo: input.titulo,
    descripcion: input.descripcion || null,
    fecha_limite: input.fecha_limite || null,
    estado: 'abierta',
    origen: 'manual',
    centro_id: input.centro_id,
    created_by: SISTEMA_UUID,
    tipo_objeto: null,
    objeto_id: null,
  }

  const { data: newTask, error } = await supabase
    .from('tareas')
    .insert(taskData as any)
    .select()
    .single() as any

  if (error) {
    console.error('Error creating task:', error.message)
    if (error.message?.includes('JWT') || error.message?.includes('issued at future')) {
      await handleJWTError()
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.')
    }
    throw error
  }

  return newTask as Tarea
}

export async function completeTask(taskId: string): Promise<void> {
  const supabase = createClient() as any

  const { error } = await supabase
    .from('tareas')
    .update({ estado: 'hecha' })
    .eq('id', taskId)

  if (error) {
    console.error('Error completing task:', error.message)
    if (error.message?.includes('JWT') || error.message?.includes('issued at future')) {
      await handleJWTError()
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.')
    }
    throw error
  }
}

export async function reopenTask(taskId: string): Promise<void> {
  const supabase = createClient() as any

  const { error } = await supabase
    .from('tareas')
    .update({ estado: 'abierta' })
    .eq('id', taskId)

  if (error) {
    console.error('Error reopening task:', error.message)
    if (error.message?.includes('JWT') || error.message?.includes('issued at future')) {
      await handleJWTError()
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.')
    }
    throw error
  }
}

export async function updateTask(taskId: string, input: {
  titulo?: string
  descripcion?: string | null
  fecha_limite?: string | null
  usuario_id?: string
}): Promise<Tarea> {
  const supabase = createClient() as any

  const updateData: Record<string, any> = {}
  if (input.titulo !== undefined) updateData.titulo = input.titulo
  if (input.descripcion !== undefined) updateData.descripcion = input.descripcion
  if (input.fecha_limite !== undefined) updateData.fecha_limite = input.fecha_limite
  if (input.usuario_id !== undefined) updateData.usuario_id = input.usuario_id

  const { data: updatedTask, error } = await supabase
    .from('tareas')
    .update(updateData)
    .eq('id', taskId)
    .select(`
      *,
      usuario_responsable:usuario_id(id, nombre)
    `)
    .single() as any

  if (error) {
    console.error('Error updating task:', error.message)
    if (error.message?.includes('JWT') || error.message?.includes('issued at future')) {
      await handleJWTError()
      throw new Error('Sesión expirada. Por favor, ininta sesión nuevamente.')
    }
    throw error
  }

  return updatedTask as Tarea
}

export async function deleteTask(taskId: string): Promise<void> {
  const supabase = createClient() as any

  const { error } = await supabase
    .from('tareas')
    .delete()
    .eq('id', taskId)

  if (error) {
    console.error('Error deleting task:', error.message)
    if (error.message?.includes('JWT') || error.message?.includes('issued at future')) {
      await handleJWTError()
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.')
    }
    throw error
  }
}

export async function getUserCentro(userId: string): Promise<string> {
  const supabase = createClient()

  const data = await withJWTRetry<{ centro_id: string }>(
    () =>
      supabase
        .from('usuarios')
        .select('centro_id')
        .eq('id', userId)
        .single() as any,
    'getUserCentro'
  )

  return data.centro_id
}

export async function isSupervisor(userId: string): Promise<boolean> {
  const supabase = createClient()

  const { data, error } = await supabase
    .rpc('es_supervisor_hoy') as any

  if (error) {
    console.error('Error checking supervisor status:', error.message)
    return false
  }

  return data === true
}

'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@/lib/contexts/UserContext'
import { getTasks, getCompletedTasks, createTask, completeTask, reopenTask, updateTask, deleteTask, getUserCentro, isSupervisor, getUsuariosDisponibles } from '@/lib/supabase/queries/tasks'
import type { Tarea } from '@/lib/types/models'

interface Usuario {
  id: string
  nombre: string
  email: string
}

function formatDateToDDMMYYYY(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatCreatedAtWithTime(isoStr: string): string {
  if (!isoStr) return ''
  const date = new Date(isoStr)
  if (isNaN(date.getTime())) return isoStr
  const fechaFormato = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const horaFormato = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${fechaFormato} · ${horaFormato}`
}

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

function isTareaVencida(fechaLimite?: string | null): boolean {
  if (!fechaLimite) return false
  const limite = new Date(fechaLimite + 'T00:00:00')
  if (isNaN(limite.getTime())) return false
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return limite.getTime() < hoy.getTime()
}

export default function HoyPage() {
  const { user, loading: userLoading } = useUser()
  const [tareasAbiertas, setTareasAbiertas] = useState<Tarea[]>([])
  const [tareasHechas, setTareasHechas] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vistaActiva, setVistaActiva] = useState<'abiertas' | 'hechas'>('abiertas')

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [responsableId, setResponsableId] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)

  const [tareaEditandoId, setTareaEditandoId] = useState<string | null>(null)
  const [tituloEdicion, setTituloEdicion] = useState('')
  const [descripcionEdicion, setDescripcionEdicion] = useState('')
  const [fechaLimiteEdicion, setFechaLimiteEdicion] = useState('')
  const [responsableIdEdicion, setResponsableIdEdicion] = useState('')
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [esSupervisor, setEsSupervisor] = useState(false)

  useEffect(() => {
    if (!userLoading && user) {
      loadTasks()
      loadUsuarios()
      checkSupervisor()
    }
  }, [user, userLoading])

  async function checkSupervisor() {
    if (!user) return
    try {
      const supervisor = await isSupervisor(user.id)
      setEsSupervisor(supervisor)
      if (supervisor) {
        setResponsableId('')
      } else {
        setResponsableId(user.id)
      }
    } catch (err) {
      console.error('Error checking supervisor:', err)
    }
  }

  async function loadUsuarios() {
    try {
      const usuariosData = await getUsuariosDisponibles()
      setUsuarios(usuariosData)
    } catch (err) {
      console.error('Error loading usuarios:', err)
    }
  }

  async function loadTasks() {
    try {
      setLoading(true)
      setError(null)
      const [abiertas, hechas] = await Promise.all([
        getTasks(user!.id),
        getCompletedTasks(user!.id),
      ])
      setTareasAbiertas(abiertas)
      setTareasHechas(hechas)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar tareas')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault()

    if (!titulo.trim()) {
      setError('El título es requerido')
      return
    }

    if (!responsableId) {
      setError('El responsable es requerido')
      return
    }

    if (!user) {
      setError('Usuario no autenticado')
      return
    }

    try {
      setCreatingTask(true)
      setError(null)

      const centroDatos = await getUserCentro(user.id)

      const newTask = await createTask({
        usuario_id: responsableId,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        fecha_limite: fechaLimite || undefined,
        centro_id: centroDatos,
      })

      setTareasAbiertas((prev) => [...prev, newTask].sort((a, b) => {
        if (!a.fecha_limite && !b.fecha_limite) return 0
        if (!a.fecha_limite) return 1
        if (!b.fecha_limite) return -1
        return new Date(a.fecha_limite).getTime() - new Date(b.fecha_limite).getTime()
      }))

      setTitulo('')
      setDescripcion('')
      setFechaLimite('')
      if (esSupervisor) {
        setResponsableId('')
      } else {
        setResponsableId(user.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear tarea')
    } finally {
      setCreatingTask(false)
    }
  }

  async function handleCompleteTask(taskId: string) {
    try {
      setError(null)
      const tarea = tareasAbiertas.find((t) => t.id === taskId)
      await completeTask(taskId)
      setTareasAbiertas((prev) => prev.filter((t) => t.id !== taskId))
      if (tarea) {
        setTareasHechas((prev) => [{ ...tarea, estado: 'hecha' }, ...prev])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al completar tarea')
    }
  }

  async function handleReopenTask(taskId: string) {
    try {
      setError(null)
      const tarea = tareasHechas.find((t) => t.id === taskId)
      await reopenTask(taskId)
      setTareasHechas((prev) => prev.filter((t) => t.id !== taskId))
      if (tarea) {
        setTareasAbiertas((prev) => [...prev, { ...tarea, estado: 'abierta' } as Tarea].sort((a, b) => {
          if (!a.fecha_limite && !b.fecha_limite) return 0
          if (!a.fecha_limite) return 1
          if (!b.fecha_limite) return -1
          return new Date(a.fecha_limite).getTime() - new Date(b.fecha_limite).getTime()
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reabrir tarea')
    }
  }

  function handleEditarTarea(taskId: string) {
    const tarea = tareasAbiertas.find((t) => t.id === taskId)
    if (tarea) {
      setTareaEditandoId(taskId)
      setTituloEdicion(tarea.titulo)
      setDescripcionEdicion(tarea.descripcion || '')
      setFechaLimiteEdicion(tarea.fecha_limite || '')
      setResponsableIdEdicion(tarea.usuario_id || '')
    }
  }

  function handleCancelarEdicion() {
    setTareaEditandoId(null)
    setTituloEdicion('')
    setDescripcionEdicion('')
    setFechaLimiteEdicion('')
    setResponsableIdEdicion('')
  }

  async function handleGuardarEdicion() {
    if (!tituloEdicion.trim()) {
      setError('El título es requerido')
      return
    }

    try {
      setGuardandoEdicion(true)
      setError(null)

      const updateData: any = {
        titulo: tituloEdicion.trim(),
        descripcion: descripcionEdicion.trim() || null,
        fecha_limite: fechaLimiteEdicion || null,
      }

      if (esSupervisor && responsableIdEdicion) {
        updateData.usuario_id = responsableIdEdicion
      }

      await updateTask(tareaEditandoId!, updateData)

      setTareasAbiertas((prev) =>
        prev
          .map((t) =>
            t.id === tareaEditandoId
              ? {
                  ...t,
                  titulo: tituloEdicion.trim(),
                  descripcion: descripcionEdicion.trim() || null,
                  fecha_limite: fechaLimiteEdicion || null,
                  usuario_id: esSupervisor ? responsableIdEdicion : t.usuario_id,
                }
              : t
          )
          .sort((a, b) => {
            if (!a.fecha_limite && !b.fecha_limite) return 0
            if (!a.fecha_limite) return 1
            if (!b.fecha_limite) return -1
            return new Date(a.fecha_limite).getTime() - new Date(b.fecha_limite).getTime()
          })
      )

      handleCancelarEdicion()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar tarea')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  async function handleEliminarTarea(taskIdParam?: string) {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta tarea? Esta acción no se puede deshacer.')) {
      return
    }

    const taskIdToDelete = taskIdParam || tareaEditandoId

    if (!taskIdToDelete) {
      setError('No se especificó la tarea a eliminar')
      return
    }

    try {
      setGuardandoEdicion(true)
      setError(null)

      await deleteTask(taskIdToDelete)

      setTareasAbiertas((prev) => prev.filter((t) => t.id !== taskIdToDelete))
      setTareasHechas((prev) => prev.filter((t) => t.id !== taskIdToDelete))

      handleCancelarEdicion()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar tarea')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  if (userLoading) {
    return <div style={{ padding: '2rem' }}>Cargando usuario...</div>
  }

  if (!user) {
    return <div style={{ padding: '2rem' }}>No autenticado</div>
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ color: DENIM, fontWeight: 'bold', fontSize: '1.75rem', margin: 0, marginBottom: '0.25rem' }}>Hoy</h2>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 0, marginBottom: '1.5rem' }}>
        Tus tareas pendientes y completadas
      </p>

      {error && (
        <div
          style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c33',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: DENIM }}>Crear tarea</h3>
        <form onSubmit={handleCreateTask} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Título *
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Qué necesita hacerse"
              disabled={creatingTask}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalles adicionales (opcional)"
              disabled={creatingTask}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                minHeight: '80px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Fecha límite (opcional)
            </label>
            <input
              type="date"
              value={fechaLimite}
              onChange={(e) => setFechaLimite(e.target.value)}
              disabled={creatingTask}
              autoComplete="off"
              placeholder=""
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {esSupervisor && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Responsable *
              </label>
              <select
                value={responsableId}
                onChange={(e) => setResponsableId(e.target.value)}
                disabled={creatingTask}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Seleccionar responsable...</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={creatingTask}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: DENIM,
              color: 'white',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: creatingTask ? 'not-allowed' : 'pointer',
              opacity: creatingTask ? 0.6 : 1,
              alignSelf: 'flex-start',
            }}
          >
            {creatingTask ? 'Creando...' : 'Crear tarea'}
          </button>
        </form>
      </div>

      {tareaEditandoId && (
        <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: DENIM }}>Editar tarea</h3>
          <form onSubmit={(e) => { e.preventDefault(); handleGuardarEdicion() }} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Título *
              </label>
              <input
                type="text"
                value={tituloEdicion}
                onChange={(e) => setTituloEdicion(e.target.value)}
                placeholder="Qué necesita hacerse"
                disabled={guardandoEdicion}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Descripción
              </label>
              <textarea
                value={descripcionEdicion}
                onChange={(e) => setDescripcionEdicion(e.target.value)}
                placeholder="Detalles adicionales (opcional)"
                disabled={guardandoEdicion}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  minHeight: '80px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Fecha límite (opcional)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <input
                  type="date"
                  value={fechaLimiteEdicion}
                  onChange={(e) => setFechaLimiteEdicion(e.target.value)}
                  disabled={guardandoEdicion}
                  autoComplete="off"
                  placeholder=""
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                />
                {fechaLimiteEdicion && (
                  <button
                    type="button"
                    onClick={() => setFechaLimiteEdicion('')}
                    disabled={guardandoEdicion}
                    title="Eliminar fecha límite"
                    style={{
                      padding: '0.75rem 0.5rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '9999px',
                      fontSize: '1rem',
                      cursor: guardandoEdicion ? 'not-allowed' : 'pointer',
                      opacity: guardandoEdicion ? 0.6 : 1,
                      fontWeight: 'bold',
                      minWidth: '40px',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {esSupervisor && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Responsable *
                </label>
                <select
                  value={responsableIdEdicion}
                  onChange={(e) => setResponsableIdEdicion(e.target.value)}
                  disabled={guardandoEdicion}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">Seleccionar responsable...</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={handleCancelarEdicion}
                disabled={guardandoEdicion}
                style={{
                  padding: '0.75rem 1.25rem',
                  backgroundColor: '#fff',
                  color: DENIM,
                  border: '1px solid #cbd5e1',
                  borderRadius: '9999px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: guardandoEdicion ? 'not-allowed' : 'pointer',
                  opacity: guardandoEdicion ? 0.6 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoEdicion}
                style={{
                  padding: '0.75rem 1.25rem',
                  backgroundColor: DENIM,
                  color: 'white',
                  border: 'none',
                  borderRadius: '9999px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: guardandoEdicion ? 'not-allowed' : 'pointer',
                  opacity: guardandoEdicion ? 0.6 : 1,
                }}
              >
                {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                onClick={() => handleEliminarTarea()}
                disabled={guardandoEdicion}
                style={{
                  padding: '0.75rem 1.25rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '9999px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: guardandoEdicion ? 'not-allowed' : 'pointer',
                  opacity: guardandoEdicion ? 0.6 : 1,
                  marginLeft: 'auto',
                }}
              >
                🗑️ Eliminar tarea
              </button>
            </div>
          </form>
        </div>
      )}

      <div>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setVistaActiva('abiertas')}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: vistaActiva === 'abiertas' ? DENIM : '#fff',
              border: vistaActiva === 'abiertas' ? `1px solid ${DENIM}` : '1px solid #e2e8f0',
              borderRadius: '9999px',
              fontSize: '0.95rem',
              fontWeight: vistaActiva === 'abiertas' ? 600 : 500,
              cursor: 'pointer',
              color: vistaActiva === 'abiertas' ? '#fff' : '#4a5a6a',
            }}
          >
            Abiertas ({tareasAbiertas.length})
          </button>
          <button
            onClick={() => setVistaActiva('hechas')}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: vistaActiva === 'hechas' ? DENIM : '#fff',
              border: vistaActiva === 'hechas' ? `1px solid ${DENIM}` : '1px solid #e2e8f0',
              borderRadius: '9999px',
              fontSize: '0.95rem',
              fontWeight: vistaActiva === 'hechas' ? 600 : 500,
              cursor: 'pointer',
              color: vistaActiva === 'hechas' ? '#fff' : '#4a5a6a',
            }}
          >
            Hechas ({tareasHechas.length})
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '1rem', color: '#666' }}>Cargando tareas...</div>
        ) : (
          <>
            {vistaActiva === 'abiertas' && (
              <>
                {tareasAbiertas.length === 0 ? (
                  <div style={{ padding: '1rem', color: '#999' }}>No hay tareas abiertas. ¡Buen trabajo!</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {tareasAbiertas.map((tarea) => (
                      <div
                        key={tarea.id}
                        style={{
                          padding: '1rem 1.25rem',
                          backgroundColor: '#fff',
                          border: '1px solid #e2e8f0',
                          borderLeft: `4px solid ${
                            isTareaVencida(tarea.fecha_limite) ? '#ef4444' : tarea.fecha_limite ? '#f59e0b' : DENIM
                          }`,
                          borderRadius: '12px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '1rem',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '600' }}>
                            {tarea.titulo}
                          </h4>
                          {tarea.descripcion && (
                            <p style={{ margin: 0, marginBottom: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                              {tarea.descripcion}
                            </p>
                          )}
                          {esSupervisor && (
                            <p style={{ margin: 0, marginBottom: '0.25rem', fontSize: '0.75rem', color: '#666' }}>
                              Responsable: {tarea.usuario_id ? (usuarios.find(u => u.id === tarea.usuario_id)?.nombre || 'Sin asignar') : 'Sin asignar'}
                            </p>
                          )}
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#999' }}>
                            Creada: {formatCreatedAtWithTime(tarea.created_at)}
                          </p>
                          {tarea.fecha_limite && (
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#999' }}>
                              Vence: {formatDateToDDMMYYYY(tarea.fecha_limite)}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                          <button
                            onClick={() => handleEditarTarea(tarea.id)}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#2196f3',
                              color: 'white',
                              border: 'none',
                              borderRadius: '9999px',
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleCompleteTask(tarea.id)}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#4caf50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '9999px',
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Hecha
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {vistaActiva === 'hechas' && (
              <>
                {tareasHechas.length === 0 ? (
                  <div style={{ padding: '1rem', color: '#999' }}>No hay tareas completadas.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {tareasHechas.map((tarea) => (
                      <div
                        key={tarea.id}
                        style={{
                          padding: '1rem 1.25rem',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderLeft: '4px solid #10b981',
                          borderRadius: '12px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '1rem',
                          opacity: 0.85,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '600', textDecoration: 'line-through' }}>
                            {tarea.titulo}
                          </h4>
                          {tarea.descripcion && (
                            <p style={{ margin: 0, marginBottom: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                              {tarea.descripcion}
                            </p>
                          )}
                          {esSupervisor && (
                            <p style={{ margin: 0, marginBottom: '0.25rem', fontSize: '0.75rem', color: '#666' }}>
                              Responsable: {tarea.usuario_id ? (usuarios.find(u => u.id === tarea.usuario_id)?.nombre || 'Sin asignar') : 'Sin asignar'}
                            </p>
                          )}
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#999' }}>
                            Creada: {formatCreatedAtWithTime(tarea.created_at)}
                          </p>
                          {tarea.fecha_limite && (
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#999' }}>
                              Vencía: {formatDateToDDMMYYYY(tarea.fecha_limite)}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                          <button
                            onClick={() => handleReopenTask(tarea.id)}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#2196f3',
                              color: 'white',
                              border: 'none',
                              borderRadius: '9999px',
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ↩ Reabrir
                          </button>
                          <button
                            onClick={() => handleEliminarTarea(tarea.id)}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '9999px',
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

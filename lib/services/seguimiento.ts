/**
 * Motor de cálculo de "Seguimiento de revisiones" (Biomecánica).
 *
 * Réplica exacta, en TypeScript, de las fórmulas de la plantilla Excel
 * original ("Control de revisiones de Biomecánica"). Los umbrales y
 * palabras clave son verbatim de esa plantilla (pestaña "Config") — no
 * reinterpretar sin confirmar con el usuario, son reglas de negocio reales
 * ya en uso.
 *
 * Nada de esto usa IA: es la misma lógica determinista de fechas y texto
 * que ya tenían en Excel, solo que aquí vive en un sitio con tipos y
 * pruebas en vez de columnas ocultas.
 */

import type { SeguimientoCita, SeguimientoGestion, SeguimientoGestionEstado } from '@/lib/types/models'

// ── Config (verbatim de la pestaña "Config" del Excel original) ─────────
const PALABRA_REVISION = 'revisión'
const PALABRA_ESTUDIO = 'estudio'
const PALABRA_INFANTIL = 'infantil'
const PALABRA_ADULTO = 'adulto'
const TEXTO_EXCLUIR_REVISION = '1 mes' // control de adaptación: no cuenta como revisión periódica
const MESES_VENCIDA_NINO = 8
const MESES_VENCIDA_ADULTO = 14
const PALABRA_SENAL = 'señal' // cita de "señal" = paga y agenda la entrega de las plantillas

export function enlaceWhatsapp(telefono: string, mensaje: string): string {
  const digitos = telefono.replace(/[^\d]/g, '')
  const conPrefijo = digitos.length === 9 ? `34${digitos}` : digitos
  return `https://wa.me/${conPrefijo}?text=${encodeURIComponent(mensaje)}`
}

// Todas las fechas de Seguimiento vienen en ISO (aaaa-mm-dd) de la base de
// datos; se muestran en DD/MM/AAAA para que no haya lío con el formato.
export function fechaDDMMAAAA(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export const GESTION_LABEL: Record<SeguimientoGestionEstado, string> = {
  PENDIENTE: 'Pendiente',
  LLAMADO_NO_CONTESTA: 'Llamada - no contesta',
  CANCELA_TODO_OK: 'Llamada - cancela la revisión (todo ok)',
  RECHAZA: 'Llamada - rechaza la revisión',
  CITA_AGENDADA: 'Cita agendada',
  VOLVER_A_LLAMAR: 'Volver a llamar',
}

export type SeguimientoEstado = 'Revisión citada' | 'SIN CITA - recontactar'
export type SeguimientoPrioridad = 'Sin revisión previa' | 'VENCIDA' | 'Al día' | '—'
export type SeguimientoTipo = 'Infantil' | 'Adulto' | '—'

export interface PacienteSeguimiento {
  paciente_clave: string
  nombre_mostrar: string
  primer_estudio: string | null
  num_revisiones: number
  ultima_cita: string | null
  meses_desde_ultima: number | null
  cita_futura_auto: boolean
  estado: SeguimientoEstado
  tipo: SeguimientoTipo
  prioridad: SeguimientoPrioridad
  podologo_estudio: string | null
  lleva_plantillas: boolean
  fecha_entrega_plantillas: string | null
  // columnas de gestión manual, tal cual en seguimiento_gestion
  cita_futura_manual: boolean
  cita_futura_fecha: string | null
  gestion_recontacto: SeguimientoGestionEstado
  gestion_actualizada_en: string | null
  proximo_intento: string | null
  notas: string | null
}

function contieneTexto(texto: string, buscado: string): boolean {
  return texto.toLowerCase().includes(buscado.toLowerCase())
}

function esEstudio(tratamiento: string): boolean {
  return contieneTexto(tratamiento, PALABRA_ESTUDIO)
}

function esRevision(tratamiento: string): boolean {
  return contieneTexto(tratamiento, PALABRA_REVISION) && !contieneTexto(tratamiento, TEXTO_EXCLUIR_REVISION)
}

function esInfantil(tratamiento: string): boolean {
  return contieneTexto(tratamiento, PALABRA_INFANTIL)
}

function esAdulto(tratamiento: string): boolean {
  return contieneTexto(tratamiento, PALABRA_ADULTO)
}

// "SEÑAL PLANTILLAS ADULTO" / "SEÑAL PLANTILLAS NIÑX": paga y apalabra la
// entrega de las plantillas. Es la señal más fiable de que el paciente
// lleva tratamiento (no solo estudio) — por eso hay que priorizar su
// seguimiento por encima de quien solo se hizo el estudio.
function esSenalPlantillas(tratamiento: string): boolean {
  return contieneTexto(tratamiento, PALABRA_SENAL) && contieneTexto(tratamiento, 'plantilla')
}

export function mesesEntre(desde: Date, hasta: Date): number {
  let meses = (hasta.getFullYear() - desde.getFullYear()) * 12 + (hasta.getMonth() - desde.getMonth())
  if (hasta.getDate() < desde.getDate()) meses -= 1
  return meses
}

export function aFecha(iso: string): Date {
  return new Date(iso + 'T00:00:00')
}

/**
 * Calcula el listado de pacientes de seguimiento a partir de las citas
 * importadas y la gestión manual guardada. Es una función pura: mismo
 * input, mismo output, sin llamadas a red — así se puede probar sola.
 */
export function calcularSeguimiento(
  citas: SeguimientoCita[],
  gestiones: SeguimientoGestion[],
  hoy: Date = new Date()
): PacienteSeguimiento[] {
  const gestionPorClave = new Map(gestiones.map((g) => [g.paciente_clave, g]))
  const citasPorClave = new Map<string, SeguimientoCita[]>()

  for (const c of citas) {
    if (!c.activo) continue
    const lista = citasPorClave.get(c.paciente_clave) ?? []
    lista.push(c)
    citasPorClave.set(c.paciente_clave, lista)
  }

  const resultado: PacienteSeguimiento[] = []

  for (const [clave, lista] of citasPorClave) {
    const gestion = gestionPorClave.get(clave)
    const nombreMostrar = gestion?.nombre_mostrar ?? lista[0].paciente_raw

    const fechasEstudio = lista.filter((c) => esEstudio(c.tratamiento)).map((c) => aFecha(c.fecha))
    const primerEstudio = fechasEstudio.length > 0 ? new Date(Math.min(...fechasEstudio.map((d) => d.getTime()))) : null

    const revisiones = lista.filter((c) => esRevision(c.tratamiento))
    const numRevisiones = revisiones.length

    const citasPasadas = lista.filter((c) => aFecha(c.fecha) <= hoy)
    const ultimaCita =
      citasPasadas.length > 0
        ? new Date(Math.max(...citasPasadas.map((c) => aFecha(c.fecha).getTime())))
        : null
    const mesesDesdeUltima = ultimaCita ? mesesEntre(ultimaCita, hoy) : null

    const revisionesFuturas = revisiones.filter((c) => aFecha(c.fecha) > hoy)
    const citaFuturaAuto = revisionesFuturas.length > 0

    const estado: SeguimientoEstado =
      citaFuturaAuto || gestion?.cita_futura_manual ? 'Revisión citada' : 'SIN CITA - recontactar'

    const conAgendaEstudio = lista.find((c) => esEstudio(c.tratamiento) && c.agenda)
    const podologoEstudio = conAgendaEstudio?.agenda ?? null

    // La fecha de entrega se toma como la última señal de plantillas que
    // aparezca (puede haber más de una si se reagenda la entrega).
    const senales = lista.filter((c) => esSenalPlantillas(c.tratamiento))
    const llevaPlantillas = senales.length > 0
    const fechaEntregaPlantillas = llevaPlantillas
      ? new Date(Math.max(...senales.map((c) => aFecha(c.fecha).getTime()))).toISOString().slice(0, 10)
      : null

    // El tipo (Infantil/Adulto) se decide por las REVISIONES, no por el
    // estudio — igual que las columnas T/U de la plantilla Excel original:
    // si un paciente tiene revisiones de ambos tipos (raro, pero posible),
    // gana la más reciente.
    const revisionesInfantiles = revisiones.filter((c) => esInfantil(c.tratamiento))
    const revisionesAdultas = revisiones.filter((c) => esAdulto(c.tratamiento))
    const maxFechaInfantil =
      revisionesInfantiles.length > 0 ? Math.max(...revisionesInfantiles.map((c) => aFecha(c.fecha).getTime())) : 0
    const maxFechaAdulta =
      revisionesAdultas.length > 0 ? Math.max(...revisionesAdultas.map((c) => aFecha(c.fecha).getTime())) : 0
    const tipo: SeguimientoTipo =
      maxFechaInfantil === 0 && maxFechaAdulta === 0 ? '—' : maxFechaInfantil >= maxFechaAdulta ? 'Infantil' : 'Adulto'

    let prioridad: SeguimientoPrioridad = '—'
    if (estado === 'SIN CITA - recontactar') {
      const revisionesPasadas = revisiones.filter((c) => aFecha(c.fecha) <= hoy)
      if (revisionesPasadas.length === 0) {
        prioridad = 'Sin revisión previa'
      } else {
        const ultimaRevision = new Date(Math.max(...revisionesPasadas.map((c) => aFecha(c.fecha).getTime())))
        const mesesDesdeRevision = mesesEntre(ultimaRevision, hoy)
        const umbral = tipo === 'Infantil' ? MESES_VENCIDA_NINO : MESES_VENCIDA_ADULTO
        prioridad = mesesDesdeRevision >= umbral ? 'VENCIDA' : 'Al día'
      }
    }

    resultado.push({
      paciente_clave: clave,
      nombre_mostrar: nombreMostrar,
      primer_estudio: primerEstudio ? primerEstudio.toISOString().slice(0, 10) : null,
      num_revisiones: numRevisiones,
      ultima_cita: ultimaCita ? ultimaCita.toISOString().slice(0, 10) : null,
      meses_desde_ultima: mesesDesdeUltima,
      cita_futura_auto: citaFuturaAuto,
      estado,
      tipo,
      prioridad,
      podologo_estudio: podologoEstudio,
      lleva_plantillas: llevaPlantillas,
      fecha_entrega_plantillas: fechaEntregaPlantillas,
      cita_futura_manual: gestion?.cita_futura_manual ?? false,
      cita_futura_fecha: gestion?.cita_futura_fecha ?? null,
      gestion_recontacto: gestion?.gestion_recontacto ?? 'PENDIENTE',
      gestion_actualizada_en: gestion?.updated_at ?? null,
      proximo_intento: gestion?.proximo_intento ?? null,
      notas: gestion?.notas ?? null,
    })
  }

  return resultado
}

export interface ResumenSeguimiento {
  total: number
  sin_cita: number
  revision_citada: number
  sin_revision_previa: number
  vencidas: number
  al_dia: number
  con_plantillas_pendientes: number
}

export function calcularResumen(pacientes: PacienteSeguimiento[]): ResumenSeguimiento {
  return {
    total: pacientes.length,
    sin_cita: pacientes.filter((p) => p.estado === 'SIN CITA - recontactar').length,
    revision_citada: pacientes.filter((p) => p.estado === 'Revisión citada').length,
    sin_revision_previa: pacientes.filter((p) => p.prioridad === 'Sin revisión previa').length,
    vencidas: pacientes.filter((p) => p.prioridad === 'VENCIDA').length,
    al_dia: pacientes.filter((p) => p.prioridad === 'Al día').length,
    con_plantillas_pendientes: pacientes.filter((p) => p.lleva_plantillas && p.estado === 'SIN CITA - recontactar').length,
  }
}

export interface ResumenPodologo {
  podologo: string
  total_pacientes: number
  sin_cita: number
  con_cita: number
  porcentaje_sin_cita: number
}

export function calcularResumenPorPodologo(pacientes: PacienteSeguimiento[]): ResumenPodologo[] {
  const porPodologo = new Map<string, PacienteSeguimiento[]>()
  for (const p of pacientes) {
    if (!p.podologo_estudio) continue
    const lista = porPodologo.get(p.podologo_estudio) ?? []
    lista.push(p)
    porPodologo.set(p.podologo_estudio, lista)
  }

  return Array.from(porPodologo.entries())
    .map(([podologo, lista]) => {
      const sinCita = lista.filter((p) => p.estado === 'SIN CITA - recontactar').length
      const conCita = lista.filter((p) => p.estado === 'Revisión citada').length
      return {
        podologo,
        total_pacientes: lista.length,
        sin_cita: sinCita,
        con_cita: conCita,
        porcentaje_sin_cita: lista.length > 0 ? sinCita / lista.length : 0,
      }
    })
    .sort((a, b) => b.total_pacientes - a.total_pacientes)
}

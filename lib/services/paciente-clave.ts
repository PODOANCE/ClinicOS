/**
 * Clave de identidad de paciente compartida por Seguimiento, Recordatorios y
 * el listado de teléfonos: mismo nombre normalizado en los tres sitios para
 * que las filas de uno casen con las del otro. Antes estaba copiada tres
 * veces sin quitar acentos ("JOSÉ" y "JOSE" no casaban); ahora vive en un
 * único sitio y sí los quita.
 */
export function normalizarClavePaciente(nombreCompleto: string): string {
  return nombreCompleto
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
}

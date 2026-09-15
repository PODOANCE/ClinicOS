/**
 * Verificación del parser de extractos bancarios contra un XLSX real.
 *
 *   node scripts/verificar-importador.mjs <ruta-al-xlsx>
 *
 * El extracto es un dato real y no se versiona: hay que indicar su ruta.
 * Los valores esperados corresponden al extracto de Sabadell de ene–sep 2026;
 * con otro archivo, ajústalos o úsalo solo como inspección.
 *
 * Compila el servicio TypeScript a un directorio temporal para poder cargarlo
 * sin añadir dependencias de ejecución al proyecto.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const CENTRO_ID = process.env.CENTRO_ID ?? '12345678-1234-5678-1234-567812345678'

const ESPERADO = {
  movimientos: 800,
  huellasUnicas: 800,
  cargos: 594,
  abonos: 206,
  periodoDesde: '2026-01-02',
  periodoHasta: '2026-09-01',
  errores: 0,
  gruposDuplicados: 3,
  movimientosEnGruposDuplicados: 6,
}

if (!process.argv[2]) {
  console.error('Uso: node scripts/verificar-importador.mjs <ruta-al-xlsx>')
  console.error('El extracto bancario no se versiona: indica dónde está el archivo.')
  process.exit(2)
}

const rutaXlsx = resolve(process.argv[2])
const raiz = resolve(import.meta.dirname, '..')
// Dentro del proyecto para que el compilado resuelva node_modules; se borra al salir.
const salida = mkdtempSync(join(raiz, 'node_modules', '.cache', 'clinicos-verif-'))

let modulo
try {
  execFileSync(
    'npx',
    [
      'tsc',
      'lib/services/banco-importacion.ts',
      '--outDir', salida,
      '--module', 'nodenext',
      '--moduleResolution', 'nodenext',
      '--target', 'es2022',
      '--skipLibCheck',
    ],
    { cwd: raiz, stdio: 'pipe' }
  )
  modulo = await import(pathToFileURL(join(salida, 'banco-importacion.js')).href)
} catch (error) {
  console.error('No se pudo compilar o cargar el servicio:')
  console.error(error.stdout?.toString() || error.message)
  rmSync(salida, { recursive: true, force: true })
  process.exit(1)
}

const { parsearExtractoBancario, normalizarConcepto, calcularHuella } = modulo

const comprobaciones = []
function comprobar(etiqueta, real, esperado) {
  const ok = real === esperado
  comprobaciones.push({ etiqueta, real, esperado, ok })
  const estado = ok ? 'OK  ' : 'FALLO'
  console.log(`  [${estado}] ${etiqueta.padEnd(46)} ${String(real).padStart(12)}  (esperado ${esperado})`)
}

console.log(`\nArchivo: ${rutaXlsx}\n`)
console.log('INVARIANTES DEL PARSER')
console.log('='.repeat(78))

const contenido = readFileSync(rutaXlsx)
const resultado = await parsearExtractoBancario(contenido, CENTRO_ID)
const { movimientos, errores, periodo } = resultado

comprobar('Movimientos parseados', movimientos.length, ESPERADO.movimientos)
comprobar('Huellas únicas', new Set(movimientos.map((m) => m.huella)).size, ESPERADO.huellasUnicas)
comprobar('Filas con error', errores.length, ESPERADO.errores)
comprobar('Sentido CARGO', movimientos.filter((m) => m.sentido === 'CARGO').length, ESPERADO.cargos)
comprobar('Sentido ABONO', movimientos.filter((m) => m.sentido === 'ABONO').length, ESPERADO.abonos)
comprobar('Periodo desde', periodo?.desde, ESPERADO.periodoDesde)
comprobar('Periodo hasta', periodo?.hasta, ESPERADO.periodoHasta)

const centimosConSigno = (m) => (m.sentido === 'CARGO' ? -1 : 1) * Math.round(m.importe * 100)
const grupos = new Map()
for (const m of movimientos) {
  const clave = `${m.fecha}|${centimosConSigno(m)}|${normalizarConcepto(m.concepto)}`
  grupos.set(clave, (grupos.get(clave) ?? 0) + 1)
}
const duplicados = [...grupos.entries()].filter(([, n]) => n > 1)

comprobar('Grupos con ordinal > 1', duplicados.length, ESPERADO.gruposDuplicados)
comprobar(
  'Movimientos en esos grupos',
  duplicados.reduce((total, [, n]) => total + n, 0),
  ESPERADO.movimientosEnGruposDuplicados
)

comprobar('Importes siempre positivos', movimientos.every((m) => m.importe > 0), true)
comprobar('Fechas en formato ISO', movimientos.every((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.fecha)), true)

console.log('\nDETERMINISMO E INDEPENDENCIA DEL ORDEN')
console.log('='.repeat(78))

const segundaPasada = await parsearExtractoBancario(contenido, CENTRO_ID)
const huellas1 = new Set(movimientos.map((m) => m.huella))
const huellas2 = new Set(segundaPasada.movimientos.map((m) => m.huella))
const iguales = (a, b) => a.size === b.size && [...a].every((x) => b.has(x))

comprobar('Dos pasadas producen las mismas huellas', iguales(huellas1, huellas2), true)

// El ordinal debe depender de la multiplicidad dentro del grupo, nunca del
// orden de las filas: se recalcula sobre los movimientos invertidos.
function recalcularHuellas(lista) {
  const ocurrencias = new Map()
  return new Set(
    lista.map((m) => {
      const centimos = centimosConSigno(m)
      const normalizado = normalizarConcepto(m.concepto)
      const clave = `${m.fecha}|${centimos}|${normalizado}`
      const ordinal = (ocurrencias.get(clave) ?? 0) + 1
      ocurrencias.set(clave, ordinal)
      return calcularHuella(CENTRO_ID, m.fecha, centimos, normalizado, ordinal)
    })
  )
}

comprobar('Orden invertido produce las mismas huellas', iguales(recalcularHuellas([...movimientos].reverse()), huellas1), true)

const barajado = [...movimientos]
for (let i = barajado.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1))
  ;[barajado[i], barajado[j]] = [barajado[j], barajado[i]]
}
comprobar('Orden aleatorio produce las mismas huellas', iguales(recalcularHuellas(barajado), huellas1), true)

console.log('\nMUESTRA')
console.log('='.repeat(78))
for (const m of movimientos.slice(0, 3)) {
  console.log(`  ${m.fecha}  ${m.sentido.padEnd(5)} ${String(m.importe).padStart(9)}  ${m.huella.slice(0, 12)}…  ${m.concepto.slice(0, 40)}`)
}
if (duplicados.length > 0) {
  console.log('\n  Grupos con movimientos idénticos (ordinal > 1):')
  for (const [clave, n] of duplicados) {
    const [fecha, centimos] = clave.split('|')
    console.log(`    x${n}  ${fecha}  ${(Number(centimos) / 100).toFixed(2)} €  ${clave.split('|')[2].slice(0, 45)}`)
  }
}

rmSync(salida, { recursive: true, force: true })

const fallos = comprobaciones.filter((c) => !c.ok)
console.log('\n' + '='.repeat(78))
if (fallos.length === 0) {
  console.log(`RESULTADO: ${comprobaciones.length}/${comprobaciones.length} invariantes OK`)
  process.exit(0)
}
console.log(`RESULTADO: ${fallos.length} FALLO(S) de ${comprobaciones.length}`)
for (const f of fallos) console.log(`   - ${f.etiqueta}: obtenido ${f.real}, esperado ${f.esperado}`)
process.exit(1)

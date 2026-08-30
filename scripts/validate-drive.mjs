// BLOQUE 0 — validación de la integración con Google Drive (Service Account).
// No forma parte de la aplicación: es un script de diagnóstico, ejecutar a mano.
//
// Requiere en .env.local:
//   GOOGLE_SERVICE_ACCOUNT_KEY   -> contenido completo del JSON de la cuenta de servicio, en una sola línea
//   GOOGLE_DRIVE_TEST_FOLDER_ID  -> ID de una carpeta de Drive compartida como Editor con esa cuenta de servicio
//
// Uso: node --env-file=.env.local scripts/validate-drive.mjs

import { google } from 'googleapis'

const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
const testFolderId = process.env.GOOGLE_DRIVE_TEST_FOLDER_ID

if (!keyJson || !testFolderId) {
  console.error('Faltan GOOGLE_SERVICE_ACCOUNT_KEY o GOOGLE_DRIVE_TEST_FOLDER_ID en .env.local')
  process.exit(1)
}

// La clave privada solo vive en memoria, leída de la variable de entorno.
// No se escribe en el código, no se vuelca a consola en ningún punto de este
// script (ni siquiera en el manejo de errores, ver safeErrorSummary más abajo).
const credentials = JSON.parse(keyJson)

const auth = new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/drive'],
})

const drive = google.drive({ version: 'v3', auth })

async function main() {
  console.log('Cuenta de servicio:', credentials.client_email)

  console.log('\n[1] Listar contenido de la carpeta de prueba...')
  const list = await drive.files.list({
    q: `'${testFolderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType)',
  })
  console.log('OK — listado funciona. Archivos existentes:', list.data.files.length)

  console.log('\n[2] Crear dos subcarpetas de prueba (A y B)...')
  const folderA = await drive.files.create({
    requestBody: { name: 'clinicos-test-A', mimeType: 'application/vnd.google-apps.folder', parents: [testFolderId] },
    fields: 'id, name',
  })
  const folderB = await drive.files.create({
    requestBody: { name: 'clinicos-test-B', mimeType: 'application/vnd.google-apps.folder', parents: [testFolderId] },
    fields: 'id, name',
  })
  console.log('OK — carpetas creadas:', folderA.data.id, folderB.data.id)

  console.log('\n[3] Crear un archivo de prueba dentro de A...')
  const file = await drive.files.create({
    requestBody: { name: 'clinicos-test-file.txt', parents: [folderA.data.id] },
    media: { mimeType: 'text/plain', body: 'Archivo de prueba ClinicOS — validación Bloque 0' },
    fields: 'id, name, webViewLink',
  })
  console.log('OK — archivo creado. file_id:', file.data.id)
  console.log('webViewLink:', file.data.webViewLink)

  console.log('\n[4] Leer el contenido del archivo...')
  const content = await drive.files.get({ fileId: file.data.id, alt: 'media' }, { responseType: 'text' })
  console.log('OK — contenido leído:', JSON.stringify(content.data))

  console.log('\n[5] Mover el archivo de A a B (addParents/removeParents)...')
  const moved = await drive.files.update({
    fileId: file.data.id,
    addParents: folderB.data.id,
    removeParents: folderA.data.id,
    fields: 'id, parents',
  })
  console.log('OK — movido. Parents actuales:', moved.data.parents)
  console.log('file_id se mantiene igual tras mover:', moved.data.id === file.data.id)

  console.log('\n[Limpieza] Eliminando artefactos de prueba...')
  await drive.files.delete({ fileId: file.data.id })
  await drive.files.delete({ fileId: folderA.data.id })
  await drive.files.delete({ fileId: folderB.data.id })
  console.log('OK — limpieza completa, no queda nada de prueba en Drive.')

  console.log('\n✅ VALIDACIÓN COMPLETA: listar, crear carpeta, crear archivo, leer, mover (con file_id estable) y limpiar — todo funciona con Service Account + carpeta compartida.')
}

// Extrae únicamente campos seguros del error. Los errores de googleapis/gaxios
// pueden llevar colgado `.config.headers.Authorization` (el token firmado a
// partir de la clave privada) o `.response` con la petición completa: nunca se
// vuelca el objeto de error entero para evitar que eso acabe en un log.
function safeErrorSummary(err) {
  const status = err?.code ?? err?.response?.status ?? null
  const apiErrors = err?.errors ?? err?.response?.data?.error?.errors ?? null
  return {
    message: err?.message ?? String(err),
    status,
    apiErrors,
  }
}

main().catch((err) => {
  const summary = safeErrorSummary(err)
  console.error('\n❌ ERROR EN LA VALIDACIÓN')
  console.error('Mensaje:', summary.message)
  if (summary.status) console.error('Código:', summary.status)
  if (summary.apiErrors) console.error('Detalle API:', JSON.stringify(summary.apiErrors, null, 2))
  console.error('\nSi el error menciona "storage quota" al crear carpeta/archivo (paso 2 o 3), es la señal exacta que buscábamos: la Service Account no puede crear contenido incluso dentro de una carpeta compartida, y hay que pasar al plan de respaldo (OAuth2).')
  process.exit(1)
})

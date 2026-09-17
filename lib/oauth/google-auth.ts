import { google } from 'googleapis'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  process.env.GOOGLE_OAUTH_REDIRECT_URI,
)

let serviceAccountAuth: InstanceType<typeof google.auth.GoogleAuth> | null = null

/**
 * Autenticación de Drive vía cuenta de servicio (sin caducidad, sin consentimiento
 * interactivo). Es el mecanismo real que usa facturas-drive.ts; el OAuth2 de
 * abajo se mantiene solo para las rutas de debug/test existentes.
 */
export function getServiceAccountAuth() {
  if (!serviceAccountAuth) {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    if (!raw) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY no configurado')
    }
    const credentials = JSON.parse(raw)
    serviceAccountAuth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    })
  }
  return serviceAccountAuth
}

export function getAuthorizationUrl(): string {
  const scopes = ['https://www.googleapis.com/auth/drive']
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  })
  return url
}

export async function exchangeCodeForTokens(code: string) {
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

export function setCredentials(tokens: any) {
  oauth2Client.setCredentials(tokens)
}

export function getOAuth2Client() {
  return oauth2Client
}

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'

// Rutas públicas que no requieren autenticación
const PUBLIC_ROUTES = ['/', '/login']

// Mapeo de rutas a permisos requeridos
const PROTECTED_ROUTES: Record<string, string | null> = {
  '/dashboard': null,  // Requiere solo autenticación, sin permiso específico
  '/areas/hoy': 'Hoy',
  '/areas/facturas': 'Facturas',
  '/areas/stock': 'Stock',
  '/areas/leads': 'Leads',
  '/areas/vacaciones': 'Vacaciones',
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Rutas públicas - permitir sin autenticación
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next()
  }

  // 2. Verificar que hay token de autenticación
  const authToken = request.cookies.get('sb-gyusgttlwjpnwchmrjih-auth-token')

  if (!authToken) {
    // No autenticado - redirigir a login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 3. Verificar permisos para rutas protegidas
  const requiredPermission = PROTECTED_ROUTES[pathname]

  if (requiredPermission === undefined) {
    // Ruta no definida
    return NextResponse.next()
  }

  // Si la ruta no requiere permiso específico (solo autenticación), permitir
  if (requiredPermission === null) {
    return NextResponse.next()
  }

  // 4. Verificar permiso específico en BD
  // Nota: En middleware no podemos acceder al navegador,
  // pero sí podemos hacer verificaciones mínimas.
  // La verificación completa se hace en los componentes.

  // Por ahora, permitir si está autenticado. En Fase 2 se puede
  // hacer una query más rigurosa aquí.

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Proteger todas las rutas excepto las públicas
    '/((?!login|_next/static|_next/image|favicon.ico).*)',
  ],
}

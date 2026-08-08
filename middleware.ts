import { type NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas
  if (pathname === '/login' || pathname === '/') {
    return NextResponse.next()
  }

  // Verificar auth token en cookies
  // Supabase auth tokens tienen el formato: sb-{project-ref}-auth-token
  const hasAuthToken = request.cookies.has('sb-gyusgttlwjpnwchmrjih-auth-token')

  // Si no hay token y trata de acceder a ruta protegida, redirige a login
  if (!hasAuthToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

// Middleware deshabilitado temporalmente para Fase 1
// La protección de rutas se hará en componentes individuales en Fase 2
export const config = {
  matcher: [],
}

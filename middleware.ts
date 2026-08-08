import { type NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas (sin auth requerida)
  if (pathname === '/login') {
    return NextResponse.next()
  }

  // Verificar si hay sesión de Supabase Auth en cookies
  const sessionToken = request.cookies.get('sb-gyusgttlwjpnwchmrjih-auth-token')?.value

  // Si no hay sesión y trata de acceder a ruta protegida, redirige a login
  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Usuario está autenticado, permite continuar
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|.*\\..*|public).*)',
  ],
}

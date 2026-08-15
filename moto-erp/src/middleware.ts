import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_SESION, verificarSesion } from '@/lib/session';

/**
 * Protege toda la aplicación: si no hay sesión válida, manda al login.
 * Corre en el edge, por eso usa `jose` (compatible) y no bcrypt.
 */
export async function middleware(peticion: NextRequest) {
  const token = peticion.cookies.get(COOKIE_SESION)?.value;
  const sesion = await verificarSesion(token);

  if (!sesion) {
    const login = new URL('/login', peticion.url);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Todo excepto:
     *  - /login, /bienvenida y /sin-permiso
     *  - recursos internos de Next y archivos estáticos
     *
     * El asistente de primer uso queda fuera porque corre cuando todavía no
     * existe ningún usuario con quien iniciar sesión. Quién puede verlo se
     * decide en la propia página, que sí puede consultar la base de datos.
     */
    '/((?!login|bienvenida|sin-permiso|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

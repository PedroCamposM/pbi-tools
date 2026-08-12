import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_SESION = 'moto_sesion';

export type SesionUsuario = {
  id: number;
  nombre: string;
  email: string;
  rol: 'ADMINISTRADOR' | 'VENDEDOR' | 'ALMACENERO' | 'CAJERO';
};

function claveSecreta(): Uint8Array {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error(
      'SESSION_SECRET no esta configurado o es muy corto (minimo 32 caracteres). Revisa el archivo .env',
    );
  }
  return new TextEncoder().encode(secreto);
}

function horasSesion(): number {
  const h = Number(process.env.SESSION_HORAS ?? 12);
  return Number.isFinite(h) && h > 0 ? h : 12;
}

export async function firmarSesion(usuario: SesionUsuario): Promise<string> {
  const horas = horasSesion();
  return new SignJWT({ ...usuario })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${horas}h`)
    .sign(claveSecreta());
}

export async function verificarSesion(token: string | undefined): Promise<SesionUsuario | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, claveSecreta());
    if (typeof payload.id !== 'number' || typeof payload.email !== 'string') return null;
    return {
      id: payload.id,
      nombre: String(payload.nombre ?? ''),
      email: payload.email,
      rol: payload.rol as SesionUsuario['rol'],
    };
  } catch {
    return null;
  }
}

export function maxAgeSegundos(): number {
  return horasSesion() * 60 * 60;
}

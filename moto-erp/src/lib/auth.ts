import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { RolUsuario } from '@prisma/client';
import { COOKIE_SESION, verificarSesion, type SesionUsuario } from './session';

/** Devuelve la sesion actual o null. No redirige. */
export async function sesionActual(): Promise<SesionUsuario | null> {
  const store = await cookies();
  return verificarSesion(store.get(COOKIE_SESION)?.value);
}

/** Exige sesion; si no hay, manda al login. */
export async function requerirUsuario(): Promise<SesionUsuario> {
  const usuario = await sesionActual();
  if (!usuario) redirect('/login');
  return usuario;
}

/** Exige que el usuario tenga uno de los roles indicados. */
export async function requerirRol(...roles: RolUsuario[]): Promise<SesionUsuario> {
  const usuario = await requerirUsuario();
  if (roles.length && !roles.includes(usuario.rol as RolUsuario)) {
    redirect('/sin-permiso');
  }
  return usuario;
}

export const ROLES_ADMIN: RolUsuario[] = ['ADMINISTRADOR'];
export const ROLES_VENTA: RolUsuario[] = ['ADMINISTRADOR', 'VENDEDOR', 'CAJERO'];
export const ROLES_ALMACEN: RolUsuario[] = ['ADMINISTRADOR', 'ALMACENERO'];
export const ROLES_CAJA: RolUsuario[] = ['ADMINISTRADOR', 'CAJERO'];

export function puede(rol: string, permitidos: RolUsuario[]): boolean {
  return permitidos.includes(rol as RolUsuario);
}

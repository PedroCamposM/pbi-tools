'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { COOKIE_SESION, firmarSesion, maxAgeSegundos } from '@/lib/session';
import { desdeError, falla, type Resultado } from '@/lib/resultado';

const esquemaLogin = z.object({
  email: z.string().trim().email('Correo inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

export async function iniciarSesion(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    const datos = esquemaLogin.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    const usuario = await db.usuario.findUnique({ where: { email: datos.email.toLowerCase() } });

    if (!usuario || !usuario.activo) {
      return falla('Usuario o contraseña incorrectos.');
    }

    const coincide = await bcrypt.compare(datos.password, usuario.passwordHash);
    if (!coincide) {
      return falla('Usuario o contraseña incorrectos.');
    }

    const token = await firmarSesion({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    });

    const store = await cookies();
    store.set(COOKIE_SESION, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: maxAgeSegundos(),
    });
  } catch (error) {
    return desdeError(error);
  }

  redirect('/');
}

export async function cerrarSesion(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_SESION);
  redirect('/login');
}

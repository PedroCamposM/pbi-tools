'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { instalarSistema, sistemaConfigurado } from '@/lib/instalacion';
import { COOKIE_SESION, firmarSesion, maxAgeSegundos } from '@/lib/session';
import { desdeError, falla, type Resultado } from '@/lib/resultado';
import { booleanoForm, enteroForm, numeroForm, textoOpcional, rucValido } from '@/lib/validadores';

const esquema = z.object({
  ruc: z.string().trim().length(11, 'El RUC debe tener 11 dígitos'),
  razonSocial: z.string().trim().min(3, 'Ingresa la razón social'),
  nombreComercial: textoOpcional,
  direccion: z.string().trim().min(5, 'Ingresa la dirección fiscal'),
  ubigeo: z.string().trim().length(6, 'El ubigeo tiene 6 dígitos'),
  distrito: textoOpcional,
  provincia: textoOpcional,
  departamento: textoOpcional,
  telefono: textoOpcional,
  email: textoOpcional,
  igvPorcentaje: numeroForm(18),
  regimen: z.string().trim().default('MYPE_TRIBUTARIO'),

  serieFactura: z.string().trim().length(4, 'La serie tiene 4 caracteres'),
  serieBoleta: z.string().trim().length(4, 'La serie tiene 4 caracteres'),
  correlativoFactura: enteroForm(0),
  correlativoBoleta: enteroForm(0),

  adminNombre: z.string().trim().min(2, 'Ingresa tu nombre'),
  adminEmail: z.string().trim().email('Correo inválido'),
  adminPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  adminPassword2: z.string(),

  cargarCatalogoBase: booleanoForm.default(true),
  cargarServicios: booleanoForm.default(true),
});

/**
 * Deja el sistema listo y deja la sesión iniciada como administrador, para que
 * quien instala entre directo a trabajar sin volver a escribir su contraseña.
 */
export async function configurarSistema(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    if (await sistemaConfigurado()) {
      return falla('El sistema ya fue configurado. Inicia sesión con tu usuario.');
    }

    const datos = esquema.parse({
      ruc: formData.get('ruc'),
      razonSocial: formData.get('razonSocial'),
      nombreComercial: formData.get('nombreComercial'),
      direccion: formData.get('direccion'),
      ubigeo: formData.get('ubigeo'),
      distrito: formData.get('distrito'),
      provincia: formData.get('provincia'),
      departamento: formData.get('departamento'),
      telefono: formData.get('telefono'),
      email: formData.get('email'),
      igvPorcentaje: formData.get('igvPorcentaje'),
      regimen: formData.get('regimen') || 'MYPE_TRIBUTARIO',
      serieFactura: String(formData.get('serieFactura') ?? '').toUpperCase(),
      serieBoleta: String(formData.get('serieBoleta') ?? '').toUpperCase(),
      correlativoFactura: formData.get('correlativoFactura'),
      correlativoBoleta: formData.get('correlativoBoleta'),
      adminNombre: formData.get('adminNombre'),
      adminEmail: formData.get('adminEmail'),
      adminPassword: formData.get('adminPassword'),
      adminPassword2: formData.get('adminPassword2'),
      cargarCatalogoBase: formData.get('cargarCatalogoBase'),
      cargarServicios: formData.get('cargarServicios'),
    });

    if (datos.adminPassword !== datos.adminPassword2) {
      return falla('Las contraseñas no coinciden.', { adminPassword2: 'No coincide' });
    }

    if (!rucValido(datos.ruc)) {
      return falla(
        'El RUC no pasa la validación del dígito verificador. Revísalo: si está mal, todos tus comprobantes saldrán con un RUC inválido.',
        { ruc: 'RUC inválido' },
      );
    }

    if (!datos.serieFactura.startsWith('F')) {
      return falla('La serie de factura debe empezar con F (ejemplo: F001).', {
        serieFactura: 'Debe empezar con F',
      });
    }
    if (!datos.serieBoleta.startsWith('B')) {
      return falla('La serie de boleta debe empezar con B (ejemplo: B001).', {
        serieBoleta: 'Debe empezar con B',
      });
    }

    await instalarSistema(datos);

    const usuario = await db.usuario.findUniqueOrThrow({
      where: { email: datos.adminEmail.toLowerCase() },
    });

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

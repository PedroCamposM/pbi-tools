'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requerirUsuario, requerirRol, ROLES_ADMIN } from '@/lib/auth';
import { desdeError, exito, falla, type Resultado } from '@/lib/resultado';
import { booleanoForm, enteroForm, idOpcional, numeroForm, textoOpcional, rucValido, validarDocumento } from '@/lib/validadores';
import { num } from '@/lib/money';
import type { ClienteBusqueda } from '@/lib/tipos-ui';

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

const esquemaCliente = z.object({
  tipoDocumento: z.enum(['SIN_DOCUMENTO', 'DNI', 'CARNET_EXTRANJERIA', 'RUC', 'PASAPORTE']),
  numeroDocumento: z.string().trim().min(1, 'Ingresa el número de documento'),
  nombre: z.string().trim().min(2, 'Ingresa el nombre o razón social'),
  direccion: textoOpcional,
  telefono: textoOpcional,
  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().email('Correo inválido').nullable().optional(),
  ),
  tipoCliente: z.enum(['PUBLICO', 'TECNICO', 'MAYORISTA']).default('PUBLICO'),
  lineaCredito: numeroForm(0),
  diasCredito: enteroForm(0),
  activo: booleanoForm.default(true),
});

export async function guardarCliente(
  _estado: Resultado<{ id: number }> | null,
  formData: FormData,
): Promise<Resultado<{ id: number }>> {
  try {
    await requerirUsuario();
    const id = Number(formData.get('id') ?? 0);

    const datos = esquemaCliente.parse({
      tipoDocumento: formData.get('tipoDocumento'),
      numeroDocumento: formData.get('numeroDocumento'),
      nombre: formData.get('nombre'),
      direccion: formData.get('direccion'),
      telefono: formData.get('telefono'),
      email: formData.get('email'),
      tipoCliente: formData.get('tipoCliente') || 'PUBLICO',
      lineaCredito: formData.get('lineaCredito'),
      diasCredito: formData.get('diasCredito'),
      activo: formData.get('activo'),
    });

    const errorDoc = validarDocumento(datos.tipoDocumento, datos.numeroDocumento);
    if (errorDoc) return falla(errorDoc, { numeroDocumento: errorDoc });

    if (datos.tipoDocumento === 'RUC' && !rucValido(datos.numeroDocumento)) {
      return falla('El RUC no pasa la validación del dígito verificador.', {
        numeroDocumento: 'RUC inválido',
      });
    }

    const cliente = id
      ? await db.cliente.update({ where: { id }, data: datos })
      : await db.cliente.create({ data: datos });

    revalidatePath('/clientes');
    return exito({ id: cliente.id }, id ? 'Cliente actualizado.' : 'Cliente registrado.');
  } catch (error) {
    return desdeError(error);
  }
}

/** Busqueda rapida de clientes para el POS y el taller. */
export async function buscarClientes(termino: string, limite = 15): Promise<ClienteBusqueda[]> {
  await requerirUsuario();
  const texto = termino.trim();

  const clientes = await db.cliente.findMany({
    where: {
      activo: true,
      ...(texto.length >= 2
        ? {
            OR: [
              { nombre: { contains: texto, mode: 'insensitive' as const } },
              { numeroDocumento: { contains: texto } },
            ],
          }
        : {}),
    },
    orderBy: { nombre: 'asc' },
    take: limite,
  });

  const saldos = await db.cuentaPorCobrar.groupBy({
    by: ['clienteId'],
    where: { clienteId: { in: clientes.map((c) => c.id) }, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
    _sum: { saldo: true },
  });
  const porCliente = new Map(saldos.map((s) => [s.clienteId, num(s._sum.saldo ?? 0)]));

  return clientes.map((c) => ({
    id: c.id,
    tipoDocumento: c.tipoDocumento,
    numeroDocumento: c.numeroDocumento,
    nombre: c.nombre,
    direccion: c.direccion,
    tipoCliente: c.tipoCliente,
    lineaCredito: num(c.lineaCredito),
    diasCredito: c.diasCredito,
    saldoPendiente: porCliente.get(c.id) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------

export async function guardarProveedor(
  _estado: Resultado<{ id: number }> | null,
  formData: FormData,
): Promise<Resultado<{ id: number }>> {
  try {
    await requerirUsuario();
    const id = Number(formData.get('id') ?? 0);

    const datos = z
      .object({
        tipoDocumento: z.enum(['SIN_DOCUMENTO', 'DNI', 'CARNET_EXTRANJERIA', 'RUC', 'PASAPORTE']),
        numeroDocumento: z.string().trim().min(1, 'Ingresa el número de documento'),
        razonSocial: z.string().trim().min(2, 'Ingresa la razón social'),
        direccion: textoOpcional,
        telefono: textoOpcional,
        email: textoOpcional,
        contacto: textoOpcional,
        diasCredito: enteroForm(0),
        activo: booleanoForm.default(true),
      })
      .parse({
        tipoDocumento: formData.get('tipoDocumento') || 'RUC',
        numeroDocumento: formData.get('numeroDocumento'),
        razonSocial: formData.get('razonSocial'),
        direccion: formData.get('direccion'),
        telefono: formData.get('telefono'),
        email: formData.get('email'),
        contacto: formData.get('contacto'),
        diasCredito: formData.get('diasCredito'),
        activo: formData.get('activo'),
      });

    const errorDoc = validarDocumento(datos.tipoDocumento, datos.numeroDocumento);
    if (errorDoc) return falla(errorDoc, { numeroDocumento: errorDoc });

    const proveedor = id
      ? await db.proveedor.update({ where: { id }, data: datos })
      : await db.proveedor.create({ data: datos });

    revalidatePath('/proveedores');
    return exito({ id: proveedor.id }, id ? 'Proveedor actualizado.' : 'Proveedor registrado.');
  } catch (error) {
    return desdeError(error);
  }
}

// ---------------------------------------------------------------------------
// Tecnicos
// ---------------------------------------------------------------------------

export async function guardarTecnico(
  _estado: Resultado<{ id: number }> | null,
  formData: FormData,
): Promise<Resultado<{ id: number }>> {
  try {
    await requerirUsuario();
    const id = Number(formData.get('id') ?? 0);

    const datos = z
      .object({
        nombre: z.string().trim().min(2, 'Ingresa el nombre del técnico'),
        documento: textoOpcional,
        telefono: textoOpcional,
        taller: textoOpcional,
        direccion: textoOpcional,
        comisionVentaPct: numeroForm(0),
        comisionServicioPct: numeroForm(0),
        clienteId: idOpcional,
        activo: booleanoForm.default(true),
      })
      .parse({
        nombre: formData.get('nombre'),
        documento: formData.get('documento'),
        telefono: formData.get('telefono'),
        taller: formData.get('taller'),
        direccion: formData.get('direccion'),
        comisionVentaPct: formData.get('comisionVentaPct'),
        comisionServicioPct: formData.get('comisionServicioPct'),
        clienteId: formData.get('clienteId'),
        activo: formData.get('activo'),
      });

    if (datos.comisionVentaPct < 0 || datos.comisionVentaPct > 100) {
      return falla('La comisión por venta debe estar entre 0 y 100.');
    }
    if (datos.comisionServicioPct < 0 || datos.comisionServicioPct > 100) {
      return falla('La comisión por servicio debe estar entre 0 y 100.');
    }

    const tecnico = id
      ? await db.tecnico.update({ where: { id }, data: datos })
      : await db.tecnico.create({ data: datos });

    revalidatePath('/tecnicos');
    return exito({ id: tecnico.id }, id ? 'Técnico actualizado.' : 'Técnico registrado.');
  } catch (error) {
    return desdeError(error);
  }
}

/**
 * Crea la ficha de cliente de un tecnico para poder venderle al credito
 * con precio de tecnico.
 */
export async function vincularClienteTecnico(tecnicoId: number): Promise<Resultado> {
  try {
    await requerirUsuario();
    const tecnico = await db.tecnico.findUniqueOrThrow({ where: { id: tecnicoId } });
    if (tecnico.clienteId) return falla('El técnico ya tiene una ficha de cliente.');

    const documento = (tecnico.documento ?? '').trim();
    if (!documento) return falla('Registra primero el documento del técnico.');

    const tipoDocumento = documento.length === 11 ? 'RUC' : 'DNI';

    const existente = await db.cliente.findUnique({
      where: { tipoDocumento_numeroDocumento: { tipoDocumento, numeroDocumento: documento } },
    });

    const cliente =
      existente ??
      (await db.cliente.create({
        data: {
          tipoDocumento,
          numeroDocumento: documento,
          nombre: tecnico.nombre,
          telefono: tecnico.telefono,
          direccion: tecnico.direccion,
          tipoCliente: 'TECNICO',
          diasCredito: 15,
        },
      }));

    await db.tecnico.update({ where: { id: tecnicoId }, data: { clienteId: cliente.id } });

    revalidatePath('/tecnicos');
    revalidatePath('/clientes');
    return exito(undefined, 'Ficha de cliente vinculada al técnico.');
  } catch (error) {
    return desdeError(error);
  }
}

// ---------------------------------------------------------------------------
// Motos de los clientes
// ---------------------------------------------------------------------------

export async function guardarMoto(
  _estado: Resultado<{ id: number }> | null,
  formData: FormData,
): Promise<Resultado<{ id: number }>> {
  try {
    await requerirUsuario();
    const id = Number(formData.get('id') ?? 0);

    const datos = z
      .object({
        placa: textoOpcional,
        clienteId: idOpcional,
        marcaMotoId: idOpcional,
        modeloMotoId: idOpcional,
        anio: z.preprocess((v) => (v === '' || v === null ? null : Number(v)), z.number().int().nullable()),
        color: textoOpcional,
        numeroMotor: textoOpcional,
        numeroChasis: textoOpcional,
        observacion: textoOpcional,
      })
      .parse({
        placa: formData.get('placa'),
        clienteId: formData.get('clienteId'),
        marcaMotoId: formData.get('marcaMotoId'),
        modeloMotoId: formData.get('modeloMotoId'),
        anio: formData.get('anio'),
        color: formData.get('color'),
        numeroMotor: formData.get('numeroMotor'),
        numeroChasis: formData.get('numeroChasis'),
        observacion: formData.get('observacion'),
      });

    const normalizado = { ...datos, placa: datos.placa ? datos.placa.toUpperCase() : null };

    const moto = id
      ? await db.moto.update({ where: { id }, data: normalizado })
      : await db.moto.create({ data: normalizado });

    revalidatePath('/taller');
    revalidatePath('/clientes');
    return exito({ id: moto.id }, id ? 'Moto actualizada.' : 'Moto registrada.');
  } catch (error) {
    return desdeError(error);
  }
}

// ---------------------------------------------------------------------------
// Usuarios del sistema
// ---------------------------------------------------------------------------

export async function guardarUsuario(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    await requerirRol(...ROLES_ADMIN);
    const bcrypt = (await import('bcryptjs')).default;
    const id = Number(formData.get('id') ?? 0);

    const datos = z
      .object({
        nombre: z.string().trim().min(2, 'Ingresa el nombre'),
        email: z.string().trim().email('Correo inválido'),
        rol: z.enum(['ADMINISTRADOR', 'VENDEDOR', 'ALMACENERO', 'CAJERO']),
        activo: booleanoForm.default(true),
      })
      .parse({
        nombre: formData.get('nombre'),
        email: formData.get('email'),
        rol: formData.get('rol'),
        activo: formData.get('activo'),
      });

    const password = String(formData.get('password') ?? '');

    if (!id && password.length < 6) {
      return falla('La contraseña debe tener al menos 6 caracteres.', { password: 'Muy corta' });
    }

    const base = { ...datos, email: datos.email.toLowerCase() };

    if (id) {
      await db.usuario.update({
        where: { id },
        data: password ? { ...base, passwordHash: await bcrypt.hash(password, 10) } : base,
      });
    } else {
      await db.usuario.create({
        data: { ...base, passwordHash: await bcrypt.hash(password, 10) },
      });
    }

    revalidatePath('/configuracion/usuarios');
    return exito(undefined, id ? 'Usuario actualizado.' : 'Usuario creado.');
  } catch (error) {
    return desdeError(error);
  }
}

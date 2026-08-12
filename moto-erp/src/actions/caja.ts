'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { d, CERO, redondear, num } from '@/lib/money';
import { desdeError, exito, falla, type Resultado } from '@/lib/resultado';
import { numeroForm, textoOpcional } from '@/lib/validadores';

export async function abrirCaja(
  _estado: Resultado<{ id: number }> | null,
  formData: FormData,
): Promise<Resultado<{ id: number }>> {
  try {
    const usuario = await requerirUsuario();

    const abierta = await db.cajaSesion.findFirst({
      where: { usuarioId: usuario.id, estado: 'ABIERTA' },
    });
    if (abierta) return falla('Ya tienes una caja abierta.');

    const datos = z
      .object({ montoApertura: numeroForm(0), observacion: textoOpcional })
      .parse({
        montoApertura: formData.get('montoApertura'),
        observacion: formData.get('observacion'),
      });

    if (datos.montoApertura < 0) return falla('El monto de apertura no puede ser negativo.');

    const caja = await db.cajaSesion.create({
      data: {
        usuarioId: usuario.id,
        montoApertura: d(datos.montoApertura),
        observacion: datos.observacion ?? null,
      },
    });

    revalidatePath('/caja');
    return exito({ id: caja.id }, 'Caja abierta.');
  } catch (error) {
    return desdeError(error);
  }
}

/**
 * Calcula lo que deberia haber en caja: apertura + ingresos en efectivo
 * − egresos en efectivo. Los cobros con Yape, tarjeta o transferencia se
 * informan aparte porque no estan fisicamente en el cajon.
 */
export async function resumenCaja(cajaSesionId: number) {
  await requerirUsuario();

  const caja = await db.cajaSesion.findUniqueOrThrow({
    where: { id: cajaSesionId },
    include: { movimientos: true, usuario: true },
  });

  let efectivoIngresos = CERO();
  let efectivoEgresos = CERO();
  const porMetodo = new Map<string, { ingresos: ReturnType<typeof CERO>; egresos: ReturnType<typeof CERO> }>();

  for (const mov of caja.movimientos) {
    const actual = porMetodo.get(mov.metodoPago) ?? { ingresos: CERO(), egresos: CERO() };
    if (mov.tipo === 'INGRESO') {
      actual.ingresos = actual.ingresos.plus(d(mov.monto));
      if (mov.metodoPago === 'EFECTIVO') efectivoIngresos = efectivoIngresos.plus(d(mov.monto));
    } else {
      actual.egresos = actual.egresos.plus(d(mov.monto));
      if (mov.metodoPago === 'EFECTIVO') efectivoEgresos = efectivoEgresos.plus(d(mov.monto));
    }
    porMetodo.set(mov.metodoPago, actual);
  }

  const efectivoEsperado = d(caja.montoApertura).plus(efectivoIngresos).minus(efectivoEgresos);

  return {
    id: caja.id,
    estado: caja.estado,
    usuario: caja.usuario.nombre,
    fechaApertura: caja.fechaApertura,
    montoApertura: num(caja.montoApertura),
    efectivoIngresos: num(efectivoIngresos),
    efectivoEgresos: num(efectivoEgresos),
    efectivoEsperado: num(efectivoEsperado),
    porMetodo: Array.from(porMetodo.entries()).map(([metodo, v]) => ({
      metodo,
      ingresos: num(v.ingresos),
      egresos: num(v.egresos),
      neto: num(v.ingresos.minus(v.egresos)),
    })),
  };
}

export async function cerrarCaja(
  _estado: Resultado<{ diferencia: number }> | null,
  formData: FormData,
): Promise<Resultado<{ diferencia: number }>> {
  try {
    const usuario = await requerirUsuario();

    const datos = z
      .object({
        cajaSesionId: z.coerce.number().int().positive(),
        montoCierre: numeroForm(0),
        observacion: textoOpcional,
      })
      .parse({
        cajaSesionId: formData.get('cajaSesionId'),
        montoCierre: formData.get('montoCierre'),
        observacion: formData.get('observacion'),
      });

    const caja = await db.cajaSesion.findUniqueOrThrow({ where: { id: datos.cajaSesionId } });
    if (caja.estado === 'CERRADA') return falla('Esta caja ya fue cerrada.');
    if (caja.usuarioId !== usuario.id && usuario.rol !== 'ADMINISTRADOR') {
      return falla('Solo el responsable de la caja o un administrador puede cerrarla.');
    }

    const resumen = await resumenCaja(datos.cajaSesionId);
    const esperado = d(resumen.efectivoEsperado);
    const diferencia = redondear(d(datos.montoCierre).minus(esperado));

    await db.cajaSesion.update({
      where: { id: datos.cajaSesionId },
      data: {
        estado: 'CERRADA',
        fechaCierre: new Date(),
        montoCierre: d(datos.montoCierre),
        montoEsperado: redondear(esperado),
        diferencia,
        observacion: datos.observacion ?? caja.observacion,
      },
    });

    revalidatePath('/caja');
    return exito(
      { diferencia: num(diferencia) },
      diferencia.isZero()
        ? 'Caja cerrada sin diferencias.'
        : `Caja cerrada con una diferencia de S/ ${diferencia.toFixed(2)}.`,
    );
  } catch (error) {
    return desdeError(error);
  }
}

/** Registra un ingreso o egreso manual (gastos, retiros, depositos). */
export async function registrarMovimientoCaja(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    const usuario = await requerirUsuario();

    const datos = z
      .object({
        tipo: z.enum(['INGRESO', 'EGRESO']),
        metodoPago: z.enum([
          'EFECTIVO',
          'YAPE',
          'PLIN',
          'TARJETA_DEBITO',
          'TARJETA_CREDITO',
          'TRANSFERENCIA',
        ]),
        categoria: z.string().trim().default('OTRO'),
        concepto: z.string().trim().min(3, 'Describe el movimiento'),
        monto: numeroForm(0),
        referencia: textoOpcional,
      })
      .parse({
        tipo: formData.get('tipo'),
        metodoPago: formData.get('metodoPago') || 'EFECTIVO',
        categoria: formData.get('categoria') || 'OTRO',
        concepto: formData.get('concepto'),
        monto: formData.get('monto'),
        referencia: formData.get('referencia'),
      });

    if (datos.monto <= 0) return falla('El monto debe ser mayor a cero.');

    const caja = await db.cajaSesion.findFirst({
      where: { usuarioId: usuario.id, estado: 'ABIERTA' },
      orderBy: { id: 'desc' },
    });
    if (!caja) return falla('Abre la caja antes de registrar movimientos.');

    if (datos.tipo === 'EGRESO' && datos.metodoPago === 'EFECTIVO') {
      const resumen = await resumenCaja(caja.id);
      if (datos.monto > resumen.efectivoEsperado) {
        return falla(
          `No hay suficiente efectivo en caja. Disponible: S/ ${resumen.efectivoEsperado.toFixed(2)}.`,
        );
      }
    }

    await db.movimientoCaja.create({
      data: {
        cajaSesionId: caja.id,
        usuarioId: usuario.id,
        tipo: datos.tipo,
        metodoPago: datos.metodoPago,
        categoria: datos.categoria,
        concepto: datos.concepto,
        monto: d(datos.monto),
        referencia: datos.referencia ?? null,
      },
    });

    revalidatePath('/caja');
    return exito(undefined, 'Movimiento registrado.');
  } catch (error) {
    return desdeError(error);
  }
}

/** Caja abierta del usuario actual (o null). */
export async function cajaAbiertaActual(): Promise<{ id: number } | null> {
  const usuario = await requerirUsuario();
  const caja = await db.cajaSesion.findFirst({
    where: { usuarioId: usuario.id, estado: 'ABIERTA' },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  return caja;
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { d, CERO, redondear } from '@/lib/money';
import { desdeError, exito, falla, type Resultado } from '@/lib/resultado';
import { textoOpcional } from '@/lib/validadores';
import { desdeInputFecha, finDia } from '@/lib/format';

/**
 * Liquida (paga) las comisiones pendientes de un tecnico en un periodo.
 * Genera el egreso de caja para que el arqueo del dia cuadre.
 */
export async function liquidarComisiones(
  _estado: Resultado<{ total: number; cantidad: number }> | null,
  formData: FormData,
): Promise<Resultado<{ total: number; cantidad: number }>> {
  try {
    const usuario = await requerirUsuario();

    const datos = z
      .object({
        tecnicoId: z.coerce.number().int().positive('Selecciona el técnico'),
        fechaDesde: z.string().trim().min(1, 'Indica la fecha inicial'),
        fechaHasta: z.string().trim().min(1, 'Indica la fecha final'),
        metodoPago: z.enum([
          'EFECTIVO',
          'YAPE',
          'PLIN',
          'TARJETA_DEBITO',
          'TARJETA_CREDITO',
          'TRANSFERENCIA',
        ]),
        observacion: textoOpcional,
      })
      .parse({
        tecnicoId: formData.get('tecnicoId'),
        fechaDesde: formData.get('fechaDesde'),
        fechaHasta: formData.get('fechaHasta'),
        metodoPago: formData.get('metodoPago') || 'EFECTIVO',
        observacion: formData.get('observacion'),
      });

    const desde = desdeInputFecha(datos.fechaDesde);
    const hasta = desdeInputFecha(datos.fechaHasta);
    if (!desde || !hasta) return falla('Fechas inválidas.');
    if (desde > hasta) return falla('La fecha inicial no puede ser mayor a la final.');

    const tecnico = await db.tecnico.findUniqueOrThrow({ where: { id: datos.tecnicoId } });

    const pendientes = await db.comision.findMany({
      where: {
        tecnicoId: datos.tecnicoId,
        estado: 'PENDIENTE',
        fecha: { gte: desde, lte: finDia(hasta) },
      },
    });

    if (pendientes.length === 0) {
      return falla('No hay comisiones pendientes de ese técnico en el periodo indicado.');
    }

    const total = redondear(pendientes.reduce((acc, c) => acc.plus(d(c.monto)), CERO()));

    const caja = await db.cajaSesion.findFirst({
      where: { usuarioId: usuario.id, estado: 'ABIERTA' },
      orderBy: { id: 'desc' },
    });
    if (!caja) return falla('Abre la caja antes de liquidar comisiones.');

    await db.$transaction(async (tx) => {
      const liquidacion = await tx.liquidacionComision.create({
        data: {
          tecnicoId: datos.tecnicoId,
          fechaDesde: desde,
          fechaHasta: finDia(hasta),
          total,
          metodoPago: datos.metodoPago,
          observacion: datos.observacion ?? null,
          usuarioId: usuario.id,
        },
      });

      await tx.comision.updateMany({
        where: { id: { in: pendientes.map((c) => c.id) } },
        data: { estado: 'LIQUIDADA', liquidacionId: liquidacion.id },
      });

      await tx.movimientoCaja.create({
        data: {
          cajaSesionId: caja.id,
          usuarioId: usuario.id,
          tipo: 'EGRESO',
          metodoPago: datos.metodoPago,
          categoria: 'LIQUIDACION_COMISION',
          concepto: `Liquidación de comisiones - ${tecnico.nombre}`,
          monto: total,
          referencia: `LIQ-${liquidacion.id}`,
        },
      });
    });

    revalidatePath('/tecnicos');
    revalidatePath('/caja');

    return exito(
      { total: Number(total), cantidad: pendientes.length },
      `Se liquidaron ${pendientes.length} comisiones por S/ ${total.toFixed(2)}.`,
    );
  } catch (error) {
    return desdeError(error);
  }
}

/** Ajuste manual de comisión (bonos o descuentos acordados con el técnico). */
export async function registrarComisionManual(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    await requerirUsuario();

    const datos = z
      .object({
        tecnicoId: z.coerce.number().int().positive('Selecciona el técnico'),
        concepto: z.string().trim().min(3, 'Describe el concepto'),
        monto: z.coerce.number(),
      })
      .parse({
        tecnicoId: formData.get('tecnicoId'),
        concepto: formData.get('concepto'),
        monto: formData.get('monto'),
      });

    if (datos.monto === 0) return falla('El monto no puede ser cero.');

    await db.comision.create({
      data: {
        tecnicoId: datos.tecnicoId,
        tipo: 'VENTA',
        concepto: datos.concepto,
        baseCalculo: 0,
        porcentaje: 0,
        monto: d(datos.monto),
      },
    });

    revalidatePath('/tecnicos');
    return exito(undefined, 'Ajuste de comisión registrado.');
  } catch (error) {
    return desdeError(error);
  }
}

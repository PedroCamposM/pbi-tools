'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { d, redondear } from '@/lib/money';
import { desdeError, exito, falla, type Resultado } from '@/lib/resultado';
import { numeroForm, textoOpcional } from '@/lib/validadores';
import { numeroComprobante } from '@/lib/sunat/catalogos';

// ---------------------------------------------------------------------------
// Cobranza a clientes (cuentas por cobrar)
// ---------------------------------------------------------------------------

export async function registrarCobro(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    const usuario = await requerirUsuario();

    const datos = z
      .object({
        cuentaId: z.coerce.number().int().positive(),
        monto: numeroForm(0),
        metodoPago: z.enum([
          'EFECTIVO',
          'YAPE',
          'PLIN',
          'TARJETA_DEBITO',
          'TARJETA_CREDITO',
          'TRANSFERENCIA',
        ]),
        referencia: textoOpcional,
      })
      .parse({
        cuentaId: formData.get('cuentaId'),
        monto: formData.get('monto'),
        metodoPago: formData.get('metodoPago') || 'EFECTIVO',
        referencia: formData.get('referencia'),
      });

    if (datos.monto <= 0) return falla('El monto debe ser mayor a cero.');

    const cuenta = await db.cuentaPorCobrar.findUniqueOrThrow({
      where: { id: datos.cuentaId },
      include: { cliente: true, venta: true },
    });

    if (cuenta.estado === 'PAGADA') return falla('Esta cuenta ya está pagada.');
    if (cuenta.estado === 'ANULADA') return falla('Esta cuenta está anulada.');

    const monto = d(datos.monto);
    if (monto.greaterThan(d(cuenta.saldo))) {
      return falla(`El cobro supera el saldo pendiente (S/ ${d(cuenta.saldo).toFixed(2)}).`);
    }

    const caja = await db.cajaSesion.findFirst({
      where: { usuarioId: usuario.id, estado: 'ABIERTA' },
      orderBy: { id: 'desc' },
    });
    if (!caja) return falla('Abre la caja antes de registrar el cobro.');

    const numero = numeroComprobante(cuenta.venta.serie, cuenta.venta.correlativo);

    await db.$transaction(async (tx) => {
      await tx.cobroCuentaPorCobrar.create({
        data: {
          cuentaId: cuenta.id,
          monto,
          metodoPago: datos.metodoPago,
          referencia: datos.referencia ?? null,
          cajaSesionId: caja.id,
          usuarioId: usuario.id,
        },
      });

      const nuevoSaldo = redondear(d(cuenta.saldo).minus(monto));

      await tx.cuentaPorCobrar.update({
        where: { id: cuenta.id },
        data: {
          saldo: nuevoSaldo,
          estado: nuevoSaldo.lessThanOrEqualTo(0) ? 'PAGADA' : 'PARCIAL',
        },
      });

      await tx.movimientoCaja.create({
        data: {
          cajaSesionId: caja.id,
          usuarioId: usuario.id,
          tipo: 'INGRESO',
          metodoPago: datos.metodoPago,
          categoria: 'COBRANZA',
          concepto: `Cobranza ${numero} - ${cuenta.cliente.nombre}`,
          monto,
          referencia: datos.referencia ?? numero,
        },
      });
    });

    revalidatePath('/cobranzas');
    revalidatePath('/caja');
    return exito(undefined, 'Cobro registrado.');
  } catch (error) {
    return desdeError(error);
  }
}

// ---------------------------------------------------------------------------
// Pagos a proveedores (cuentas por pagar)
// ---------------------------------------------------------------------------

export async function registrarPagoProveedor(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    const usuario = await requerirUsuario();

    const datos = z
      .object({
        cuentaId: z.coerce.number().int().positive(),
        monto: numeroForm(0),
        metodoPago: z.enum([
          'EFECTIVO',
          'YAPE',
          'PLIN',
          'TARJETA_DEBITO',
          'TARJETA_CREDITO',
          'TRANSFERENCIA',
        ]),
        referencia: textoOpcional,
      })
      .parse({
        cuentaId: formData.get('cuentaId'),
        monto: formData.get('monto'),
        metodoPago: formData.get('metodoPago') || 'EFECTIVO',
        referencia: formData.get('referencia'),
      });

    if (datos.monto <= 0) return falla('El monto debe ser mayor a cero.');

    const cuenta = await db.cuentaPorPagar.findUniqueOrThrow({
      where: { id: datos.cuentaId },
      include: { proveedor: true, compra: true },
    });

    if (cuenta.estado === 'PAGADA') return falla('Esta cuenta ya está pagada.');
    if (cuenta.estado === 'ANULADA') return falla('Esta cuenta está anulada.');

    const monto = d(datos.monto);
    if (monto.greaterThan(d(cuenta.saldo))) {
      return falla(`El pago supera el saldo pendiente (S/ ${d(cuenta.saldo).toFixed(2)}).`);
    }

    const caja = await db.cajaSesion.findFirst({
      where: { usuarioId: usuario.id, estado: 'ABIERTA' },
      orderBy: { id: 'desc' },
    });
    if (!caja) return falla('Abre la caja antes de registrar el pago.');

    const referenciaCompra = [cuenta.compra.serie, cuenta.compra.numero].filter(Boolean).join('-');

    await db.$transaction(async (tx) => {
      await tx.pagoCuentaPorPagar.create({
        data: {
          cuentaId: cuenta.id,
          monto,
          metodoPago: datos.metodoPago,
          referencia: datos.referencia ?? null,
          cajaSesionId: caja.id,
          usuarioId: usuario.id,
        },
      });

      const nuevoSaldo = redondear(d(cuenta.saldo).minus(monto));

      await tx.cuentaPorPagar.update({
        where: { id: cuenta.id },
        data: {
          saldo: nuevoSaldo,
          estado: nuevoSaldo.lessThanOrEqualTo(0) ? 'PAGADA' : 'PARCIAL',
        },
      });

      await tx.movimientoCaja.create({
        data: {
          cajaSesionId: caja.id,
          usuarioId: usuario.id,
          tipo: 'EGRESO',
          metodoPago: datos.metodoPago,
          categoria: 'COMPRA',
          concepto: `Pago a ${cuenta.proveedor.razonSocial} ${referenciaCompra}`.trim(),
          monto,
          referencia: datos.referencia ?? referenciaCompra,
        },
      });
    });

    revalidatePath('/cobranzas');
    revalidatePath('/caja');
    return exito(undefined, 'Pago registrado.');
  } catch (error) {
    return desdeError(error);
  }
}

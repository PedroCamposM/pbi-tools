'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requerirRol, ROLES_ALMACEN } from '@/lib/auth';
import { d, CERO, redondear } from '@/lib/money';
import { registrarMovimiento, reversarMovimientos } from '@/lib/inventario';
import { desdeError, exito, falla, type Resultado } from '@/lib/resultado';
import { sumarDias } from '@/lib/format';

const esquemaItem = z.object({
  productoId: z.number().int().positive(),
  cantidad: z.number().positive(),
  /** Costo unitario SIN IGV */
  costoUnitario: z.number().min(0),
  /** Nuevo precio de venta sugerido (opcional, 0 = no actualizar) */
  precioVenta: z.number().min(0).default(0),
});

const esquemaCompra = z.object({
  proveedorId: z.number().int().positive('Selecciona un proveedor'),
  almacenId: z.number().int().positive(),
  tipoComprobante: z.string().trim().default('FACTURA'),
  serie: z.string().trim().nullable().optional(),
  numero: z.string().trim().nullable().optional(),
  fecha: z.string().trim().nullable().optional(),
  condicionPago: z.enum(['CONTADO', 'CREDITO']),
  diasCredito: z.number().int().min(0).default(0),
  /** true = el costo ingresado ya incluye IGV */
  incluyeIgv: z.boolean().default(false),
  afectoIgv: z.boolean().default(true),
  observacion: z.string().trim().nullable().optional(),
  items: z.array(esquemaItem).min(1, 'Agrega al menos un producto'),
});

export type PayloadCompra = z.input<typeof esquemaCompra>;

/**
 * Registra una compra: valoriza el ingreso al kardex, recalcula el costo
 * promedio, actualiza precios de venta y genera la cuenta por pagar.
 */
export async function registrarCompra(
  payload: PayloadCompra,
): Promise<Resultado<{ compraId: number }>> {
  try {
    const usuario = await requerirRol(...ROLES_ALMACEN);
    const datos = esquemaCompra.parse(payload);

    const empresa = await db.empresa.findFirstOrThrow();
    const factorIgv = d(empresa.igvPorcentaje).dividedBy(100).plus(1);

    const compraId = await db.$transaction(async (tx) => {
      const fecha = datos.fecha ? new Date(`${datos.fecha}T12:00:00`) : new Date();

      const compra = await tx.compra.create({
        data: {
          proveedorId: datos.proveedorId,
          almacenId: datos.almacenId,
          usuarioId: usuario.id,
          tipoComprobante: datos.tipoComprobante,
          serie: datos.serie ?? null,
          numero: datos.numero ?? null,
          fecha,
          condicionPago: datos.condicionPago,
          fechaVencimiento:
            datos.condicionPago === 'CREDITO' ? sumarDias(fecha, datos.diasCredito) : null,
          moneda: empresa.moneda,
          observacion: datos.observacion ?? null,
          estado: 'RECIBIDA',
        },
      });

      let subtotal = CERO();

      for (const item of datos.items) {
        // Normalizamos el costo a valor SIN IGV, que es como se valoriza el kardex.
        const costoIngresado = d(item.costoUnitario);
        const costoSinIgv =
          datos.incluyeIgv && datos.afectoIgv
            ? costoIngresado.dividedBy(factorIgv).toDecimalPlaces(4)
            : costoIngresado;

        const cantidad = d(item.cantidad);
        const subtotalLinea = redondear(cantidad.times(costoSinIgv));

        await tx.compraDetalle.create({
          data: {
            compraId: compra.id,
            productoId: item.productoId,
            cantidad,
            costoUnitario: costoSinIgv,
            precioVenta: d(item.precioVenta),
            subtotal: subtotalLinea,
          },
        });

        await registrarMovimiento(tx, {
          productoId: item.productoId,
          almacenId: datos.almacenId,
          tipo: 'ENTRADA_COMPRA',
          cantidad,
          costoUnitario: costoSinIgv,
          referencia: `Compra ${datos.serie ?? ''}${datos.numero ? `-${datos.numero}` : ''}`.trim() || 'Compra',
          compraId: compra.id,
          usuarioId: usuario.id,
          fecha,
        });

        // Si el proveedor subio precios, actualizamos la lista de venta.
        if (item.precioVenta > 0) {
          await tx.producto.update({
            where: { id: item.productoId },
            data: { precioVenta: d(item.precioVenta) },
          });
        }

        subtotal = subtotal.plus(subtotalLinea);
      }

      const igv = datos.afectoIgv
        ? redondear(subtotal.times(d(empresa.igvPorcentaje)).dividedBy(100))
        : CERO();
      const total = redondear(subtotal.plus(igv));

      await tx.compra.update({
        where: { id: compra.id },
        data: { subtotal: redondear(subtotal), igv, total },
      });

      if (datos.condicionPago === 'CREDITO') {
        await tx.cuentaPorPagar.create({
          data: {
            proveedorId: datos.proveedorId,
            compraId: compra.id,
            fechaEmision: fecha,
            fechaVencimiento: sumarDias(fecha, datos.diasCredito),
            montoOriginal: total,
            saldo: total,
            estado: 'PENDIENTE',
          },
        });
      }

      return compra.id;
    });

    revalidatePath('/compras');
    revalidatePath('/inventario');
    revalidatePath('/cobranzas');

    return exito({ compraId }, 'Compra registrada e ingresada al inventario.');
  } catch (error) {
    return desdeError(error);
  }
}

export async function anularCompra(compraId: number, motivo: string): Promise<Resultado> {
  try {
    const usuario = await requerirRol(...ROLES_ALMACEN);

    const compra = await db.compra.findUniqueOrThrow({
      where: { id: compraId },
      include: { cuenta: { include: { pagos: true } } },
    });

    if (compra.estado === 'ANULADA') return falla('La compra ya está anulada.');
    if (compra.cuenta && compra.cuenta.pagos.length > 0) {
      return falla('La compra tiene pagos registrados. Anula primero los pagos al proveedor.');
    }

    await db.$transaction(async (tx) => {
      await reversarMovimientos(tx, { compraId }, `Anulación de compra #${compraId}`, usuario.id);

      if (compra.cuenta) {
        await tx.cuentaPorPagar.update({
          where: { id: compra.cuenta.id },
          data: { estado: 'ANULADA', saldo: 0 },
        });
      }

      await tx.compra.update({
        where: { id: compraId },
        data: { estado: 'ANULADA', observacion: `${compra.observacion ?? ''}\nAnulada: ${motivo}`.trim() },
      });
    });

    revalidatePath('/compras');
    revalidatePath('/inventario');
    return exito(undefined, 'Compra anulada y stock revertido.');
  } catch (error) {
    return desdeError(error);
  }
}

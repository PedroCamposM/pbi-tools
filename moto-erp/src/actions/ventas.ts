'use server';

import { revalidatePath } from 'next/cache';
import { Prisma, type AfectacionIgv, type MetodoPago, type TipoComprobante } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { d, CERO, redondear, num } from '@/lib/money';
import { registrarMovimiento, reversarMovimientos } from '@/lib/inventario';
import { siguienteCorrelativo } from '@/lib/correlativos';
import { numeroComprobante } from '@/lib/sunat/catalogos';
import { emitirYGuardar } from '@/lib/comprobantes';
import { desdeError, exito, falla, type Resultado } from '@/lib/resultado';
import { sumarDias } from '@/lib/format';

// ---------------------------------------------------------------------------
// Registro de venta (punto de venta)
// ---------------------------------------------------------------------------

const esquemaItem = z.object({
  productoId: z.number().int().positive(),
  cantidad: z.number().positive('La cantidad debe ser mayor a cero'),
  /** Precio unitario CON IGV, tal como se cotiza en mostrador. */
  precioUnitario: z.number().min(0),
  descuento: z.number().min(0).default(0),
  /**
   * Costo unitario ya conocido. Solo se usa cuando la salida de inventario
   * ocurrio antes (por ejemplo al facturar una orden de trabajo).
   */
  costoUnitario: z.number().min(0).nullable().optional(),
});

const esquemaPago = z.object({
  metodoPago: z.enum([
    'EFECTIVO',
    'YAPE',
    'PLIN',
    'TARJETA_DEBITO',
    'TARJETA_CREDITO',
    'TRANSFERENCIA',
  ]),
  monto: z.number().positive(),
  referencia: z.string().trim().nullable().optional(),
});

const esquemaVenta = z.object({
  tipoComprobante: z.enum(['FACTURA', 'BOLETA', 'NOTA_VENTA']),
  serie: z.string().trim().nullable().optional(),
  clienteId: z.number().int().positive('Selecciona un cliente'),
  tecnicoId: z.number().int().positive().nullable().optional(),
  almacenId: z.number().int().positive(),
  condicionPago: z.enum(['CONTADO', 'CREDITO']),
  diasCredito: z.number().int().min(0).default(0),
  observacion: z.string().trim().nullable().optional(),
  ordenTrabajoId: z.number().int().positive().nullable().optional(),
  items: z.array(esquemaItem).min(1, 'Agrega al menos un producto'),
  pagos: z.array(esquemaPago).default([]),
  /**
   * false cuando el inventario ya salio antes de facturar (orden de trabajo:
   * el repuesto se descuenta cuando el tecnico lo instala, no cuando se cobra).
   */
  descontarStock: z.boolean().default(true),
  /**
   * false al facturar una orden de trabajo: la comision del tecnico por ese
   * trabajo ya se genero sobre la mano de obra al cerrar la orden, y pagarla
   * otra vez sobre el comprobante seria contarla dos veces.
   */
  generarComisionVenta: z.boolean().default(true),
});

export type PayloadVenta = z.input<typeof esquemaVenta>;

export async function registrarVenta(
  payload: PayloadVenta,
): Promise<Resultado<{ ventaId: number; numero: string; estadoSunat: string }>> {
  try {
    const usuario = await requerirUsuario();
    const datos = esquemaVenta.parse(payload);

    const empresa = await db.empresa.findFirstOrThrow();
    const factorIgv = d(empresa.igvPorcentaje).dividedBy(100).plus(1);

    const cliente = await db.cliente.findUniqueOrThrow({ where: { id: datos.clienteId } });

    // La factura exige RUC del receptor.
    if (datos.tipoComprobante === 'FACTURA' && cliente.tipoDocumento !== 'RUC') {
      return falla('Para emitir una factura el cliente debe tener RUC.');
    }

    const montoPagado = datos.pagos.reduce((acc, p) => acc + p.monto, 0);

    // Cualquier cobro necesita una caja abierta: asi el arqueo cuadra.
    let cajaSesionId: number | null = null;
    if (datos.pagos.length > 0) {
      const caja = await db.cajaSesion.findFirst({
        where: { usuarioId: usuario.id, estado: 'ABIERTA' },
        orderBy: { id: 'desc' },
      });
      if (!caja) {
        return falla('No tienes una caja abierta. Abre caja antes de cobrar.');
      }
      cajaSesionId = caja.id;
    }

    const resultado = await db.$transaction(async (tx) => {
      const productos = await tx.producto.findMany({
        where: { id: { in: datos.items.map((i) => i.productoId) } },
      });
      const porId = new Map(productos.map((p) => [p.id, p]));

      // --- Calculo de la venta -------------------------------------------
      type LineaCalculada = {
        productoId: number;
        descripcion: string;
        unidadMedida: string;
        afectacionIgv: AfectacionIgv;
        cantidad: Prisma.Decimal;
        valorUnitario: Prisma.Decimal;
        descuento: Prisma.Decimal;
        valorVenta: Prisma.Decimal;
        igv: Prisma.Decimal;
        total: Prisma.Decimal;
        esServicio: boolean;
        costoConocido: Prisma.Decimal | null;
      };

      const lineas: LineaCalculada[] = [];
      let opGravadas = CERO();
      let opExoneradas = CERO();
      let opInafectas = CERO();
      let igvTotal = CERO();
      let total = CERO();
      let descuentoTotal = CERO();

      for (const item of datos.items) {
        const producto = porId.get(item.productoId);
        if (!producto) throw new Error(`El producto #${item.productoId} ya no existe.`);

        const cantidad = d(item.cantidad);
        const precioConIgv = d(item.precioUnitario);
        const descuento = d(item.descuento);

        const totalLinea = redondear(cantidad.times(precioConIgv).minus(descuento));
        if (totalLinea.lessThan(0)) {
          throw new Error(`El descuento de "${producto.nombre}" supera el importe de la línea.`);
        }

        const valorVenta =
          producto.afectacionIgv === 'GRAVADO'
            ? redondear(totalLinea.dividedBy(factorIgv))
            : totalLinea;
        const igvLinea = totalLinea.minus(valorVenta);

        lineas.push({
          productoId: producto.id,
          descripcion: `${producto.nombre}`,
          unidadMedida: producto.unidadMedida,
          afectacionIgv: producto.afectacionIgv,
          cantidad,
          valorUnitario: cantidad.greaterThan(0)
            ? valorVenta.dividedBy(cantidad).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
            : CERO(),
          descuento,
          valorVenta,
          igv: igvLinea,
          total: totalLinea,
          esServicio: producto.esServicio,
          costoConocido: item.costoUnitario != null ? d(item.costoUnitario) : null,
        });

        if (producto.afectacionIgv === 'GRAVADO') opGravadas = opGravadas.plus(valorVenta);
        else if (producto.afectacionIgv === 'EXONERADO') opExoneradas = opExoneradas.plus(valorVenta);
        else opInafectas = opInafectas.plus(valorVenta);

        igvTotal = igvTotal.plus(igvLinea);
        total = total.plus(totalLinea);
        descuentoTotal = descuentoTotal.plus(descuento);
      }

      // --- Validaciones de cobro -----------------------------------------
      if (datos.condicionPago === 'CONTADO' && d(montoPagado).lessThan(total)) {
        throw new Error(
          `El cobro (S/ ${montoPagado.toFixed(2)}) no cubre el total de la venta (S/ ${total.toFixed(2)}).`,
        );
      }

      const saldoCredito = total.minus(d(montoPagado));

      if (datos.condicionPago === 'CREDITO' && saldoCredito.greaterThan(0)) {
        const deudaActual = await tx.cuentaPorCobrar.aggregate({
          where: { clienteId: cliente.id, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
          _sum: { saldo: true },
        });
        const deudaTotal = d(deudaActual._sum.saldo ?? 0).plus(saldoCredito);

        if (d(cliente.lineaCredito).greaterThan(0) && deudaTotal.greaterThan(d(cliente.lineaCredito))) {
          throw new Error(
            `La operación supera la línea de crédito de ${cliente.nombre} (S/ ${d(cliente.lineaCredito).toFixed(2)}). Deuda resultante: S/ ${deudaTotal.toFixed(2)}.`,
          );
        }
        if (d(cliente.lineaCredito).isZero()) {
          throw new Error(`${cliente.nombre} no tiene línea de crédito asignada.`);
        }
      }

      // --- Correlativo ----------------------------------------------------
      const { serie, correlativo } = await siguienteCorrelativo(
        tx,
        datos.tipoComprobante as TipoComprobante,
        datos.serie ?? null,
      );
      const numero = numeroComprobante(serie, correlativo);

      const fecha = new Date();
      const diasCredito = datos.diasCredito || cliente.diasCredito || 0;

      const venta = await tx.venta.create({
        data: {
          tipoComprobante: datos.tipoComprobante as TipoComprobante,
          serie,
          correlativo,
          fecha,
          clienteId: cliente.id,
          usuarioId: usuario.id,
          almacenId: datos.almacenId,
          tecnicoId: datos.tecnicoId ?? null,
          condicionPago: datos.condicionPago,
          fechaVencimiento:
            datos.condicionPago === 'CREDITO' ? sumarDias(fecha, diasCredito) : null,
          moneda: empresa.moneda,
          opGravadas: redondear(opGravadas),
          opExoneradas: redondear(opExoneradas),
          opInafectas: redondear(opInafectas),
          descuentoTotal: redondear(descuentoTotal),
          igv: redondear(igvTotal),
          total: redondear(total),
          observacion: datos.observacion ?? null,
          ordenTrabajoId: datos.ordenTrabajoId ?? null,
        },
      });

      // --- Detalle + salida de inventario ---------------------------------
      let costoTotal = CERO();

      for (const linea of lineas) {
        let costoUnitario = linea.costoConocido ?? CERO();

        if (datos.descontarStock && !linea.esServicio) {
          const mov = await registrarMovimiento(tx, {
            productoId: linea.productoId,
            almacenId: datos.almacenId,
            tipo: 'SALIDA_VENTA',
            cantidad: linea.cantidad,
            referencia: `Venta ${numero}`,
            ventaId: venta.id,
            usuarioId: usuario.id,
          });
          costoUnitario = mov.costoUnitario;
        }

        costoTotal = costoTotal.plus(costoUnitario.times(linea.cantidad));

        await tx.ventaDetalle.create({
          data: {
            ventaId: venta.id,
            productoId: linea.productoId,
            descripcion: linea.descripcion,
            unidadMedida: linea.unidadMedida,
            cantidad: linea.cantidad,
            precioUnitario: linea.valorUnitario,
            descuento: linea.descuento,
            afectacionIgv: linea.afectacionIgv,
            valorVenta: linea.valorVenta,
            igv: linea.igv,
            total: linea.total,
            costoUnitario,
          },
        });
      }

      await tx.venta.update({
        where: { id: venta.id },
        data: { costoTotal: redondear(costoTotal) },
      });

      // --- Cobros ----------------------------------------------------------
      for (const pago of datos.pagos) {
        await tx.pagoVenta.create({
          data: {
            ventaId: venta.id,
            metodoPago: pago.metodoPago as MetodoPago,
            monto: d(pago.monto),
            referencia: pago.referencia ?? null,
            cajaSesionId,
          },
        });

        if (cajaSesionId) {
          await tx.movimientoCaja.create({
            data: {
              cajaSesionId,
              usuarioId: usuario.id,
              tipo: 'INGRESO',
              metodoPago: pago.metodoPago as MetodoPago,
              categoria: 'VENTA',
              concepto: `Venta ${numero} - ${cliente.nombre}`,
              monto: d(pago.monto),
              referencia: pago.referencia ?? numero,
            },
          });
        }
      }

      // --- Cuenta por cobrar -----------------------------------------------
      if (datos.condicionPago === 'CREDITO' && saldoCredito.greaterThan(0)) {
        await tx.cuentaPorCobrar.create({
          data: {
            clienteId: cliente.id,
            ventaId: venta.id,
            fechaEmision: fecha,
            fechaVencimiento: sumarDias(fecha, diasCredito),
            montoOriginal: redondear(total),
            saldo: redondear(saldoCredito),
            estado: d(montoPagado).greaterThan(0) ? 'PARCIAL' : 'PENDIENTE',
          },
        });
      }

      // --- Comision del tecnico ---------------------------------------------
      if (datos.tecnicoId && datos.generarComisionVenta) {
        const tecnico = await tx.tecnico.findUnique({ where: { id: datos.tecnicoId } });
        if (tecnico && d(tecnico.comisionVentaPct).greaterThan(0)) {
          const base = opGravadas.plus(opExoneradas).plus(opInafectas);
          const monto = redondear(base.times(d(tecnico.comisionVentaPct)).dividedBy(100));
          if (monto.greaterThan(0)) {
            await tx.comision.create({
              data: {
                tecnicoId: tecnico.id,
                tipo: 'VENTA',
                fecha,
                ventaId: venta.id,
                concepto: `Comisión por venta ${numero}`,
                baseCalculo: redondear(base),
                porcentaje: d(tecnico.comisionVentaPct),
                monto,
              },
            });
          }
        }
      }

      // --- Cierre de la orden de trabajo ------------------------------------
      if (datos.ordenTrabajoId) {
        await tx.ordenTrabajo.update({
          where: { id: datos.ordenTrabajoId },
          data: { estado: 'ENTREGADO', fechaEntrega: fecha },
        });
      }

      return { ventaId: venta.id, numero };
    });

    // El envio al proveedor de facturacion va fuera de la transaccion:
    // una demora de red no debe bloquear la base de datos.
    const cpe = await emitirYGuardar(resultado.ventaId);

    revalidatePath('/ventas');
    revalidatePath('/pos');
    revalidatePath('/caja');
    revalidatePath('/');

    return exito(
      { ventaId: resultado.ventaId, numero: resultado.numero, estadoSunat: cpe.estado },
      `Venta ${resultado.numero} registrada.`,
    );
  } catch (error) {
    return desdeError(error);
  }
}

// ---------------------------------------------------------------------------
// Anulacion / nota de credito
// ---------------------------------------------------------------------------

/**
 * Anula una venta.
 *  - Nota de venta (documento interno): se marca anulada y se repone el stock.
 *  - Comprobante electronico: se emite una nota de credito que lo deja sin
 *    efecto, se repone el stock y se cancela la cuenta por cobrar.
 */
export async function anularVenta(
  ventaId: number,
  motivoCodigo: string,
  motivo: string,
): Promise<Resultado<{ notaId: number | null }>> {
  try {
    const usuario = await requerirUsuario();

    if (!motivo.trim()) return falla('Indica el motivo de la anulación.');

    const original = await db.venta.findUniqueOrThrow({
      where: { id: ventaId },
      include: { detalles: true, pagos: true, cliente: true, cuenta: true },
    });

    if (original.estado === 'ANULADA') return falla('La venta ya está anulada.');
    if (original.tipoComprobante === 'NOTA_CREDITO' || original.tipoComprobante === 'NOTA_DEBITO') {
      return falla('No se puede anular una nota.');
    }

    const numeroOriginal = numeroComprobante(original.serie, original.correlativo);
    const esInterno = original.tipoComprobante === 'NOTA_VENTA';

    const notaId = await db.$transaction(async (tx) => {
      // Reponer el stock que salio con la venta.
      await reversarMovimientos(
        tx,
        { ventaId: original.id },
        `Anulación de ${numeroOriginal}`,
        usuario.id,
      );

      // Cancelar la cuenta por cobrar si la hubiera.
      if (original.cuenta) {
        await tx.cuentaPorCobrar.update({
          where: { id: original.cuenta.id },
          data: { estado: 'ANULADA', saldo: 0 },
        });
      }

      // Dejar sin efecto las comisiones aun no liquidadas.
      await tx.comision.updateMany({
        where: { ventaId: original.id, estado: 'PENDIENTE' },
        data: { estado: 'ANULADA' },
      });

      // Devolver el dinero cobrado por caja, si hay una caja abierta.
      const cobrado = original.pagos.reduce((acc, p) => acc.plus(d(p.monto)), CERO());
      if (cobrado.greaterThan(0)) {
        const caja = await tx.cajaSesion.findFirst({
          where: { usuarioId: usuario.id, estado: 'ABIERTA' },
          orderBy: { id: 'desc' },
        });
        if (caja) {
          await tx.movimientoCaja.create({
            data: {
              cajaSesionId: caja.id,
              usuarioId: usuario.id,
              tipo: 'EGRESO',
              metodoPago: original.pagos[0]?.metodoPago ?? 'EFECTIVO',
              categoria: 'DEVOLUCION',
              concepto: `Devolución por anulación de ${numeroOriginal}`,
              monto: cobrado,
              referencia: numeroOriginal,
            },
          });
        }
      }

      await tx.venta.update({
        where: { id: original.id },
        data: { estado: 'ANULADA', observacion: `${original.observacion ?? ''}\nAnulada: ${motivo}`.trim() },
      });

      // Si venia de una orden de trabajo, la orden vuelve a quedar pendiente
      // de facturar (los repuestos ya instalados no regresan al almacen).
      if (original.ordenTrabajoId) {
        await tx.venta.update({ where: { id: original.id }, data: { ordenTrabajoId: null } });
        await tx.ordenTrabajo.update({
          where: { id: original.ordenTrabajoId },
          data: { estado: 'TERMINADO', fechaEntrega: null },
        });
      }

      if (esInterno) return null;

      // Nota de credito que deja sin efecto el comprobante electronico.
      const { serie, correlativo } = await siguienteCorrelativo(tx, 'NOTA_CREDITO');

      const nota = await tx.venta.create({
        data: {
          tipoComprobante: 'NOTA_CREDITO',
          serie,
          correlativo,
          fecha: new Date(),
          clienteId: original.clienteId,
          usuarioId: usuario.id,
          almacenId: original.almacenId,
          condicionPago: 'CONTADO',
          moneda: original.moneda,
          opGravadas: original.opGravadas,
          opExoneradas: original.opExoneradas,
          opInafectas: original.opInafectas,
          descuentoTotal: original.descuentoTotal,
          igv: original.igv,
          total: original.total,
          costoTotal: original.costoTotal,
          documentoRefId: original.id,
          motivoNotaCodigo: motivoCodigo,
          motivoNota: motivo,
          observacion: `Anula ${numeroOriginal}`,
        },
      });

      for (const det of original.detalles) {
        await tx.ventaDetalle.create({
          data: {
            ventaId: nota.id,
            productoId: det.productoId,
            descripcion: det.descripcion,
            unidadMedida: det.unidadMedida,
            cantidad: det.cantidad,
            precioUnitario: det.precioUnitario,
            descuento: det.descuento,
            afectacionIgv: det.afectacionIgv,
            valorVenta: det.valorVenta,
            igv: det.igv,
            total: det.total,
            costoUnitario: det.costoUnitario,
          },
        });
      }

      return nota.id;
    });

    if (notaId) await emitirYGuardar(notaId);

    revalidatePath('/ventas');
    revalidatePath(`/ventas/${ventaId}`);
    revalidatePath('/cobranzas');

    return exito(
      { notaId },
      notaId ? 'Venta anulada. Se emitió la nota de crédito.' : 'Documento anulado.',
    );
  } catch (error) {
    return desdeError(error);
  }
}

/** Reintenta el envio del comprobante al proveedor de facturacion. */
export async function reenviarComprobante(ventaId: number): Promise<Resultado> {
  try {
    await requerirUsuario();
    const resultado = await emitirYGuardar(ventaId);
    revalidatePath(`/ventas/${ventaId}`);
    return exito(undefined, `Estado: ${resultado.estado}. ${resultado.mensaje ?? ''}`.trim());
  } catch (error) {
    return desdeError(error);
  }
}

// ---------------------------------------------------------------------------
// Consultas de apoyo para el POS
// ---------------------------------------------------------------------------

export async function obtenerSaldoCliente(clienteId: number): Promise<number> {
  await requerirUsuario();
  const agregado = await db.cuentaPorCobrar.aggregate({
    where: { clienteId, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
    _sum: { saldo: true },
  });
  return num(agregado._sum.saldo ?? 0);
}

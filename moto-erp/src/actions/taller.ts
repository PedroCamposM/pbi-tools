'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { d, CERO, redondear } from '@/lib/money';
import { registrarMovimiento, reversarMovimientos } from '@/lib/inventario';
import { numeroOrdenTrabajo } from '@/lib/correlativos';
import { desdeError, exito, falla, type Resultado } from '@/lib/resultado';
import { desdeInputFecha } from '@/lib/format';
import { idOpcional, numeroForm, textoOpcional } from '@/lib/validadores';

// ---------------------------------------------------------------------------
// Apertura de la orden de trabajo
// ---------------------------------------------------------------------------

export async function crearOrdenTrabajo(
  _estado: Resultado<{ id: number; numero: string }> | null,
  formData: FormData,
): Promise<Resultado<{ id: number; numero: string }>> {
  try {
    const usuario = await requerirUsuario();

    const datos = z
      .object({
        clienteId: z.coerce.number().int().positive('Selecciona el cliente'),
        motoId: idOpcional,
        tecnicoId: idOpcional,
        almacenId: z.coerce.number().int().positive(),
        kilometraje: z.preprocess(
          (v) => (v === '' || v === null ? null : Number(v)),
          z.number().int().nullable(),
        ),
        motivoIngreso: z.string().trim().min(3, 'Describe el motivo del ingreso'),
        fechaPrometida: textoOpcional,
        observacion: textoOpcional,
      })
      .parse({
        clienteId: formData.get('clienteId'),
        motoId: formData.get('motoId'),
        tecnicoId: formData.get('tecnicoId'),
        almacenId: formData.get('almacenId'),
        kilometraje: formData.get('kilometraje'),
        motivoIngreso: formData.get('motivoIngreso'),
        fechaPrometida: formData.get('fechaPrometida'),
        observacion: formData.get('observacion'),
      });

    const orden = await db.$transaction(async (tx) => {
      // Se crea con un numero temporal y luego se fija el definitivo con el id,
      // asi dos recepciones simultaneas nunca chocan.
      const creada = await tx.ordenTrabajo.create({
        data: {
          numero: `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          clienteId: datos.clienteId,
          motoId: datos.motoId,
          tecnicoId: datos.tecnicoId,
          almacenId: datos.almacenId,
          usuarioId: usuario.id,
          kilometraje: datos.kilometraje,
          motivoIngreso: datos.motivoIngreso,
          fechaPrometida: desdeInputFecha(datos.fechaPrometida ?? null),
          observacion: datos.observacion ?? null,
          estado: 'RECEPCION',
        },
      });

      return tx.ordenTrabajo.update({
        where: { id: creada.id },
        data: { numero: numeroOrdenTrabajo(creada.id) },
      });
    });

    revalidatePath('/taller');
    return exito({ id: orden.id, numero: orden.numero }, `Orden ${orden.numero} creada.`);
  } catch (error) {
    return desdeError(error);
  }
}

export async function actualizarOrdenTrabajo(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    await requerirUsuario();
    const id = Number(formData.get('id'));

    const datos = z
      .object({
        tecnicoId: idOpcional,
        estado: z.enum([
          'RECEPCION',
          'DIAGNOSTICO',
          'EN_PROCESO',
          'ESPERANDO_REPUESTOS',
          'TERMINADO',
          'ENTREGADO',
        ]),
        diagnostico: textoOpcional,
        trabajoRealizado: textoOpcional,
        observacion: textoOpcional,
      })
      .parse({
        tecnicoId: formData.get('tecnicoId'),
        estado: formData.get('estado'),
        diagnostico: formData.get('diagnostico'),
        trabajoRealizado: formData.get('trabajoRealizado'),
        observacion: formData.get('observacion'),
      });

    await db.ordenTrabajo.update({
      where: { id },
      data: {
        ...datos,
        fechaEntrega: datos.estado === 'ENTREGADO' ? new Date() : undefined,
      },
    });

    revalidatePath(`/taller/${id}`);
    revalidatePath('/taller');
    return exito(undefined, 'Orden actualizada.');
  } catch (error) {
    return desdeError(error);
  }
}

// ---------------------------------------------------------------------------
// Repuestos consumidos
// ---------------------------------------------------------------------------

/**
 * Agrega un repuesto a la orden y descuenta el stock del almacen del taller
 * en el mismo acto: el repuesto sale del inventario cuando el tecnico lo toma.
 */
export async function agregarRepuestoOrden(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    const usuario = await requerirUsuario();

    const datos = z
      .object({
        ordenTrabajoId: z.coerce.number().int().positive(),
        productoId: z.coerce.number().int().positive('Selecciona el repuesto'),
        cantidad: numeroForm(1),
        precioUnitario: numeroForm(0),
      })
      .parse({
        ordenTrabajoId: formData.get('ordenTrabajoId'),
        productoId: formData.get('productoId'),
        cantidad: formData.get('cantidad'),
        precioUnitario: formData.get('precioUnitario'),
      });

    if (datos.cantidad <= 0) return falla('La cantidad debe ser mayor a cero.');

    const orden = await db.ordenTrabajo.findUniqueOrThrow({
      where: { id: datos.ordenTrabajoId },
    });
    if (orden.estado === 'ENTREGADO' || orden.estado === 'ANULADO') {
      return falla('La orden ya fue cerrada; no se pueden agregar repuestos.');
    }

    await db.$transaction(async (tx) => {
      const producto = await tx.producto.findUniqueOrThrow({ where: { id: datos.productoId } });

      const precio = datos.precioUnitario > 0 ? d(datos.precioUnitario) : d(producto.precioVenta);
      const subtotal = redondear(d(datos.cantidad).times(precio));

      let costoUnitario = d(producto.costoPromedio);

      if (!producto.esServicio) {
        const mov = await registrarMovimiento(tx, {
          productoId: datos.productoId,
          almacenId: orden.almacenId,
          tipo: 'SALIDA_TALLER',
          cantidad: datos.cantidad,
          referencia: `Orden ${orden.numero}`,
          ordenTrabajoId: orden.id,
          usuarioId: usuario.id,
        });
        costoUnitario = mov.costoUnitario;
      }

      await tx.ordenTrabajoRepuesto.create({
        data: {
          ordenTrabajoId: orden.id,
          productoId: datos.productoId,
          cantidad: d(datos.cantidad),
          precioUnitario: precio,
          subtotal,
          costoUnitario,
          descontado: !producto.esServicio,
        },
      });

      await recalcularTotalesOrden(tx, orden.id);
    });

    revalidatePath(`/taller/${datos.ordenTrabajoId}`);
    return exito(undefined, 'Repuesto agregado y descontado del stock.');
  } catch (error) {
    return desdeError(error);
  }
}

export async function quitarRepuestoOrden(repuestoId: number): Promise<Resultado> {
  try {
    const usuario = await requerirUsuario();

    const repuesto = await db.ordenTrabajoRepuesto.findUniqueOrThrow({
      where: { id: repuestoId },
      include: { ordenTrabajo: true },
    });

    if (repuesto.ordenTrabajo.estado === 'ENTREGADO') {
      return falla('La orden ya fue entregada y facturada.');
    }

    await db.$transaction(async (tx) => {
      // Devolvemos el repuesto al almacen.
      if (repuesto.descontado) {
        await registrarMovimiento(tx, {
          productoId: repuesto.productoId,
          almacenId: repuesto.ordenTrabajo.almacenId,
          tipo: 'ENTRADA_AJUSTE',
          cantidad: repuesto.cantidad,
          costoUnitario: repuesto.costoUnitario,
          referencia: `Devolución orden ${repuesto.ordenTrabajo.numero}`,
          ordenTrabajoId: repuesto.ordenTrabajoId,
          usuarioId: usuario.id,
          nota: 'Repuesto retirado de la orden de trabajo',
        });
      }

      await tx.ordenTrabajoRepuesto.delete({ where: { id: repuestoId } });
      await recalcularTotalesOrden(tx, repuesto.ordenTrabajoId);
    });

    revalidatePath(`/taller/${repuesto.ordenTrabajoId}`);
    return exito(undefined, 'Repuesto retirado y devuelto al stock.');
  } catch (error) {
    return desdeError(error);
  }
}

// ---------------------------------------------------------------------------
// Mano de obra
// ---------------------------------------------------------------------------

export async function agregarServicioOrden(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    await requerirUsuario();

    const datos = z
      .object({
        ordenTrabajoId: z.coerce.number().int().positive(),
        productoId: idOpcional,
        descripcion: z.string().trim().min(3, 'Describe el servicio'),
        cantidad: numeroForm(1),
        precioUnitario: numeroForm(0),
        tecnicoId: idOpcional,
      })
      .parse({
        ordenTrabajoId: formData.get('ordenTrabajoId'),
        productoId: formData.get('productoId'),
        descripcion: formData.get('descripcion'),
        cantidad: formData.get('cantidad'),
        precioUnitario: formData.get('precioUnitario'),
        tecnicoId: formData.get('tecnicoId'),
      });

    if (datos.precioUnitario <= 0) return falla('Indica el precio de la mano de obra.');

    await db.$transaction(async (tx) => {
      await tx.ordenTrabajoServicio.create({
        data: {
          ordenTrabajoId: datos.ordenTrabajoId,
          productoId: datos.productoId,
          descripcion: datos.descripcion,
          cantidad: d(datos.cantidad),
          precioUnitario: d(datos.precioUnitario),
          subtotal: redondear(d(datos.cantidad).times(d(datos.precioUnitario))),
          tecnicoId: datos.tecnicoId,
        },
      });

      await recalcularTotalesOrden(tx, datos.ordenTrabajoId);
    });

    revalidatePath(`/taller/${datos.ordenTrabajoId}`);
    return exito(undefined, 'Servicio agregado.');
  } catch (error) {
    return desdeError(error);
  }
}

export async function quitarServicioOrden(servicioId: number): Promise<Resultado> {
  try {
    await requerirUsuario();
    const servicio = await db.ordenTrabajoServicio.findUniqueOrThrow({ where: { id: servicioId } });

    await db.$transaction(async (tx) => {
      await tx.ordenTrabajoServicio.delete({ where: { id: servicioId } });
      await recalcularTotalesOrden(tx, servicio.ordenTrabajoId);
    });

    revalidatePath(`/taller/${servicio.ordenTrabajoId}`);
    return exito(undefined, 'Servicio retirado.');
  } catch (error) {
    return desdeError(error);
  }
}

// ---------------------------------------------------------------------------
// Cierre y comision del tecnico
// ---------------------------------------------------------------------------

type TxOrden = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function recalcularTotalesOrden(tx: TxOrden, ordenId: number): Promise<void> {
  const [repuestos, servicios] = await Promise.all([
    tx.ordenTrabajoRepuesto.findMany({ where: { ordenTrabajoId: ordenId } }),
    tx.ordenTrabajoServicio.findMany({ where: { ordenTrabajoId: ordenId } }),
  ]);

  const totalRepuestos = repuestos.reduce((acc, r) => acc.plus(d(r.subtotal)), CERO());
  const totalServicios = servicios.reduce((acc, s) => acc.plus(d(s.subtotal)), CERO());

  await tx.ordenTrabajo.update({
    where: { id: ordenId },
    data: {
      totalRepuestos: redondear(totalRepuestos),
      totalServicios: redondear(totalServicios),
      total: redondear(totalRepuestos.plus(totalServicios)),
    },
  });
}

/**
 * Marca la orden como terminada y genera la comision del tecnico sobre la
 * mano de obra ejecutada.
 */
export async function terminarOrdenTrabajo(ordenId: number): Promise<Resultado> {
  try {
    await requerirUsuario();

    const orden = await db.ordenTrabajo.findUniqueOrThrow({
      where: { id: ordenId },
      include: { servicios: true, tecnico: true, comisiones: true },
    });

    if (orden.estado === 'ANULADO') return falla('La orden está anulada.');
    if (orden.total.equals(0)) return falla('Registra repuestos o mano de obra antes de cerrar.');

    await db.$transaction(async (tx) => {
      await tx.ordenTrabajo.update({ where: { id: ordenId }, data: { estado: 'TERMINADO' } });

      // La comision se calcula sobre la mano de obra de cada tecnico que
      // participo; si el servicio no tiene tecnico asignado, se le atribuye
      // al tecnico responsable de la orden.
      if (orden.comisiones.length > 0) return;

      const porTecnico = new Map<number, ReturnType<typeof CERO>>();

      for (const servicio of orden.servicios) {
        const tecnicoId = servicio.tecnicoId ?? orden.tecnicoId;
        if (!tecnicoId) continue;
        porTecnico.set(tecnicoId, (porTecnico.get(tecnicoId) ?? CERO()).plus(d(servicio.subtotal)));
      }

      for (const [tecnicoId, base] of porTecnico) {
        const tecnico = await tx.tecnico.findUnique({ where: { id: tecnicoId } });
        if (!tecnico || d(tecnico.comisionServicioPct).lessThanOrEqualTo(0)) continue;

        const monto = redondear(base.times(d(tecnico.comisionServicioPct)).dividedBy(100));
        if (monto.lessThanOrEqualTo(0)) continue;

        await tx.comision.create({
          data: {
            tecnicoId,
            tipo: 'SERVICIO',
            ordenTrabajoId: ordenId,
            concepto: `Mano de obra orden ${orden.numero}`,
            baseCalculo: redondear(base),
            porcentaje: d(tecnico.comisionServicioPct),
            monto,
          },
        });
      }
    });

    revalidatePath(`/taller/${ordenId}`);
    revalidatePath('/taller');
    revalidatePath('/tecnicos');
    return exito(undefined, 'Orden terminada. Lista para facturar.');
  } catch (error) {
    return desdeError(error);
  }
}

/**
 * Convierte la orden terminada en comprobante de venta.
 *
 * Los repuestos ya salieron del almacen cuando el tecnico los instalo, por eso
 * la venta se registra con `descontarStock: false` y con el costo real que
 * quedo grabado en la orden. Asi la utilidad del trabajo sale exacta y el
 * kardex no se descuenta dos veces.
 */
export async function facturarOrdenTrabajo(
  ordenId: number,
  opciones: {
    tipoComprobante: 'FACTURA' | 'BOLETA' | 'NOTA_VENTA';
    condicionPago: 'CONTADO' | 'CREDITO';
    diasCredito?: number;
    pagos: { metodoPago: string; monto: number; referencia?: string | null }[];
  },
): Promise<Resultado<{ ventaId: number; numero: string }>> {
  try {
    await requerirUsuario();

    const orden = await db.ordenTrabajo.findUniqueOrThrow({
      where: { id: ordenId },
      include: {
        repuestos: { include: { producto: true } },
        servicios: { include: { producto: true } },
        venta: true,
      },
    });

    if (orden.venta) return falla('Esta orden ya fue facturada.');
    if (orden.estado === 'ANULADO') return falla('La orden está anulada.');
    if (orden.estado !== 'TERMINADO') {
      return falla('Marca la orden como terminada antes de facturarla.');
    }

    const items = [
      ...orden.repuestos.map((r) => ({
        productoId: r.productoId,
        cantidad: Number(r.cantidad),
        precioUnitario: Number(r.precioUnitario),
        descuento: 0,
        costoUnitario: Number(r.costoUnitario),
      })),
      ...orden.servicios
        .filter((s) => s.productoId !== null)
        .map((s) => ({
          productoId: s.productoId as number,
          cantidad: Number(s.cantidad),
          precioUnitario: Number(s.precioUnitario),
          descuento: 0,
          costoUnitario: 0,
        })),
    ];

    const sinProducto = orden.servicios.filter((s) => s.productoId === null);
    if (sinProducto.length > 0) {
      return falla(
        `Los servicios "${sinProducto.map((s) => s.descripcion).join(', ')}" no tienen un producto de mano de obra asociado. Edítalos y selecciona uno para poder facturar.`,
      );
    }

    if (items.length === 0) return falla('La orden no tiene repuestos ni servicios.');

    const { registrarVenta } = await import('./ventas');

    const resultado = await registrarVenta({
      tipoComprobante: opciones.tipoComprobante,
      clienteId: orden.clienteId,
      tecnicoId: orden.tecnicoId,
      almacenId: orden.almacenId,
      condicionPago: opciones.condicionPago,
      diasCredito: opciones.diasCredito ?? 0,
      ordenTrabajoId: orden.id,
      observacion: `Orden de trabajo ${orden.numero}`,
      items,
      pagos: opciones.pagos as never,
      descontarStock: false,
      generarComisionVenta: false,
    });

    if (!resultado.ok) return resultado;

    revalidatePath(`/taller/${ordenId}`);
    revalidatePath('/taller');
    revalidatePath('/ventas');

    return exito(
      { ventaId: resultado.datos!.ventaId, numero: resultado.datos!.numero },
      `Orden facturada con ${resultado.datos!.numero}.`,
    );
  } catch (error) {
    return desdeError(error);
  }
}

export async function anularOrdenTrabajo(ordenId: number, motivo: string): Promise<Resultado> {
  try {
    const usuario = await requerirUsuario();

    const orden = await db.ordenTrabajo.findUniqueOrThrow({
      where: { id: ordenId },
      include: { venta: true },
    });

    if (orden.venta) return falla('La orden ya fue facturada. Anula primero la venta.');
    if (orden.estado === 'ANULADO') return falla('La orden ya está anulada.');

    await db.$transaction(async (tx) => {
      await reversarMovimientos(
        tx,
        { ordenTrabajoId: ordenId },
        `Anulación orden ${orden.numero}`,
        usuario.id,
      );

      await tx.comision.updateMany({
        where: { ordenTrabajoId: ordenId, estado: 'PENDIENTE' },
        data: { estado: 'ANULADA' },
      });

      await tx.ordenTrabajo.update({
        where: { id: ordenId },
        data: {
          estado: 'ANULADO',
          observacion: `${orden.observacion ?? ''}\nAnulada: ${motivo}`.trim(),
        },
      });
    });

    revalidatePath('/taller');
    return exito(undefined, 'Orden anulada y repuestos devueltos al stock.');
  } catch (error) {
    return desdeError(error);
  }
}

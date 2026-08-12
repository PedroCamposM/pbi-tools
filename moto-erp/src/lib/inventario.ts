import 'server-only';
import { Prisma, type TipoMovimientoInventario } from '@prisma/client';
import { d, CERO } from './money';

export type Tx = Prisma.TransactionClient;

const TIPOS_ENTRADA: TipoMovimientoInventario[] = [
  'INVENTARIO_INICIAL',
  'ENTRADA_COMPRA',
  'ENTRADA_AJUSTE',
  'ENTRADA_DEVOLUCION_CLIENTE',
  'ENTRADA_TRANSFERENCIA',
];

export function esEntrada(tipo: TipoMovimientoInventario): boolean {
  return TIPOS_ENTRADA.includes(tipo);
}

export class StockInsuficienteError extends Error {
  constructor(
    public readonly producto: string,
    public readonly disponible: Prisma.Decimal,
    public readonly solicitado: Prisma.Decimal,
  ) {
    super(
      `Stock insuficiente de "${producto}". Disponible: ${disponible.toFixed(2)}, solicitado: ${solicitado.toFixed(2)}.`,
    );
    this.name = 'StockInsuficienteError';
  }
}

type ParametrosMovimiento = {
  productoId: number;
  almacenId: number;
  tipo: TipoMovimientoInventario;
  /** Siempre positiva; el tipo define el signo. */
  cantidad: Prisma.Decimal | number | string;
  /** Solo para entradas. En las salidas se usa el costo promedio vigente. */
  costoUnitario?: Prisma.Decimal | number | string | null;
  referencia?: string | null;
  ventaId?: number | null;
  compraId?: number | null;
  ordenTrabajoId?: number | null;
  usuarioId?: number | null;
  nota?: string | null;
  fecha?: Date;
  /** Permite dejar el saldo en negativo (por ejemplo en un ajuste forzado). */
  permitirNegativo?: boolean;
};

export type ResultadoMovimiento = {
  costoUnitario: Prisma.Decimal;
  saldoCantidad: Prisma.Decimal;
  saldoCosto: Prisma.Decimal;
};

/**
 * Registra un movimiento en el kardex valorizado con costo promedio ponderado
 * y deja el stock del almacen consistente.
 *
 * Debe ejecutarse siempre dentro de una transaccion.
 */
export async function registrarMovimiento(
  tx: Tx,
  p: ParametrosMovimiento,
): Promise<ResultadoMovimiento> {
  const cantidad = d(p.cantidad);
  if (cantidad.lessThanOrEqualTo(0)) {
    throw new Error('La cantidad del movimiento debe ser mayor a cero.');
  }

  const producto = await tx.producto.findUniqueOrThrow({
    where: { id: p.productoId },
    select: { id: true, nombre: true, sku: true, esServicio: true, costoPromedio: true },
  });

  // Los servicios (mano de obra) no mueven inventario.
  if (producto.esServicio) {
    return { costoUnitario: d(producto.costoPromedio), saldoCantidad: CERO(), saldoCosto: CERO() };
  }

  const stock =
    (await tx.stock.findUnique({
      where: { productoId_almacenId: { productoId: p.productoId, almacenId: p.almacenId } },
    })) ??
    (await tx.stock.create({
      data: { productoId: p.productoId, almacenId: p.almacenId, cantidad: 0, costoPromedio: 0 },
    }));

  const saldoAnterior = d(stock.cantidad);
  const costoAnterior = d(stock.costoPromedio);

  let nuevoSaldo: Prisma.Decimal;
  let nuevoCosto: Prisma.Decimal;
  let costoMovimiento: Prisma.Decimal;

  if (esEntrada(p.tipo)) {
    // Si no viene costo (transferencias, devoluciones), se conserva el vigente.
    costoMovimiento = p.costoUnitario != null ? d(p.costoUnitario) : costoAnterior;
    nuevoSaldo = saldoAnterior.plus(cantidad);

    const valorAnterior = saldoAnterior.times(costoAnterior);
    const valorIngreso = cantidad.times(costoMovimiento);
    nuevoCosto = nuevoSaldo.greaterThan(0)
      ? valorAnterior.plus(valorIngreso).dividedBy(nuevoSaldo)
      : costoMovimiento;
  } else {
    costoMovimiento = costoAnterior;
    nuevoSaldo = saldoAnterior.minus(cantidad);

    if (nuevoSaldo.lessThan(0) && !p.permitirNegativo) {
      throw new StockInsuficienteError(
        `${producto.sku} - ${producto.nombre}`,
        saldoAnterior,
        cantidad,
      );
    }
    // El costo promedio no cambia con una salida.
    nuevoCosto = costoAnterior;
  }

  nuevoCosto = nuevoCosto.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

  await tx.stock.update({
    where: { productoId_almacenId: { productoId: p.productoId, almacenId: p.almacenId } },
    data: { cantidad: nuevoSaldo, costoPromedio: nuevoCosto },
  });

  await tx.movimientoInventario.create({
    data: {
      fecha: p.fecha ?? new Date(),
      productoId: p.productoId,
      almacenId: p.almacenId,
      tipo: p.tipo,
      cantidad,
      costoUnitario: costoMovimiento.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP),
      saldoCantidad: nuevoSaldo,
      saldoCosto: nuevoCosto,
      referencia: p.referencia ?? null,
      ventaId: p.ventaId ?? null,
      compraId: p.compraId ?? null,
      ordenTrabajoId: p.ordenTrabajoId ?? null,
      usuarioId: p.usuarioId ?? null,
      nota: p.nota ?? null,
    },
  });

  await recalcularCostoProducto(tx, p.productoId, p.tipo === 'ENTRADA_COMPRA' ? costoMovimiento : null);

  return {
    costoUnitario: costoMovimiento,
    saldoCantidad: nuevoSaldo,
    saldoCosto: nuevoCosto,
  };
}

/**
 * Recalcula el costo promedio global del producto (ponderado entre almacenes),
 * que es el que se usa para valorizar el inventario y calcular la utilidad.
 */
async function recalcularCostoProducto(
  tx: Tx,
  productoId: number,
  ultimoCostoCompra: Prisma.Decimal | null,
): Promise<void> {
  const stocks = await tx.stock.findMany({ where: { productoId } });

  let unidades = CERO();
  let valor = CERO();
  for (const s of stocks) {
    unidades = unidades.plus(d(s.cantidad));
    valor = valor.plus(d(s.cantidad).times(d(s.costoPromedio)));
  }

  const datos: Prisma.ProductoUpdateInput = {};
  if (unidades.greaterThan(0)) {
    datos.costoPromedio = valor.dividedBy(unidades).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  }
  if (ultimoCostoCompra) {
    datos.ultimoCosto = ultimoCostoCompra.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  }

  if (Object.keys(datos).length > 0) {
    await tx.producto.update({ where: { id: productoId }, data: datos });
  }
}

/** Stock disponible de un producto en un almacen. */
export async function stockDisponible(
  tx: Tx,
  productoId: number,
  almacenId: number,
): Promise<Prisma.Decimal> {
  const stock = await tx.stock.findUnique({
    where: { productoId_almacenId: { productoId, almacenId } },
  });
  return d(stock?.cantidad ?? 0);
}

/**
 * Revierte los movimientos generados por un documento (usado al anular una
 * venta, una compra o una orden de trabajo).
 */
export async function reversarMovimientos(
  tx: Tx,
  filtro: { ventaId?: number; compraId?: number; ordenTrabajoId?: number },
  referencia: string,
  usuarioId: number,
): Promise<void> {
  const movimientos = await tx.movimientoInventario.findMany({
    where: filtro,
    orderBy: { id: 'desc' },
  });

  for (const mov of movimientos) {
    const contrario: TipoMovimientoInventario = esEntrada(mov.tipo)
      ? 'SALIDA_AJUSTE'
      : 'ENTRADA_AJUSTE';

    await registrarMovimiento(tx, {
      productoId: mov.productoId,
      almacenId: mov.almacenId,
      tipo: contrario,
      cantidad: mov.cantidad,
      costoUnitario: mov.costoUnitario,
      referencia,
      usuarioId,
      nota: `Reversion del movimiento #${mov.id}`,
      // Al anular una compra ya consumida el saldo puede quedar negativo;
      // preferimos reflejarlo antes que bloquear la anulacion.
      permitirNegativo: true,
    });
  }
}

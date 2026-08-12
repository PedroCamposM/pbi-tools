import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles, num, cantidad as fmtCantidad } from '@/lib/money';
import { inicioDia, finDia, fecha as fmtFecha, etiqueta } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { colorEstado } from '@/lib/estados';
import { numeroComprobante } from '@/lib/sunat/catalogos';

export const dynamic = 'force-dynamic';

function Kpi({
  titulo,
  valor,
  detalle,
  href,
  acento = 'slate',
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  href?: string;
  acento?: 'slate' | 'verde' | 'ambar' | 'rojo' | 'azul';
}) {
  const bordes = {
    slate: 'border-l-slate-400',
    verde: 'border-l-emerald-500',
    ambar: 'border-l-amber-500',
    rojo: 'border-l-red-500',
    azul: 'border-l-marca-500',
  };

  const cuerpo = (
    <div className={`tarjeta border-l-4 ${bordes[acento]} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-slate-500">{detalle}</p>}
    </div>
  );

  return href ? (
    <Link href={href} className="block transition hover:opacity-80">
      {cuerpo}
    </Link>
  ) : (
    cuerpo
  );
}

export default async function Tablero() {
  await requerirUsuario();

  const hoy = new Date();
  const desdeHoy = inicioDia(hoy);
  const hastaHoy = finDia(hoy);
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const [
    ventasHoy,
    ventasMes,
    ordenesAbiertas,
    cuentasPorCobrar,
    cuentasVencidas,
    ultimasVentas,
    productosBajoStock,
    masVendidos,
  ] = await Promise.all([
    db.venta.aggregate({
      where: {
        estado: 'EMITIDA',
        tipoComprobante: { notIn: ['NOTA_CREDITO', 'NOTA_DEBITO'] },
        fecha: { gte: desdeHoy, lte: hastaHoy },
      },
      _sum: { total: true, costoTotal: true },
      _count: true,
    }),
    db.venta.aggregate({
      where: {
        estado: 'EMITIDA',
        tipoComprobante: { notIn: ['NOTA_CREDITO', 'NOTA_DEBITO'] },
        fecha: { gte: inicioMes, lte: hastaHoy },
      },
      _sum: { total: true, costoTotal: true },
      _count: true,
    }),
    db.ordenTrabajo.count({
      where: { estado: { notIn: ['ENTREGADO', 'ANULADO'] } },
    }),
    db.cuentaPorCobrar.aggregate({
      where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      _sum: { saldo: true },
    }),
    db.cuentaPorCobrar.count({
      where: { estado: { in: ['PENDIENTE', 'PARCIAL'] }, fechaVencimiento: { lt: desdeHoy } },
    }),
    db.venta.findMany({
      where: { estado: 'EMITIDA' },
      include: { cliente: true, comprobante: true },
      orderBy: { id: 'desc' },
      take: 8,
    }),
    db.$queryRaw<
      { id: number; sku: string; nombre: string; stock: number; minimo: number }[]
    >`
      SELECT p.id, p.sku, p.nombre,
             COALESCE(SUM(s.cantidad), 0)::float AS stock,
             p."stockMinimo"::float AS minimo
      FROM producto p
      LEFT JOIN stock s ON s."productoId" = p.id
      WHERE p.activo = true AND p."esServicio" = false AND p."stockMinimo" > 0
      GROUP BY p.id, p.sku, p.nombre, p."stockMinimo"
      HAVING COALESCE(SUM(s.cantidad), 0) <= p."stockMinimo"
      ORDER BY (COALESCE(SUM(s.cantidad), 0) - p."stockMinimo") ASC
      LIMIT 8
    `,
    db.ventaDetalle.groupBy({
      by: ['productoId'],
      where: { venta: { estado: 'EMITIDA', fecha: { gte: inicioMes } } },
      _sum: { cantidad: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 6,
    }),
  ]);

  const productosTop = await db.producto.findMany({
    where: { id: { in: masVendidos.map((m) => m.productoId) } },
    select: { id: true, sku: true, nombre: true },
  });
  const nombrePorId = new Map(productosTop.map((p) => [p.id, p]));

  const utilidadMes = num(ventasMes._sum.total ?? 0) - num(ventasMes._sum.costoTotal ?? 0);
  const utilidadHoy = num(ventasHoy._sum.total ?? 0) - num(ventasHoy._sum.costoTotal ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Tablero</h1>
          <p className="text-sm text-slate-500">{fmtFecha(hoy)}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/pos" className="boton-primario">
            Nueva venta
          </Link>
          <Link href="/taller/nueva" className="boton-secundario">
            Recibir moto
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          titulo="Ventas de hoy"
          valor={soles(ventasHoy._sum.total ?? 0)}
          detalle={`${ventasHoy._count} comprobantes · utilidad ${soles(utilidadHoy)}`}
          href="/ventas"
          acento="verde"
        />
        <Kpi
          titulo="Ventas del mes"
          valor={soles(ventasMes._sum.total ?? 0)}
          detalle={`${ventasMes._count} comprobantes · utilidad ${soles(utilidadMes)}`}
          href="/reportes"
          acento="azul"
        />
        <Kpi
          titulo="Órdenes en taller"
          valor={String(ordenesAbiertas)}
          detalle="Motos pendientes de entrega"
          href="/taller"
          acento="ambar"
        />
        <Kpi
          titulo="Por cobrar"
          valor={soles(cuentasPorCobrar._sum.saldo ?? 0)}
          detalle={
            cuentasVencidas > 0 ? `${cuentasVencidas} cuentas vencidas` : 'Sin cuentas vencidas'
          }
          href="/cobranzas"
          acento={cuentasVencidas > 0 ? 'rojo' : 'slate'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="tarjeta xl:col-span-2">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Últimos comprobantes</h2>
            <Link href="/ventas" className="text-xs font-semibold text-marca-600 hover:underline">
              Ver todos
            </Link>
          </header>

          {ultimasVentas.length === 0 ? (
            <SinDatos mensaje="Todavía no se registran ventas." />
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th className="text-right">Total</th>
                    <th>SUNAT</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasVentas.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <Link
                          href={`/ventas/${v.id}`}
                          className="font-mono text-xs font-semibold text-marca-700 hover:underline"
                        >
                          {numeroComprobante(v.serie, v.correlativo)}
                        </Link>
                        <p className="text-[11px] text-slate-500">{etiqueta(v.tipoComprobante)}</p>
                      </td>
                      <td className="max-w-[220px] truncate">{v.cliente.nombre}</td>
                      <td className="whitespace-nowrap text-xs text-slate-600">
                        {fmtFecha(v.fecha)}
                      </td>
                      <td className="text-right font-semibold">{soles(v.total)}</td>
                      <td>
                        <Insignia color={colorEstado(v.comprobante?.estado ?? 'NO_APLICA')}>
                          {etiqueta(v.comprobante?.estado ?? 'NO_APLICA')}
                        </Insignia>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="tarjeta">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Reponer stock</h2>
            <Link
              href="/inventario"
              className="text-xs font-semibold text-marca-600 hover:underline"
            >
              Inventario
            </Link>
          </header>

          {productosBajoStock.length === 0 ? (
            <SinDatos mensaje="Ningún producto está por debajo del mínimo." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {productosBajoStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/productos/${p.id}`}
                      className="block truncate text-sm text-slate-700 hover:text-marca-700"
                    >
                      {p.nombre}
                    </Link>
                    <p className="font-mono text-[11px] text-slate-400">{p.sku}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-bold ${p.stock <= 0 ? 'text-red-600' : 'text-amber-600'}`}
                    >
                      {fmtCantidad(p.stock)}
                    </p>
                    <p className="text-[11px] text-slate-400">mín. {fmtCantidad(p.minimo)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="tarjeta">
        <header className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Lo más vendido del mes (por importe)
          </h2>
        </header>

        {masVendidos.length === 0 ? (
          <SinDatos mensaje="Aún no hay ventas este mes." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="text-right">Unidades</th>
                  <th className="text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {masVendidos.map((m) => {
                  const p = nombrePorId.get(m.productoId);
                  return (
                    <tr key={m.productoId}>
                      <td>
                        <span className="font-mono text-[11px] text-slate-400">{p?.sku}</span>{' '}
                        {p?.nombre ?? `#${m.productoId}`}
                      </td>
                      <td className="text-right">{fmtCantidad(m._sum.cantidad ?? 0)}</td>
                      <td className="text-right font-semibold">{soles(m._sum.total ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

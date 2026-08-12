import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles, num, cantidad as fmtCantidad } from '@/lib/money';
import { fechaIso, desdeInputFecha, inicioDia, finDia, etiqueta } from '@/lib/format';
import { SinDatos } from '@/components/ui/basicos';

export const dynamic = 'force-dynamic';

export default async function PaginaReportes({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requerirUsuario();
  const filtros = await searchParams;

  const hoy = new Date();
  const desde = desdeInputFecha(filtros.desde ?? null) ?? new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const hasta = desdeInputFecha(filtros.hasta ?? null) ?? hoy;
  const rango = { gte: inicioDia(desde), lte: finDia(hasta) };

  const [
    ventas,
    notasCredito,
    compras,
    porVendedor,
    porCategoria,
    porMetodoPago,
    gastos,
    sinRotacion,
    comisiones,
  ] = await Promise.all([
    db.venta.aggregate({
      where: {
        estado: 'EMITIDA',
        tipoComprobante: { notIn: ['NOTA_CREDITO', 'NOTA_DEBITO'] },
        fecha: rango,
      },
      _sum: { total: true, igv: true, costoTotal: true, opGravadas: true },
      _count: true,
    }),
    db.venta.aggregate({
      where: { tipoComprobante: 'NOTA_CREDITO', fecha: rango },
      _sum: { total: true },
      _count: true,
    }),
    db.compra.aggregate({
      where: { estado: 'RECIBIDA', fecha: rango },
      _sum: { total: true },
      _count: true,
    }),
    db.venta.groupBy({
      by: ['usuarioId'],
      where: {
        estado: 'EMITIDA',
        tipoComprobante: { notIn: ['NOTA_CREDITO', 'NOTA_DEBITO'] },
        fecha: rango,
      },
      _sum: { total: true, costoTotal: true },
      _count: true,
    }),
    db.$queryRaw<
      { categoria: string; unidades: number; importe: number; costo: number }[]
    >`
      SELECT c.nombre AS categoria,
             SUM(vd.cantidad)::float AS unidades,
             SUM(vd.total)::float AS importe,
             SUM(vd."costoUnitario" * vd.cantidad)::float AS costo
      FROM venta_detalle vd
      JOIN venta v ON v.id = vd."ventaId"
      JOIN producto p ON p.id = vd."productoId"
      JOIN categoria c ON c.id = p."categoriaId"
      WHERE v.estado = 'EMITIDA'
        AND v."tipoComprobante" NOT IN ('NOTA_CREDITO', 'NOTA_DEBITO')
        AND v.fecha BETWEEN ${rango.gte} AND ${rango.lte}
      GROUP BY c.nombre
      ORDER BY importe DESC
    `,
    db.movimientoCaja.groupBy({
      by: ['metodoPago'],
      where: { tipo: 'INGRESO', fecha: rango },
      _sum: { monto: true },
    }),
    db.movimientoCaja.groupBy({
      by: ['categoria'],
      where: { tipo: 'EGRESO', fecha: rango },
      _sum: { monto: true },
    }),
    db.$queryRaw<
      { id: number; sku: string; nombre: string; stock: number; valor: number; dias: number | null }[]
    >`
      SELECT p.id, p.sku, p.nombre,
             COALESCE(SUM(s.cantidad), 0)::float AS stock,
             COALESCE(SUM(s.cantidad * s."costoPromedio"), 0)::float AS valor,
             EXTRACT(DAY FROM NOW() - MAX(m.fecha))::int AS dias
      FROM producto p
      LEFT JOIN stock s ON s."productoId" = p.id
      LEFT JOIN movimiento_inventario m
        ON m."productoId" = p.id AND m.tipo = 'SALIDA_VENTA'
      WHERE p.activo = true AND p."esServicio" = false
      GROUP BY p.id, p.sku, p.nombre
      HAVING COALESCE(SUM(s.cantidad), 0) > 0
         AND (MAX(m.fecha) IS NULL OR MAX(m.fecha) < NOW() - INTERVAL '60 days')
      ORDER BY valor DESC
      LIMIT 15
    `,
    db.comision.aggregate({
      where: { fecha: rango, estado: { not: 'ANULADA' } },
      _sum: { monto: true },
    }),
  ]);

  const usuarios = await db.usuario.findMany({
    where: { id: { in: porVendedor.map((v) => v.usuarioId) } },
    select: { id: true, nombre: true },
  });
  const nombreUsuario = new Map(usuarios.map((u) => [u.id, u.nombre]));

  const ventaNeta = num(ventas._sum.total ?? 0) - num(notasCredito._sum.total ?? 0);
  const costoVendido = num(ventas._sum.costoTotal ?? 0);
  const ventaSinIgv = num(ventas._sum.total ?? 0) - num(ventas._sum.igv ?? 0);
  const utilidadBruta = ventaSinIgv - costoVendido;
  const margen = ventaSinIgv > 0 ? (utilidadBruta / ventaSinIgv) * 100 : 0;
  const totalGastos = gastos.reduce((a, g) => a + num(g._sum.monto ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Reportes</h1>
        <p className="text-sm text-slate-500">
          Del {fechaIso(desde)} al {fechaIso(hasta)}
        </p>
      </div>

      <form className="tarjeta flex flex-wrap items-end gap-3 p-4">
        <label>
          <span className="etiqueta-campo">Desde</span>
          <input type="date" name="desde" defaultValue={fechaIso(desde)} className="campo" />
        </label>
        <label>
          <span className="etiqueta-campo">Hasta</span>
          <input type="date" name="hasta" defaultValue={fechaIso(hasta)} className="campo" />
        </label>
        <button type="submit" className="boton-primario">
          Aplicar
        </button>
        <Link href="/reportes" className="boton-secundario">
          Mes actual
        </Link>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="tarjeta border-l-4 border-l-emerald-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Venta neta</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(ventaNeta)}</p>
          <p className="text-xs text-slate-500">
            {ventas._count} comprobantes
            {notasCredito._count > 0 && ` · ${notasCredito._count} NC`}
          </p>
        </div>
        <div className="tarjeta border-l-4 border-l-marca-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Utilidad bruta</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(utilidadBruta)}</p>
          <p className="text-xs text-slate-500">margen {margen.toFixed(1)}%</p>
        </div>
        <div className="tarjeta border-l-4 border-l-amber-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Compras</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(compras._sum.total ?? 0)}</p>
          <p className="text-xs text-slate-500">{compras._count} documentos</p>
        </div>
        <div className="tarjeta border-l-4 border-l-red-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Egresos de caja</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(totalGastos)}</p>
          <p className="text-xs text-slate-500">
            comisiones {soles(comisiones._sum.monto ?? 0)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Rentabilidad por línea de producto
          </h2>
          {porCategoria.length === 0 ? (
            <SinDatos mensaje="Sin ventas en el período." />
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Línea</th>
                  <th className="text-right">Unidades</th>
                  <th className="text-right">Venta</th>
                  <th className="text-right">Utilidad</th>
                  <th className="text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {porCategoria.map((c) => {
                  // El importe viene con IGV; lo llevamos a valor de venta.
                  const neto = c.importe / 1.18;
                  const utilidad = neto - c.costo;
                  const m = neto > 0 ? (utilidad / neto) * 100 : 0;
                  return (
                    <tr key={c.categoria}>
                      <td className="text-sm">{c.categoria}</td>
                      <td className="text-right text-xs">{fmtCantidad(c.unidades)}</td>
                      <td className="text-right">{soles(c.importe)}</td>
                      <td
                        className={`text-right font-semibold ${utilidad >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
                      >
                        {soles(utilidad)}
                      </td>
                      <td className="text-right text-xs">{m.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Ventas por vendedor
          </h2>
          {porVendedor.length === 0 ? (
            <SinDatos mensaje="Sin ventas en el período." />
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th className="text-right">Comprobantes</th>
                  <th className="text-right">Venta</th>
                  <th className="text-right">Utilidad</th>
                </tr>
              </thead>
              <tbody>
                {porVendedor.map((v) => {
                  const total = num(v._sum.total ?? 0);
                  const utilidad = total / 1.18 - num(v._sum.costoTotal ?? 0);
                  return (
                    <tr key={v.usuarioId}>
                      <td className="text-sm">{nombreUsuario.get(v.usuarioId) ?? '—'}</td>
                      <td className="text-right text-xs">{v._count}</td>
                      <td className="text-right font-semibold">{soles(total)}</td>
                      <td className="text-right text-emerald-700">{soles(utilidad)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Cobros por medio de pago
          </h2>
          {porMetodoPago.length === 0 ? (
            <SinDatos mensaje="Sin cobros registrados." />
          ) : (
            <table className="tabla">
              <tbody>
                {porMetodoPago
                  .sort((a, b) => num(b._sum.monto ?? 0) - num(a._sum.monto ?? 0))
                  .map((m) => (
                    <tr key={m.metodoPago}>
                      <td className="text-sm">{etiqueta(m.metodoPago)}</td>
                      <td className="text-right font-semibold">{soles(m._sum.monto ?? 0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Egresos por categoría
          </h2>
          {gastos.length === 0 ? (
            <SinDatos mensaje="Sin egresos registrados." />
          ) : (
            <table className="tabla">
              <tbody>
                {gastos
                  .sort((a, b) => num(b._sum.monto ?? 0) - num(a._sum.monto ?? 0))
                  .map((g) => (
                    <tr key={g.categoria}>
                      <td className="text-sm">{etiqueta(g.categoria)}</td>
                      <td className="text-right font-semibold text-red-700">
                        {soles(g._sum.monto ?? 0)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="tarjeta overflow-hidden">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Capital dormido — productos sin vender en más de 60 días
        </h2>
        {sinRotacion.length === 0 ? (
          <SinDatos mensaje="Todo el inventario tuvo movimiento reciente." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th className="text-right">Stock</th>
                    <th className="text-right">Capital inmovilizado</th>
                    <th className="text-right">Última venta</th>
                  </tr>
                </thead>
                <tbody>
                  {sinRotacion.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs">{p.sku}</td>
                      <td className="max-w-[320px]">
                        <Link
                          href={`/productos/${p.id}`}
                          className="block truncate text-sm hover:text-marca-700"
                        >
                          {p.nombre}
                        </Link>
                      </td>
                      <td className="text-right">{fmtCantidad(p.stock)}</td>
                      <td className="text-right font-semibold">{soles(p.valor)}</td>
                      <td className="text-right text-xs text-slate-500">
                        {p.dias == null ? 'nunca' : `hace ${p.dias} días`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
              Total inmovilizado en esta lista:{' '}
              <strong>{soles(sinRotacion.reduce((a, p) => a + p.valor, 0))}</strong>. Considera
              promociones o devolución al proveedor.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

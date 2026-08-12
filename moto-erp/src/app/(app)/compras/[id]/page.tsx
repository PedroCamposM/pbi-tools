import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles, cantidad as fmtCantidad } from '@/lib/money';
import { fecha as fmtFecha, etiqueta } from '@/lib/format';
import { Insignia } from '@/components/ui/basicos';
import { colorEstado } from '@/lib/estados';
import { AnularCompra } from './anular';

export const dynamic = 'force-dynamic';

export default async function DetalleCompra({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario();
  const { id } = await params;

  const compra = await db.compra.findUnique({
    where: { id: Number(id) },
    include: {
      proveedor: true,
      almacen: true,
      usuario: true,
      detalles: { include: { producto: true }, orderBy: { id: 'asc' } },
      cuenta: { include: { pagos: true } },
    },
  });

  if (!compra) notFound();

  const documento = [compra.serie, compra.numero].filter(Boolean).join('-') || `#${compra.id}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/compras" className="text-xs font-semibold text-marca-600 hover:underline">
            ← Compras
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="font-mono text-xl font-bold text-slate-800">{documento}</h1>
            <Insignia color={colorEstado(compra.estado)}>{etiqueta(compra.estado)}</Insignia>
          </div>
          <p className="text-sm text-slate-500">
            {compra.proveedor.razonSocial} · {fmtFecha(compra.fecha)} · registró{' '}
            {compra.usuario.nombre}
          </p>
        </div>

        {compra.estado === 'RECIBIDA' && <AnularCompra compraId={compra.id} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="tarjeta p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Proveedor
          </h2>
          <p className="font-medium text-slate-800">{compra.proveedor.razonSocial}</p>
          <p className="text-sm text-slate-600">RUC {compra.proveedor.numeroDocumento}</p>
          {compra.proveedor.telefono && (
            <p className="text-sm text-slate-500">Tel. {compra.proveedor.telefono}</p>
          )}
        </section>

        <section className="tarjeta p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Condiciones
          </h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Pago</dt>
              <dd>{etiqueta(compra.condicionPago)}</dd>
            </div>
            {compra.fechaVencimiento && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Vence</dt>
                <dd>{fmtFecha(compra.fechaVencimiento)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">Ingresó a</dt>
              <dd>{compra.almacen.nombre}</dd>
            </div>
          </dl>
        </section>

        <section className="tarjeta p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Cuenta por pagar
          </h2>
          {compra.cuenta ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Saldo</dt>
                <dd className="font-bold text-amber-700">{soles(compra.cuenta.saldo)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Estado</dt>
                <dd>
                  <Insignia color={colorEstado(compra.cuenta.estado)}>
                    {etiqueta(compra.cuenta.estado)}
                  </Insignia>
                </dd>
              </div>
              <Link
                href="/cobranzas?vista=pagar"
                className="mt-2 inline-block text-xs font-semibold text-marca-600 hover:underline"
              >
                Registrar pago
              </Link>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Compra al contado, sin cuenta pendiente.</p>
          )}
        </section>
      </div>

      <section className="tarjeta overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th className="text-right">Cantidad</th>
                <th className="text-right">Costo unit. (s/IGV)</th>
                <th className="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {compra.detalles.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-xs">{d.producto.sku}</td>
                  <td>
                    <Link
                      href={`/productos/${d.productoId}`}
                      className="text-sm hover:text-marca-700"
                    >
                      {d.producto.nombre}
                    </Link>
                  </td>
                  <td className="text-right">{fmtCantidad(d.cantidad)}</td>
                  <td className="text-right">{soles(d.costoUnitario)}</td>
                  <td className="text-right font-semibold">{soles(d.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 p-4">
          <dl className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd>{soles(compra.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">IGV</dt>
              <dd>{soles(compra.igv)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-1 text-base font-bold">
              <dt>Total</dt>
              <dd>{soles(compra.total)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {compra.cuenta && compra.cuenta.pagos.length > 0 && (
        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Pagos realizados
          </h2>
          <table className="tabla">
            <tbody>
              {compra.cuenta.pagos.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs">{fmtFecha(p.fecha)}</td>
                  <td className="text-xs">{etiqueta(p.metodoPago)}</td>
                  <td className="text-xs text-slate-500">{p.referencia ?? '—'}</td>
                  <td className="text-right font-semibold">{soles(p.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {compra.observacion && (
        <p className="whitespace-pre-line rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {compra.observacion}
        </p>
      )}
    </div>
  );
}

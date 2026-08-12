import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles, cantidad as fmtCantidad, num } from '@/lib/money';
import { fechaHora, fecha as fmtFecha, etiqueta } from '@/lib/format';
import { Insignia } from '@/components/ui/basicos';
import { colorEstado } from '@/lib/estados';
import { numeroComprobante } from '@/lib/sunat/catalogos';
import { AccionesVenta } from './acciones';

export const dynamic = 'force-dynamic';

export default async function DetalleVenta({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario();
  const { id } = await params;

  const venta = await db.venta.findUnique({
    where: { id: Number(id) },
    include: {
      cliente: true,
      usuario: true,
      almacen: true,
      tecnico: true,
      detalles: { include: { producto: true }, orderBy: { id: 'asc' } },
      pagos: true,
      comprobante: true,
      cuenta: { include: { cobros: true } },
      documentoRef: true,
      notas: true,
      ordenTrabajo: true,
    },
  });

  if (!venta) notFound();

  const numero = numeroComprobante(venta.serie, venta.correlativo);
  const utilidad = num(venta.total) - num(venta.igv) - num(venta.costoTotal);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-xl font-bold text-slate-800">{numero}</h1>
            <Insignia color={colorEstado(venta.estado)}>{etiqueta(venta.estado)}</Insignia>
          </div>
          <p className="text-sm text-slate-500">
            {etiqueta(venta.tipoComprobante)} · {fechaHora(venta.fecha)} · {venta.usuario.nombre}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/ventas/${venta.id}/imprimir`} className="boton-secundario">
            Imprimir
          </Link>
          <AccionesVenta
            ventaId={venta.id}
            estado={venta.estado}
            tipoComprobante={venta.tipoComprobante}
            estadoSunat={venta.comprobante?.estado ?? null}
          />
        </div>
      </div>

      {venta.documentoRef && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Esta nota modifica al comprobante{' '}
          <Link href={`/ventas/${venta.documentoRef.id}`} className="font-mono font-semibold underline">
            {numeroComprobante(venta.documentoRef.serie, venta.documentoRef.correlativo)}
          </Link>
          {venta.motivoNota && ` — ${venta.motivoNota}`}
        </p>
      )}

      {venta.notas.length > 0 && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          Notas emitidas sobre este comprobante:{' '}
          {venta.notas.map((n) => (
            <Link
              key={n.id}
              href={`/ventas/${n.id}`}
              className="mr-2 font-mono font-semibold text-marca-700 underline"
            >
              {numeroComprobante(n.serie, n.correlativo)}
            </Link>
          ))}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="tarjeta p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Cliente</h2>
          <p className="font-medium text-slate-800">{venta.cliente.nombre}</p>
          <p className="text-sm text-slate-600">
            {etiqueta(venta.cliente.tipoDocumento)} {venta.cliente.numeroDocumento}
          </p>
          {venta.cliente.direccion && (
            <p className="mt-1 text-sm text-slate-500">{venta.cliente.direccion}</p>
          )}
          {venta.cliente.telefono && (
            <p className="text-sm text-slate-500">Tel. {venta.cliente.telefono}</p>
          )}
        </section>

        <section className="tarjeta p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Condiciones
          </h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Pago</dt>
              <dd>{etiqueta(venta.condicionPago)}</dd>
            </div>
            {venta.fechaVencimiento && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Vence</dt>
                <dd>{fmtFecha(venta.fechaVencimiento)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">Almacén</dt>
              <dd>{venta.almacen.nombre}</dd>
            </div>
            {venta.tecnico && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Técnico</dt>
                <dd>{venta.tecnico.nombre}</dd>
              </div>
            )}
            {venta.ordenTrabajo && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Orden</dt>
                <dd>
                  <Link
                    href={`/taller/${venta.ordenTrabajo.id}`}
                    className="font-mono text-marca-700 underline"
                  >
                    {venta.ordenTrabajo.numero}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="tarjeta p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Facturación electrónica
          </h2>
          {venta.comprobante ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Estado</dt>
                <dd>
                  <Insignia color={colorEstado(venta.comprobante.estado)}>
                    {etiqueta(venta.comprobante.estado)}
                  </Insignia>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Proveedor</dt>
                <dd>{venta.comprobante.proveedor}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-slate-500">Archivo</dt>
                <dd className="truncate font-mono text-xs">{venta.comprobante.nombreArchivo}</dd>
              </div>
              {venta.comprobante.mensajeRespuesta && (
                <p className="pt-1 text-xs text-slate-600">{venta.comprobante.mensajeRespuesta}</p>
              )}
              <Link
                href={`/ventas/${venta.id}/xml`}
                className="mt-2 inline-block text-xs font-semibold text-marca-600 hover:underline"
              >
                Descargar XML
              </Link>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">
              Documento interno: no se declara a SUNAT.
            </p>
          )}
        </section>
      </div>

      <section className="tarjeta overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Descripción</th>
                <th className="text-right">Cant.</th>
                <th className="text-right">V. unit.</th>
                <th className="text-right">Dscto.</th>
                <th className="text-right">V. venta</th>
                <th className="text-right">IGV</th>
                <th className="text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {venta.detalles.map((d, i) => (
                <tr key={d.id}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td>
                    <p className="text-sm">{d.descripcion}</p>
                    <p className="font-mono text-[11px] text-slate-400">
                      {d.producto.sku} · {etiqueta(d.afectacionIgv)}
                    </p>
                  </td>
                  <td className="text-right">{fmtCantidad(d.cantidad)}</td>
                  <td className="text-right">{soles(d.precioUnitario)}</td>
                  <td className="text-right">{d.descuento.equals(0) ? '—' : soles(d.descuento)}</td>
                  <td className="text-right">{soles(d.valorVenta)}</td>
                  <td className="text-right">{soles(d.igv)}</td>
                  <td className="text-right font-semibold">{soles(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:justify-between">
          <div className="text-sm text-slate-600">
            {venta.observacion && <p className="whitespace-pre-line">{venta.observacion}</p>}
            <p className="mt-2 text-xs text-slate-500">
              Costo de mercadería: {soles(venta.costoTotal)} · Utilidad bruta:{' '}
              <span className={utilidad >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
                {soles(utilidad)}
              </span>
            </p>
          </div>

          <dl className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Op. gravadas</dt>
              <dd>{soles(venta.opGravadas)}</dd>
            </div>
            {!venta.opExoneradas.equals(0) && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Op. exoneradas</dt>
                <dd>{soles(venta.opExoneradas)}</dd>
              </div>
            )}
            {!venta.opInafectas.equals(0) && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Op. inafectas</dt>
                <dd>{soles(venta.opInafectas)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">IGV</dt>
              <dd>{soles(venta.igv)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-1 text-base font-bold">
              <dt>Total</dt>
              <dd>{soles(venta.total)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="tarjeta">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Cobros
          </h2>
          {venta.pagos.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Sin pagos registrados.</p>
          ) : (
            <table className="tabla">
              <tbody>
                {venta.pagos.map((p) => (
                  <tr key={p.id}>
                    <td>{etiqueta(p.metodoPago)}</td>
                    <td className="text-xs text-slate-500">{p.referencia ?? '—'}</td>
                    <td className="text-right font-semibold">{soles(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {venta.cuenta && (
          <section className="tarjeta">
            <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
              Cuenta por cobrar
            </h2>
            <div className="space-y-1 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Monto original</span>
                <span>{soles(venta.cuenta.montoOriginal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Saldo</span>
                <span className="font-bold text-amber-700">{soles(venta.cuenta.saldo)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Vence</span>
                <span>{fmtFecha(venta.cuenta.fechaVencimiento)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Estado</span>
                <Insignia color={colorEstado(venta.cuenta.estado)}>
                  {etiqueta(venta.cuenta.estado)}
                </Insignia>
              </div>
            </div>
            {venta.cuenta.cobros.length > 0 && (
              <table className="tabla">
                <tbody>
                  {venta.cuenta.cobros.map((c) => (
                    <tr key={c.id}>
                      <td className="text-xs">{fmtFecha(c.fecha)}</td>
                      <td className="text-xs">{etiqueta(c.metodoPago)}</td>
                      <td className="text-right font-semibold">{soles(c.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

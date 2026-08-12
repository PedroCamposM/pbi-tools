import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles, cantidad as fmtCantidad, num } from '@/lib/money';
import { fechaHora, etiqueta, fecha as fmtFecha } from '@/lib/format';
import { numeroComprobante, NOMBRE_TIPO_COMPROBANTE } from '@/lib/sunat/catalogos';
import { montoALetras } from '@/lib/sunat/numero-letras';
import { BotonImprimir } from './boton-imprimir';

export const dynamic = 'force-dynamic';

export default async function ImprimirComprobante({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ formato?: string }>;
}) {
  await requerirUsuario();
  const { id } = await params;
  const { formato } = await searchParams;

  const ticket = formato !== 'a4';

  const [venta, empresa] = await Promise.all([
    db.venta.findUnique({
      where: { id: Number(id) },
      include: {
        cliente: true,
        usuario: true,
        detalles: { include: { producto: true }, orderBy: { id: 'asc' } },
        pagos: true,
        comprobante: true,
        documentoRef: true,
      },
    }),
    db.empresa.findFirst(),
  ]);

  if (!venta || !empresa) notFound();

  const numero = numeroComprobante(venta.serie, venta.correlativo);
  const leyenda = montoALetras(num(venta.total), venta.moneda);
  const totalPagado = venta.pagos.reduce((acc, p) => acc + num(p.monto), 0);
  const vuelto = Math.max(0, Math.round((totalPagado - num(venta.total)) * 100) / 100);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-imprimir mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/ventas/${venta.id}`} className="boton-secundario">
          ← Volver
        </Link>
        <div className="flex gap-2">
          <Link
            href={`/ventas/${venta.id}/imprimir?formato=${ticket ? 'a4' : 'ticket'}`}
            className="boton-secundario"
          >
            Ver en {ticket ? 'A4' : 'ticket 80mm'}
          </Link>
          <BotonImprimir />
        </div>
      </div>

      <article
        className={
          ticket
            ? 'area-impresion mx-auto max-w-[302px] bg-white p-3 font-mono text-[11px] leading-tight text-black shadow'
            : 'area-impresion mx-auto max-w-[794px] bg-white p-10 text-sm text-black shadow'
        }
      >
        {/* ---------------------------- Encabezado ---------------------------- */}
        <header className={ticket ? 'text-center' : 'flex items-start justify-between gap-6'}>
          <div className={ticket ? '' : 'max-w-[60%]'}>
            <p className={ticket ? 'text-sm font-bold uppercase' : 'text-lg font-bold uppercase'}>
              {empresa.nombreComercial ?? empresa.razonSocial}
            </p>
            {empresa.nombreComercial && (
              <p className={ticket ? 'text-[10px]' : 'text-xs text-slate-600'}>
                {empresa.razonSocial}
              </p>
            )}
            <p className={ticket ? 'text-[10px]' : 'text-xs'}>{empresa.direccion}</p>
            <p className={ticket ? 'text-[10px]' : 'text-xs'}>
              {[empresa.distrito, empresa.provincia, empresa.departamento]
                .filter(Boolean)
                .join(' - ')}
            </p>
            {empresa.telefono && (
              <p className={ticket ? 'text-[10px]' : 'text-xs'}>Tel. {empresa.telefono}</p>
            )}
          </div>

          <div
            className={
              ticket
                ? 'mt-2 border border-black py-1'
                : 'shrink-0 border-2 border-black px-6 py-3 text-center'
            }
          >
            <p className={ticket ? 'text-[10px] font-bold' : 'text-xs font-bold'}>
              RUC {empresa.ruc}
            </p>
            <p className={ticket ? 'text-[10px] font-bold uppercase' : 'text-sm font-bold uppercase'}>
              {NOMBRE_TIPO_COMPROBANTE[venta.tipoComprobante]}
            </p>
            <p className={ticket ? 'text-xs font-bold' : 'text-base font-bold'}>{numero}</p>
          </div>
        </header>

        <hr className="my-2 border-t border-dashed border-black" />

        {/* ----------------------------- Cliente ----------------------------- */}
        <section className={ticket ? 'space-y-0.5' : 'grid grid-cols-2 gap-x-6 gap-y-1'}>
          <p>
            <span className="font-bold">Fecha: </span>
            {fechaHora(venta.fecha)}
          </p>
          <p>
            <span className="font-bold">Cliente: </span>
            {venta.cliente.nombre}
          </p>
          <p>
            <span className="font-bold">{etiqueta(venta.cliente.tipoDocumento)}: </span>
            {venta.cliente.numeroDocumento}
          </p>
          {venta.cliente.direccion && (
            <p>
              <span className="font-bold">Dirección: </span>
              {venta.cliente.direccion}
            </p>
          )}
          <p>
            <span className="font-bold">Condición: </span>
            {etiqueta(venta.condicionPago)}
            {venta.fechaVencimiento && ` — vence ${fmtFecha(venta.fechaVencimiento)}`}
          </p>
          <p>
            <span className="font-bold">Atendió: </span>
            {venta.usuario.nombre}
          </p>
          {venta.documentoRef && (
            <p>
              <span className="font-bold">Modifica: </span>
              {numeroComprobante(venta.documentoRef.serie, venta.documentoRef.correlativo)}
              {venta.motivoNota && ` (${venta.motivoNota})`}
            </p>
          )}
        </section>

        <hr className="my-2 border-t border-dashed border-black" />

        {/* ------------------------------ Items ------------------------------ */}
        {ticket ? (
          <section className="space-y-1">
            {venta.detalles.map((d) => (
              <div key={d.id}>
                <p className="font-bold">{d.descripcion}</p>
                <div className="flex justify-between">
                  <span>
                    {fmtCantidad(d.cantidad)} {d.unidadMedida} x {num(d.total) / num(d.cantidad) || 0}
                  </span>
                  <span className="font-bold">{soles(d.total)}</span>
                </div>
              </div>
            ))}
          </section>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1 text-left">Código</th>
                <th className="py-1 text-left">Descripción</th>
                <th className="py-1 text-right">Cant.</th>
                <th className="py-1 text-right">U.M.</th>
                <th className="py-1 text-right">V. unit.</th>
                <th className="py-1 text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {venta.detalles.map((d) => (
                <tr key={d.id} className="border-b border-slate-200">
                  <td className="py-1 font-mono">{d.producto.sku}</td>
                  <td className="py-1">{d.descripcion}</td>
                  <td className="py-1 text-right">{fmtCantidad(d.cantidad)}</td>
                  <td className="py-1 text-right">{d.unidadMedida}</td>
                  <td className="py-1 text-right">{soles(d.precioUnitario)}</td>
                  <td className="py-1 text-right font-semibold">{soles(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <hr className="my-2 border-t border-dashed border-black" />

        {/* ------------------------------ Totales ---------------------------- */}
        <section className={ticket ? '' : 'flex justify-end'}>
          <dl className={ticket ? 'space-y-0.5' : 'w-64 space-y-0.5'}>
            <div className="flex justify-between">
              <dt>Op. gravadas</dt>
              <dd>{soles(venta.opGravadas)}</dd>
            </div>
            {!venta.opExoneradas.equals(0) && (
              <div className="flex justify-between">
                <dt>Op. exoneradas</dt>
                <dd>{soles(venta.opExoneradas)}</dd>
              </div>
            )}
            {!venta.opInafectas.equals(0) && (
              <div className="flex justify-between">
                <dt>Op. inafectas</dt>
                <dd>{soles(venta.opInafectas)}</dd>
              </div>
            )}
            {!venta.descuentoTotal.equals(0) && (
              <div className="flex justify-between">
                <dt>Descuentos</dt>
                <dd>-{soles(venta.descuentoTotal)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>IGV ({num(empresa.igvPorcentaje)}%)</dt>
              <dd>{soles(venta.igv)}</dd>
            </div>
            <div className="flex justify-between border-t border-black pt-1 text-base font-bold">
              <dt>TOTAL</dt>
              <dd>{soles(venta.total)}</dd>
            </div>
          </dl>
        </section>

        <p className={ticket ? 'mt-2 text-[10px]' : 'mt-3 text-xs'}>{leyenda}</p>

        {venta.pagos.length > 0 && (
          <>
            <hr className="my-2 border-t border-dashed border-black" />
            <section className={ticket ? 'space-y-0.5' : 'text-xs'}>
              {venta.pagos.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span>{etiqueta(p.metodoPago)}</span>
                  <span>{soles(p.monto)}</span>
                </div>
              ))}
              {vuelto > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Vuelto</span>
                  <span>{soles(vuelto)}</span>
                </div>
              )}
            </section>
          </>
        )}

        <hr className="my-2 border-t border-dashed border-black" />

        <footer className={ticket ? 'space-y-1 text-center text-[10px]' : 'mt-4 text-center text-xs'}>
          {venta.comprobante && (
            <>
              <p>Representación impresa del comprobante electrónico.</p>
              <p>
                Autorizado mediante Resolución de SUNAT. Consulte su documento en
                www.sunat.gob.pe
              </p>
              {venta.comprobante.hashCpe && (
                <p className="break-all">Hash: {venta.comprobante.hashCpe.slice(0, 28)}…</p>
              )}
            </>
          )}
          {empresa.piePagina && <p className="mt-1 font-semibold">{empresa.piePagina}</p>}
          {venta.estado === 'ANULADA' && (
            <p className="mt-2 text-base font-bold text-red-700">*** DOCUMENTO ANULADO ***</p>
          )}
        </footer>
      </article>
    </div>
  );
}

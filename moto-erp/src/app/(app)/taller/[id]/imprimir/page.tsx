import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles, cantidad as fmtCantidad } from '@/lib/money';
import { fechaHora, fecha as fmtFecha, etiqueta } from '@/lib/format';
import { BotonImprimir } from '../../../ventas/[id]/imprimir/boton-imprimir';

export const dynamic = 'force-dynamic';

export default async function ImprimirOrden({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario();
  const { id } = await params;

  const [orden, empresa] = await Promise.all([
    db.ordenTrabajo.findUnique({
      where: { id: Number(id) },
      include: {
        cliente: true,
        moto: { include: { marcaMoto: true, modeloMoto: true } },
        tecnico: true,
        usuario: true,
        repuestos: { include: { producto: true } },
        servicios: true,
      },
    }),
    db.empresa.findFirst(),
  ]);

  if (!orden || !empresa) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-imprimir mb-4 flex items-center justify-between">
        <Link href={`/taller/${orden.id}`} className="boton-secundario">
          ← Volver
        </Link>
        <BotonImprimir />
      </div>

      <article className="area-impresion mx-auto max-w-[794px] bg-white p-10 text-sm text-black shadow">
        <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
          <div>
            <p className="text-lg font-bold uppercase">
              {empresa.nombreComercial ?? empresa.razonSocial}
            </p>
            <p className="text-xs">{empresa.direccion}</p>
            <p className="text-xs">
              RUC {empresa.ruc}
              {empresa.telefono && ` · Tel. ${empresa.telefono}`}
            </p>
          </div>
          <div className="border-2 border-black px-6 py-3 text-center">
            <p className="text-xs font-bold uppercase">Orden de trabajo</p>
            <p className="font-mono text-lg font-bold">{orden.numero}</p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
          <p>
            <span className="font-bold">Cliente: </span>
            {orden.cliente.nombre}
          </p>
          <p>
            <span className="font-bold">Ingreso: </span>
            {fechaHora(orden.fechaIngreso)}
          </p>
          <p>
            <span className="font-bold">Documento: </span>
            {etiqueta(orden.cliente.tipoDocumento)} {orden.cliente.numeroDocumento}
          </p>
          <p>
            <span className="font-bold">Entrega prometida: </span>
            {orden.fechaPrometida ? fmtFecha(orden.fechaPrometida) : 'Por definir'}
          </p>
          <p>
            <span className="font-bold">Teléfono: </span>
            {orden.cliente.telefono ?? '—'}
          </p>
          <p>
            <span className="font-bold">Técnico: </span>
            {orden.tecnico?.nombre ?? 'Por asignar'}
          </p>
          <p>
            <span className="font-bold">Moto: </span>
            {orden.moto
              ? `${orden.moto.placa ?? 'Sin placa'} — ${[orden.moto.marcaMoto?.nombre, orden.moto.modeloMoto?.nombre, orden.moto.anio].filter(Boolean).join(' ')}`
              : '—'}
          </p>
          <p>
            <span className="font-bold">Kilometraje: </span>
            {orden.kilometraje != null ? `${orden.kilometraje.toLocaleString('es-PE')} km` : '—'}
          </p>
        </section>

        <section className="mt-4 space-y-3 text-xs">
          <div>
            <p className="font-bold uppercase">Motivo del ingreso</p>
            <p className="whitespace-pre-line border border-slate-300 p-2">{orden.motivoIngreso}</p>
          </div>
          {orden.diagnostico && (
            <div>
              <p className="font-bold uppercase">Diagnóstico</p>
              <p className="whitespace-pre-line border border-slate-300 p-2">{orden.diagnostico}</p>
            </div>
          )}
          {orden.trabajoRealizado && (
            <div>
              <p className="font-bold uppercase">Trabajo realizado</p>
              <p className="whitespace-pre-line border border-slate-300 p-2">
                {orden.trabajoRealizado}
              </p>
            </div>
          )}
        </section>

        {orden.repuestos.length > 0 && (
          <section className="mt-4">
            <p className="text-xs font-bold uppercase">Repuestos</p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-black">
                  <th className="py-1 text-left">Código</th>
                  <th className="py-1 text-left">Descripción</th>
                  <th className="py-1 text-right">Cant.</th>
                  <th className="py-1 text-right">P. unit.</th>
                  <th className="py-1 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {orden.repuestos.map((r) => (
                  <tr key={r.id} className="border-b border-slate-200">
                    <td className="py-1 font-mono">{r.producto.sku}</td>
                    <td className="py-1">{r.producto.nombre}</td>
                    <td className="py-1 text-right">{fmtCantidad(r.cantidad)}</td>
                    <td className="py-1 text-right">{soles(r.precioUnitario)}</td>
                    <td className="py-1 text-right">{soles(r.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {orden.servicios.length > 0 && (
          <section className="mt-4">
            <p className="text-xs font-bold uppercase">Mano de obra</p>
            <table className="w-full border-collapse text-xs">
              <tbody>
                {orden.servicios.map((s) => (
                  <tr key={s.id} className="border-b border-slate-200">
                    <td className="py-1">{s.descripcion}</td>
                    <td className="py-1 text-right">{soles(s.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="mt-4 flex justify-end">
          <dl className="w-64 space-y-1 text-xs">
            <div className="flex justify-between">
              <dt>Repuestos</dt>
              <dd>{soles(orden.totalRepuestos)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Mano de obra</dt>
              <dd>{soles(orden.totalServicios)}</dd>
            </div>
            <div className="flex justify-between border-t border-black pt-1 text-base font-bold">
              <dt>TOTAL</dt>
              <dd>{soles(orden.total)}</dd>
            </div>
          </dl>
        </section>

        {orden.observacion && (
          <p className="mt-4 whitespace-pre-line text-xs">
            <span className="font-bold">Observaciones: </span>
            {orden.observacion}
          </p>
        )}

        <footer className="mt-10 grid grid-cols-2 gap-10 text-center text-xs">
          <div>
            <div className="border-t border-black pt-1">Firma del cliente</div>
            <p className="mt-1 text-[10px]">{orden.cliente.nombre}</p>
          </div>
          <div>
            <div className="border-t border-black pt-1">Firma del taller</div>
            <p className="mt-1 text-[10px]">{orden.usuario.nombre}</p>
          </div>
        </footer>

        <p className="mt-6 text-center text-[10px]">
          Este documento no es comprobante de pago. La garantía del servicio cubre 30 días o 1 000 km
          desde la entrega, lo que ocurra primero, salvo daño por mal uso.
        </p>
      </article>
    </div>
  );
}

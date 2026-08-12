import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles, num, porcentaje } from '@/lib/money';
import { fecha as fmtFecha, etiqueta } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { colorEstado } from '@/lib/estados';
import { numeroComprobante } from '@/lib/sunat/catalogos';

export const dynamic = 'force-dynamic';

export default async function DetalleTecnico({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario();
  const { id } = await params;

  const tecnico = await db.tecnico.findUnique({
    where: { id: Number(id) },
    include: {
      cliente: { include: { cuentas: { where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } } } } },
    },
  });

  if (!tecnico) notFound();

  const [comisiones, ordenes, ventas] = await Promise.all([
    db.comision.findMany({
      where: { tecnicoId: tecnico.id },
      include: { venta: true, ordenTrabajo: true },
      orderBy: { id: 'desc' },
      take: 60,
    }),
    db.ordenTrabajo.findMany({
      where: { tecnicoId: tecnico.id },
      include: { cliente: true, moto: true },
      orderBy: { id: 'desc' },
      take: 20,
    }),
    db.venta.findMany({
      where: { tecnicoId: tecnico.id, estado: 'EMITIDA' },
      include: { cliente: true },
      orderBy: { id: 'desc' },
      take: 20,
    }),
  ]);

  const pendiente = comisiones
    .filter((c) => c.estado === 'PENDIENTE')
    .reduce((acc, c) => acc + num(c.monto), 0);
  const liquidado = comisiones
    .filter((c) => c.estado === 'LIQUIDADA')
    .reduce((acc, c) => acc + num(c.monto), 0);
  const deuda = tecnico.cliente?.cuentas.reduce((acc, c) => acc + num(c.saldo), 0) ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/tecnicos" className="text-xs font-semibold text-marca-600 hover:underline">
          ← Técnicos
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-800">{tecnico.nombre}</h1>
        <p className="text-sm text-slate-500">
          {tecnico.taller ?? 'Sin taller'} · {tecnico.telefono ?? 'sin teléfono'}
          {tecnico.documento && ` · ${tecnico.documento}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="tarjeta border-l-4 border-l-amber-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Comisión pendiente</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(pendiente)}</p>
        </div>
        <div className="tarjeta border-l-4 border-l-emerald-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Ya liquidado</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(liquidado)}</p>
        </div>
        <div className="tarjeta border-l-4 border-l-red-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Deuda por compras</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(deuda)}</p>
          {tecnico.cliente && (
            <p className="text-xs text-slate-500">
              línea {soles(tecnico.cliente.lineaCredito)}
            </p>
          )}
        </div>
        <div className="tarjeta border-l-4 border-l-marca-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Tasas</p>
          <p className="mt-1 text-sm text-slate-700">
            Venta {porcentaje(tecnico.comisionVentaPct)}
          </p>
          <p className="text-sm text-slate-700">
            Servicio {porcentaje(tecnico.comisionServicioPct)}
          </p>
        </div>
      </div>

      <section className="tarjeta overflow-hidden">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Detalle de comisiones
        </h2>
        {comisiones.length === 0 ? (
          <SinDatos mensaje="Todavía no generó comisiones." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th className="text-right">Base</th>
                  <th className="text-right">%</th>
                  <th className="text-right">Comisión</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {comisiones.map((c) => (
                  <tr key={c.id}>
                    <td className="text-xs">{fmtFecha(c.fecha)}</td>
                    <td>
                      <Insignia color={c.tipo === 'SERVICIO' ? 'violeta' : 'azul'}>
                        {etiqueta(c.tipo)}
                      </Insignia>
                    </td>
                    <td className="max-w-[280px] truncate text-sm">
                      {c.venta ? (
                        <Link href={`/ventas/${c.venta.id}`} className="hover:text-marca-700">
                          {c.concepto}
                        </Link>
                      ) : c.ordenTrabajo ? (
                        <Link
                          href={`/taller/${c.ordenTrabajo.id}`}
                          className="hover:text-marca-700"
                        >
                          {c.concepto}
                        </Link>
                      ) : (
                        c.concepto
                      )}
                    </td>
                    <td className="text-right text-xs text-slate-600">{soles(c.baseCalculo)}</td>
                    <td className="text-right text-xs">{porcentaje(c.porcentaje)}</td>
                    <td className="text-right font-semibold">{soles(c.monto)}</td>
                    <td>
                      <Insignia color={colorEstado(c.estado)}>{etiqueta(c.estado)}</Insignia>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Órdenes de trabajo
          </h2>
          {ordenes.length === 0 ? (
            <SinDatos mensaje="Sin órdenes asignadas." />
          ) : (
            <table className="tabla">
              <tbody>
                {ordenes.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link
                        href={`/taller/${o.id}`}
                        className="font-mono text-xs font-semibold text-marca-700 hover:underline"
                      >
                        {o.numero}
                      </Link>
                    </td>
                    <td className="max-w-[160px] truncate text-sm">{o.cliente.nombre}</td>
                    <td className="text-xs text-slate-500">{o.moto?.placa ?? '—'}</td>
                    <td>
                      <Insignia color={colorEstado(o.estado)}>{etiqueta(o.estado)}</Insignia>
                    </td>
                    <td className="text-right font-semibold">{soles(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Ventas derivadas
          </h2>
          {ventas.length === 0 ? (
            <SinDatos mensaje="Sin ventas asociadas." />
          ) : (
            <table className="tabla">
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link
                        href={`/ventas/${v.id}`}
                        className="font-mono text-xs font-semibold text-marca-700 hover:underline"
                      >
                        {numeroComprobante(v.serie, v.correlativo)}
                      </Link>
                    </td>
                    <td className="max-w-[180px] truncate text-sm">{v.cliente.nombre}</td>
                    <td className="text-xs text-slate-500">{fmtFecha(v.fecha)}</td>
                    <td className="text-right font-semibold">{soles(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

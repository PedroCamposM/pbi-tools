import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles } from '@/lib/money';
import { fecha as fmtFecha, etiqueta } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { colorEstado } from '@/lib/estados';
import { ESTADOS_ORDEN_TRABAJO } from '@/lib/constantes';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function PaginaTaller({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  await requerirUsuario();
  const filtros = await searchParams;

  const where: Prisma.OrdenTrabajoWhereInput = {
    ...(filtros.estado
      ? { estado: filtros.estado as never }
      : { estado: { notIn: ['ENTREGADO', 'ANULADO'] } }),
    ...(filtros.q
      ? {
          OR: [
            { numero: { contains: filtros.q, mode: 'insensitive' } },
            { cliente: { nombre: { contains: filtros.q, mode: 'insensitive' } } },
            { moto: { placa: { contains: filtros.q.toUpperCase() } } },
          ],
        }
      : {}),
  };

  const [ordenes, conteos] = await Promise.all([
    db.ordenTrabajo.findMany({
      where,
      include: {
        cliente: true,
        moto: { include: { marcaMoto: true, modeloMoto: true } },
        tecnico: true,
        venta: true,
      },
      orderBy: { id: 'desc' },
      take: 100,
    }),
    db.ordenTrabajo.groupBy({ by: ['estado'], _count: true }),
  ]);

  const porEstado = new Map(conteos.map((c) => [c.estado, c._count]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Taller</h1>
          <p className="text-sm text-slate-500">Órdenes de trabajo y servicio técnico</p>
        </div>
        <Link href="/taller/nueva" className="boton-primario">
          Recibir moto
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/taller"
          className={!filtros.estado ? 'boton-primario' : 'boton-secundario'}
        >
          Abiertas
        </Link>
        {ESTADOS_ORDEN_TRABAJO.map((e) => (
          <Link
            key={e.valor}
            href={{ pathname: '/taller', query: { estado: e.valor } }}
            className={filtros.estado === e.valor ? 'boton-primario' : 'boton-secundario'}
          >
            {e.etiqueta}
            <span className="ml-1 text-xs opacity-70">{porEstado.get(e.valor) ?? 0}</span>
          </Link>
        ))}
      </div>

      <form className="tarjeta flex flex-wrap items-end gap-3 p-4">
        {filtros.estado && <input type="hidden" name="estado" value={filtros.estado} />}
        <label className="min-w-[240px] flex-1">
          <span className="etiqueta-campo">Buscar</span>
          <input
            name="q"
            defaultValue={filtros.q ?? ''}
            placeholder="N° de orden, cliente o placa"
            className="campo"
          />
        </label>
        <button type="submit" className="boton-primario">
          Buscar
        </button>
      </form>

      <section className="tarjeta overflow-hidden">
        {ordenes.length === 0 ? (
          <SinDatos mensaje="No hay órdenes con esos filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th>Moto</th>
                  <th>Técnico</th>
                  <th>Ingreso</th>
                  <th>Estado</th>
                  <th className="text-right">Total</th>
                  <th>Facturado</th>
                </tr>
              </thead>
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
                    <td className="max-w-[200px]">
                      <p className="truncate text-sm">{o.cliente.nombre}</p>
                      <p className="text-[11px] text-slate-500">{o.cliente.telefono ?? ''}</p>
                    </td>
                    <td className="text-xs">
                      {o.moto ? (
                        <>
                          <span className="font-mono font-semibold">{o.moto.placa ?? 'S/P'}</span>
                          <span className="block text-slate-500">
                            {[o.moto.marcaMoto?.nombre, o.moto.modeloMoto?.nombre]
                              .filter(Boolean)
                              .join(' ')}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-xs text-slate-600">{o.tecnico?.nombre ?? 'Sin asignar'}</td>
                    <td className="whitespace-nowrap text-xs text-slate-600">
                      {fmtFecha(o.fechaIngreso)}
                    </td>
                    <td>
                      <Insignia color={colorEstado(o.estado)}>{etiqueta(o.estado)}</Insignia>
                    </td>
                    <td className="text-right font-semibold">{soles(o.total)}</td>
                    <td>
                      {o.venta ? (
                        <Link
                          href={`/ventas/${o.venta.id}`}
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          Sí
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

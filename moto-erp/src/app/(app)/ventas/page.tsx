import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles } from '@/lib/money';
import { fecha as fmtFecha, etiqueta, desdeInputFecha, finDia } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { colorEstado } from '@/lib/estados';
import { numeroComprobante } from '@/lib/sunat/catalogos';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const POR_PAGINA = 30;

export default async function PaginaVentas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; desde?: string; hasta?: string; tipo?: string; pagina?: string }>;
}) {
  await requerirUsuario();
  const filtros = await searchParams;

  const pagina = Math.max(1, Number(filtros.pagina ?? 1));
  const desde = desdeInputFecha(filtros.desde ?? null);
  const hasta = desdeInputFecha(filtros.hasta ?? null);

  const where: Prisma.VentaWhereInput = {
    ...(filtros.tipo ? { tipoComprobante: filtros.tipo as never } : {}),
    ...(desde || hasta
      ? { fecha: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: finDia(hasta) } : {}) } }
      : {}),
    ...(filtros.q
      ? {
          OR: [
            { cliente: { nombre: { contains: filtros.q, mode: 'insensitive' } } },
            { cliente: { numeroDocumento: { contains: filtros.q } } },
            { serie: { contains: filtros.q.toUpperCase() } },
          ],
        }
      : {}),
  };

  const [ventas, total, resumen] = await Promise.all([
    db.venta.findMany({
      where,
      include: { cliente: true, comprobante: true, usuario: true },
      orderBy: { id: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    db.venta.count({ where }),
    db.venta.aggregate({
      where: { ...where, estado: 'EMITIDA' },
      _sum: { total: true },
    }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Ventas</h1>
          <p className="text-sm text-slate-500">
            {total} comprobantes · {soles(resumen._sum.total ?? 0)} emitido
          </p>
        </div>
        <Link href="/pos" className="boton-primario">
          Nueva venta
        </Link>
      </div>

      <form className="tarjeta grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="lg:col-span-2">
          <span className="etiqueta-campo">Buscar</span>
          <input
            name="q"
            defaultValue={filtros.q ?? ''}
            placeholder="Cliente, documento o serie"
            className="campo"
          />
        </label>
        <label>
          <span className="etiqueta-campo">Desde</span>
          <input type="date" name="desde" defaultValue={filtros.desde ?? ''} className="campo" />
        </label>
        <label>
          <span className="etiqueta-campo">Hasta</span>
          <input type="date" name="hasta" defaultValue={filtros.hasta ?? ''} className="campo" />
        </label>
        <label>
          <span className="etiqueta-campo">Tipo</span>
          <select name="tipo" defaultValue={filtros.tipo ?? ''} className="campo">
            <option value="">Todos</option>
            <option value="FACTURA">Factura</option>
            <option value="BOLETA">Boleta</option>
            <option value="NOTA_VENTA">Nota de venta</option>
            <option value="NOTA_CREDITO">Nota de crédito</option>
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <button type="submit" className="boton-primario">
            Filtrar
          </button>
          <Link href="/ventas" className="boton-secundario">
            Limpiar
          </Link>
        </div>
      </form>

      <section className="tarjeta overflow-hidden">
        {ventas.length === 0 ? (
          <SinDatos mensaje="No se encontraron comprobantes con esos filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Vendedor</th>
                  <th>Pago</th>
                  <th className="text-right">Total</th>
                  <th>Estado</th>
                  <th>SUNAT</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id} className={v.estado === 'ANULADA' ? 'opacity-60' : undefined}>
                    <td>
                      <Link
                        href={`/ventas/${v.id}`}
                        className="font-mono text-xs font-semibold text-marca-700 hover:underline"
                      >
                        {numeroComprobante(v.serie, v.correlativo)}
                      </Link>
                      <p className="text-[11px] text-slate-500">{etiqueta(v.tipoComprobante)}</p>
                    </td>
                    <td className="max-w-[240px]">
                      <p className="truncate text-sm">{v.cliente.nombre}</p>
                      <p className="text-[11px] text-slate-500">{v.cliente.numeroDocumento}</p>
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-600">
                      {fmtFecha(v.fecha)}
                    </td>
                    <td className="text-xs text-slate-600">{v.usuario.nombre}</td>
                    <td className="text-xs">{etiqueta(v.condicionPago)}</td>
                    <td className="text-right font-semibold">{soles(v.total)}</td>
                    <td>
                      <Insignia color={colorEstado(v.estado)}>{etiqueta(v.estado)}</Insignia>
                    </td>
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

      {totalPaginas > 1 && (
        <nav className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPaginas }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 2)
            .map((p, i, arr) => (
              <span key={p} className="flex items-center gap-2">
                {i > 0 && arr[i - 1] !== p - 1 && <span className="text-slate-400">…</span>}
                <Link
                  href={{
                    pathname: '/ventas',
                    query: { ...filtros, pagina: String(p) },
                  }}
                  className={
                    p === pagina
                      ? 'rounded-md bg-marca-600 px-3 py-1.5 text-sm font-semibold text-white'
                      : 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50'
                  }
                >
                  {p}
                </Link>
              </span>
            ))}
        </nav>
      )}
    </div>
  );
}

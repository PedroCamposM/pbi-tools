import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles } from '@/lib/money';
import { fecha as fmtFecha, etiqueta } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { colorEstado } from '@/lib/estados';

export const dynamic = 'force-dynamic';

export default async function PaginaCompras() {
  await requerirUsuario();

  const [compras, resumen] = await Promise.all([
    db.compra.findMany({
      include: {
        proveedor: true,
        usuario: true,
        almacen: true,
        cuenta: true,
        _count: { select: { detalles: true } },
      },
      orderBy: { id: 'desc' },
      take: 100,
    }),
    db.compra.aggregate({ where: { estado: 'RECIBIDA' }, _sum: { total: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Compras</h1>
          <p className="text-sm text-slate-500">
            {compras.length} documentos · {soles(resumen._sum.total ?? 0)} comprado
          </p>
        </div>
        <Link href="/compras/nueva" className="boton-primario">
          Registrar compra
        </Link>
      </div>

      <section className="tarjeta overflow-hidden">
        {compras.length === 0 ? (
          <SinDatos mensaje="Todavía no se registran compras." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Proveedor</th>
                  <th>Fecha</th>
                  <th>Almacén</th>
                  <th className="text-right">Ítems</th>
                  <th>Pago</th>
                  <th className="text-right">Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {compras.map((c) => (
                  <tr key={c.id} className={c.estado === 'ANULADA' ? 'opacity-60' : undefined}>
                    <td>
                      <Link
                        href={`/compras/${c.id}`}
                        className="font-mono text-xs font-semibold text-marca-700 hover:underline"
                      >
                        {[c.serie, c.numero].filter(Boolean).join('-') || `#${c.id}`}
                      </Link>
                      <p className="text-[11px] text-slate-500">{c.tipoComprobante}</p>
                    </td>
                    <td className="max-w-[260px] truncate text-sm">{c.proveedor.razonSocial}</td>
                    <td className="whitespace-nowrap text-xs text-slate-600">{fmtFecha(c.fecha)}</td>
                    <td className="text-xs text-slate-600">{c.almacen.nombre}</td>
                    <td className="text-right text-xs">{c._count.detalles}</td>
                    <td className="text-xs">
                      {etiqueta(c.condicionPago)}
                      {c.cuenta && c.cuenta.estado !== 'PAGADA' && (
                        <span className="block text-[11px] font-semibold text-amber-700">
                          debe {soles(c.cuenta.saldo)}
                        </span>
                      )}
                    </td>
                    <td className="text-right font-semibold">{soles(c.total)}</td>
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
    </div>
  );
}

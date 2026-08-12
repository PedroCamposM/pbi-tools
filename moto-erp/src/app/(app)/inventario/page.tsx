import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { soles, cantidad as fmtCantidad } from '@/lib/money';
import { fechaHora, etiqueta } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { PanelLateral } from '@/components/ui/panel-lateral';
import { FormularioAjuste, FormularioTransferencia } from './formularios';

export const dynamic = 'force-dynamic';

export default async function PaginaInventario({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; almacen?: string }>;
}) {
  await requerirUsuario();
  const filtros = await searchParams;
  const vista = filtros.vista ?? 'stock';
  const almacenFiltro = filtros.almacen ? Number(filtros.almacen) : null;

  const almacenes = await db.almacen.findMany({
    where: { activo: true },
    orderBy: { predeterminado: 'desc' },
  });

  // El filtro por almacén se aplica dentro del JOIN para que los productos sin
  // stock en ese almacén sigan apareciendo con saldo cero.
  const filtroAlmacen = almacenFiltro
    ? Prisma.sql`AND s."almacenId" = ${almacenFiltro}`
    : Prisma.empty;

  const [valorizado, bajoMinimo, movimientos] = await Promise.all([
    db.$queryRaw<
      {
        id: number;
        sku: string;
        nombre: string;
        categoria: string;
        ubicacion: string | null;
        stock: number;
        costo: number;
        valor: number;
        minimo: number;
      }[]
    >`
      SELECT p.id, p.sku, p.nombre, c.nombre AS categoria, p.ubicacion,
             COALESCE(SUM(s.cantidad), 0)::float AS stock,
             p."costoPromedio"::float AS costo,
             COALESCE(SUM(s.cantidad * s."costoPromedio"), 0)::float AS valor,
             p."stockMinimo"::float AS minimo
      FROM producto p
      JOIN categoria c ON c.id = p."categoriaId"
      LEFT JOIN stock s ON s."productoId" = p.id ${filtroAlmacen}
      WHERE p.activo = true AND p."esServicio" = false
      GROUP BY p.id, p.sku, p.nombre, c.nombre, p.ubicacion, p."costoPromedio", p."stockMinimo"
      ORDER BY p.nombre ASC
      LIMIT 300
    `,
    db.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total FROM (
        SELECT p.id
        FROM producto p
        LEFT JOIN stock s ON s."productoId" = p.id
        WHERE p.activo = true AND p."esServicio" = false AND p."stockMinimo" > 0
        GROUP BY p.id, p."stockMinimo"
        HAVING COALESCE(SUM(s.cantidad), 0) <= p."stockMinimo"
      ) t
    `,
    db.movimientoInventario.findMany({
      where: almacenFiltro ? { almacenId: almacenFiltro } : {},
      include: { producto: true, almacen: true, usuario: true },
      orderBy: { id: 'desc' },
      take: 80,
    }),
  ]);

  const totalValorizado = valorizado.reduce((acc, p) => acc + p.valor, 0);
  const totalUnidades = valorizado.reduce((acc, p) => acc + p.stock, 0);
  const productosCriticos = Number(bajoMinimo[0]?.total ?? 0);

  const productosParaSelect = valorizado.map((p) => ({
    id: p.id,
    nombre: `${p.sku} — ${p.nombre}`,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Inventario</h1>
          <p className="text-sm text-slate-500">Kardex valorizado por costo promedio ponderado</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PanelLateral titulo="Ajuste de inventario" etiquetaBoton="Ajustar stock" varianteBoton="secundario">
            <FormularioAjuste
              productos={productosParaSelect}
              almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
            />
          </PanelLateral>
          <PanelLateral titulo="Transferencia entre almacenes" etiquetaBoton="Transferir">
            <FormularioTransferencia
              productos={productosParaSelect}
              almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
            />
          </PanelLateral>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="tarjeta border-l-4 border-l-marca-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Valor del inventario</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(totalValorizado)}</p>
          <p className="text-xs text-slate-500">a costo promedio</p>
        </div>
        <div className="tarjeta border-l-4 border-l-slate-400 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Unidades en stock</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{fmtCantidad(totalUnidades)}</p>
          <p className="text-xs text-slate-500">{valorizado.length} productos</p>
        </div>
        <div
          className={`tarjeta border-l-4 p-4 ${productosCriticos > 0 ? 'border-l-red-500' : 'border-l-emerald-500'}`}
        >
          <p className="text-xs font-semibold uppercase text-slate-500">Bajo el mínimo</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{productosCriticos}</p>
          <p className="text-xs text-slate-500">productos por reponer</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={{ pathname: '/inventario', query: { ...filtros, vista: 'stock' } }}
          className={vista === 'stock' ? 'boton-primario' : 'boton-secundario'}
        >
          Stock valorizado
        </Link>
        <Link
          href={{ pathname: '/inventario', query: { ...filtros, vista: 'kardex' } }}
          className={vista === 'kardex' ? 'boton-primario' : 'boton-secundario'}
        >
          Kardex general
        </Link>

        <form className="ml-auto flex items-end gap-2">
          <input type="hidden" name="vista" value={vista} />
          <label>
            <span className="etiqueta-campo">Almacén</span>
            <select name="almacen" defaultValue={filtros.almacen ?? ''} className="campo">
              <option value="">Todos</option>
              {almacenes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="boton-secundario">
            Aplicar
          </button>
        </form>
      </div>

      {vista === 'stock' ? (
        <section className="tarjeta overflow-hidden">
          {valorizado.length === 0 ? (
            <SinDatos />
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Ubic.</th>
                    <th className="text-right">Stock</th>
                    <th className="text-right">Mínimo</th>
                    <th className="text-right">Costo</th>
                    <th className="text-right">Valorizado</th>
                  </tr>
                </thead>
                <tbody>
                  {valorizado.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs">{p.sku}</td>
                      <td className="max-w-[300px]">
                        <Link
                          href={`/productos/${p.id}`}
                          className="block truncate text-sm hover:text-marca-700"
                        >
                          {p.nombre}
                        </Link>
                      </td>
                      <td className="text-xs text-slate-600">{p.categoria}</td>
                      <td className="text-xs text-slate-500">{p.ubicacion ?? '—'}</td>
                      <td
                        className={`text-right font-semibold ${
                          p.minimo > 0 && p.stock <= p.minimo ? 'text-red-600' : 'text-slate-800'
                        }`}
                      >
                        {fmtCantidad(p.stock)}
                      </td>
                      <td className="text-right text-xs text-slate-500">
                        {fmtCantidad(p.minimo)}
                      </td>
                      <td className="text-right text-xs">{soles(p.costo)}</td>
                      <td className="text-right font-medium">{soles(p.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="tarjeta overflow-hidden">
          {movimientos.length === 0 ? (
            <SinDatos mensaje="Sin movimientos registrados." />
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Movimiento</th>
                    <th>Almacén</th>
                    <th>Referencia</th>
                    <th>Usuario</th>
                    <th className="text-right">Cant.</th>
                    <th className="text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => {
                    const entrada = m.tipo.startsWith('ENTRADA') || m.tipo === 'INVENTARIO_INICIAL';
                    return (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap text-xs text-slate-600">
                          {fechaHora(m.fecha)}
                        </td>
                        <td className="max-w-[240px]">
                          <Link
                            href={`/productos/${m.productoId}`}
                            className="block truncate text-sm hover:text-marca-700"
                          >
                            {m.producto.nombre}
                          </Link>
                          <span className="font-mono text-[11px] text-slate-400">
                            {m.producto.sku}
                          </span>
                        </td>
                        <td>
                          <Insignia color={entrada ? 'verde' : 'ambar'}>
                            {etiqueta(m.tipo)}
                          </Insignia>
                        </td>
                        <td className="text-xs">{m.almacen.nombre}</td>
                        <td className="max-w-[180px] truncate text-xs text-slate-600">
                          {m.referencia ?? '—'}
                        </td>
                        <td className="text-xs text-slate-500">{m.usuario?.nombre ?? '—'}</td>
                        <td
                          className={`text-right font-semibold ${entrada ? 'text-emerald-700' : 'text-red-700'}`}
                        >
                          {entrada ? '+' : '−'}
                          {fmtCantidad(m.cantidad)}
                        </td>
                        <td className="text-right">{fmtCantidad(m.saldoCantidad)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles, cantidad as fmtCantidad, num } from '@/lib/money';
import { SinDatos, Insignia } from '@/components/ui/basicos';
import { PanelLateral } from '@/components/ui/panel-lateral';
import { FormularioProducto } from './formulario';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const POR_PAGINA = 40;

export default async function PaginaProductos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; estado?: string; pagina?: string }>;
}) {
  await requerirUsuario();
  const filtros = await searchParams;
  const pagina = Math.max(1, Number(filtros.pagina ?? 1));

  const where: Prisma.ProductoWhereInput = {
    ...(filtros.categoria ? { categoriaId: Number(filtros.categoria) } : {}),
    ...(filtros.estado === 'inactivos'
      ? { activo: false }
      : filtros.estado === 'todos'
        ? {}
        : { activo: true }),
    ...(filtros.q
      ? {
          OR: [
            { sku: { contains: filtros.q, mode: 'insensitive' } },
            { nombre: { contains: filtros.q, mode: 'insensitive' } },
            { codigosAlterno: { some: { codigo: { contains: filtros.q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };

  const [productos, total, categorias, marcas, almacenes] = await Promise.all([
    db.producto.findMany({
      where,
      include: { categoria: true, marca: true, stocks: true },
      orderBy: { nombre: 'asc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    db.producto.count({ where }),
    db.categoria.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    db.marca.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    db.almacen.findMany({ where: { activo: true }, orderBy: { predeterminado: 'desc' } }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Productos</h1>
          <p className="text-sm text-slate-500">{total} registros</p>
        </div>
        <div className="flex gap-2">
          <Link href="/productos/catalogos" className="boton-secundario">
            Categorías y marcas
          </Link>
          <PanelLateral titulo="Nuevo producto" etiquetaBoton="Nuevo producto" ancho="max-w-2xl">
            <FormularioProducto
              categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
              marcas={marcas.map((m) => ({ id: m.id, nombre: m.nombre }))}
              almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
            />
          </PanelLateral>
        </div>
      </div>

      <form className="tarjeta grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="lg:col-span-2">
          <span className="etiqueta-campo">Buscar</span>
          <input
            name="q"
            defaultValue={filtros.q ?? ''}
            placeholder="Código, nombre o código equivalente"
            className="campo"
          />
        </label>
        <label>
          <span className="etiqueta-campo">Categoría</span>
          <select name="categoria" defaultValue={filtros.categoria ?? ''} className="campo">
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiqueta-campo">Estado</span>
          <select name="estado" defaultValue={filtros.estado ?? 'activos'} className="campo">
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button type="submit" className="boton-primario">
            Filtrar
          </button>
          <Link href="/productos" className="boton-secundario">
            Limpiar
          </Link>
        </div>
      </form>

      <section className="tarjeta overflow-hidden">
        {productos.length === 0 ? (
          <SinDatos mensaje="No hay productos con esos filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th className="text-right">Costo</th>
                  <th className="text-right">Público</th>
                  <th className="text-right">Técnico</th>
                  <th className="text-right">Stock</th>
                  <th>Ubic.</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => {
                  const stock = p.stocks.reduce((acc, s) => acc + num(s.cantidad, 3), 0);
                  const bajo = !p.esServicio && stock <= num(p.stockMinimo, 3);

                  return (
                    <tr key={p.id}>
                      <td className="font-mono text-xs">{p.sku}</td>
                      <td className="max-w-[320px]">
                        <Link
                          href={`/productos/${p.id}`}
                          className="block truncate text-sm font-medium text-slate-800 hover:text-marca-700"
                        >
                          {p.nombre}
                        </Link>
                        <p className="text-[11px] text-slate-500">
                          {p.marca?.nombre ?? 'Sin marca'}
                          {!p.activo && ' · inactivo'}
                        </p>
                      </td>
                      <td className="text-xs text-slate-600">{p.categoria.nombre}</td>
                      <td className="text-right text-xs text-slate-600">
                        {soles(p.costoPromedio)}
                      </td>
                      <td className="text-right font-semibold">{soles(p.precioVenta)}</td>
                      <td className="text-right text-sm text-slate-600">
                        {soles(p.precioTecnico)}
                      </td>
                      <td className="text-right">
                        {p.esServicio ? (
                          <Insignia color="azul">servicio</Insignia>
                        ) : (
                          <span
                            className={
                              bajo ? 'font-bold text-red-600' : 'font-medium text-slate-700'
                            }
                          >
                            {fmtCantidad(stock)}
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-slate-500">{p.ubicacion ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {totalPaginas > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: totalPaginas }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 2)
            .map((p) => (
              <Link
                key={p}
                href={{ pathname: '/productos', query: { ...filtros, pagina: String(p) } }}
                className={
                  p === pagina
                    ? 'rounded-md bg-marca-600 px-3 py-1.5 text-sm font-semibold text-white'
                    : 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50'
                }
              >
                {p}
              </Link>
            ))}
        </nav>
      )}
    </div>
  );
}

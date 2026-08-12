import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles, cantidad as fmtCantidad, num } from '@/lib/money';
import { fechaHora, etiqueta } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { PanelLateral } from '@/components/ui/panel-lateral';
import { FormularioProducto } from '../formulario';
import { CodigosYAplicaciones } from './codigos-aplicaciones';

export const dynamic = 'force-dynamic';

export default async function DetalleProducto({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario();
  const { id } = await params;

  const producto = await db.producto.findUnique({
    where: { id: Number(id) },
    include: {
      categoria: true,
      marca: true,
      stocks: { include: { almacen: true } },
      codigosAlterno: true,
      aplicaciones: { include: { marcaMoto: true, modeloMoto: true } },
    },
  });

  if (!producto) notFound();

  const [movimientos, categorias, marcas, almacenes, marcasMoto, modelosMoto] = await Promise.all([
    db.movimientoInventario.findMany({
      where: { productoId: producto.id },
      include: { almacen: true, usuario: true },
      orderBy: { id: 'desc' },
      take: 40,
    }),
    db.categoria.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    db.marca.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    db.almacen.findMany({ where: { activo: true } }),
    db.marcaMoto.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    db.modeloMoto.findMany({ orderBy: { nombre: 'asc' } }),
  ]);

  const stockTotal = producto.stocks.reduce((acc, s) => acc + num(s.cantidad, 3), 0);
  const valorizado = producto.stocks.reduce(
    (acc, s) => acc + num(s.cantidad, 3) * num(s.costoPromedio, 4),
    0,
  );
  const margen =
    num(producto.precioVenta) > 0
      ? ((num(producto.precioVenta) / 1.18 - num(producto.costoPromedio)) /
          (num(producto.precioVenta) / 1.18)) *
        100
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/productos" className="text-xs font-semibold text-marca-600 hover:underline">
            ← Productos
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-800">{producto.nombre}</h1>
          <p className="text-sm text-slate-500">
            <span className="font-mono">{producto.sku}</span> · {producto.categoria.nombre}
            {producto.marca && ` · ${producto.marca.nombre}`}
            {!producto.activo && ' · INACTIVO'}
          </p>
        </div>

        <PanelLateral
          titulo="Editar producto"
          etiquetaBoton="Editar"
          varianteBoton="secundario"
          ancho="max-w-2xl"
        >
          <FormularioProducto
            categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
            marcas={marcas.map((m) => ({ id: m.id, nombre: m.nombre }))}
            almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
            producto={{
              id: producto.id,
              sku: producto.sku,
              nombre: producto.nombre,
              descripcion: producto.descripcion,
              categoriaId: producto.categoriaId,
              marcaId: producto.marcaId,
              unidadMedida: producto.unidadMedida,
              afectacionIgv: producto.afectacionIgv,
              esServicio: producto.esServicio,
              precioVenta: num(producto.precioVenta),
              precioTecnico: num(producto.precioTecnico),
              precioMayorista: num(producto.precioMayorista),
              stockMinimo: num(producto.stockMinimo, 3),
              stockMaximo: num(producto.stockMaximo, 3),
              ubicacion: producto.ubicacion,
              activo: producto.activo,
            }}
          />
        </PanelLateral>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="tarjeta p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Stock total</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {producto.esServicio ? '—' : fmtCantidad(stockTotal)}
          </p>
          <p className="text-xs text-slate-500">mínimo {fmtCantidad(producto.stockMinimo)}</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Costo promedio</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(producto.costoPromedio)}</p>
          <p className="text-xs text-slate-500">último {soles(producto.ultimoCosto)}</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Precio público</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(producto.precioVenta)}</p>
          <p className="text-xs text-slate-500">margen {margen.toFixed(1)}%</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Valorizado</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(valorizado)}</p>
          <p className="text-xs text-slate-500">Ubic. {producto.ubicacion ?? '—'}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="tarjeta">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Stock por almacén
          </h2>
          {producto.stocks.length === 0 ? (
            <SinDatos mensaje="Sin stock registrado." />
          ) : (
            <table className="tabla">
              <tbody>
                {producto.stocks.map((s) => (
                  <tr key={s.id}>
                    <td>{s.almacen.nombre}</td>
                    <td className="text-right font-semibold">{fmtCantidad(s.cantidad)}</td>
                    <td className="text-right text-xs text-slate-500">
                      costo {soles(s.costoPromedio)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <CodigosYAplicaciones
          productoId={producto.id}
          codigos={producto.codigosAlterno.map((c) => ({
            id: c.id,
            codigo: c.codigo,
            tipo: c.tipo,
            nota: c.nota,
          }))}
          aplicaciones={producto.aplicaciones.map((a) => ({
            id: a.id,
            marca: a.marcaMoto.nombre,
            modelo: a.modeloMoto?.nombre ?? null,
            anioDesde: a.anioDesde,
            anioHasta: a.anioHasta,
          }))}
          marcasMoto={marcasMoto.map((m) => ({ id: m.id, nombre: m.nombre }))}
          modelosMoto={modelosMoto.map((m) => ({
            id: m.id,
            nombre: m.nombre,
            marcaMotoId: m.marcaMotoId,
          }))}
        />
      </div>

      <section className="tarjeta overflow-hidden">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Kardex — últimos movimientos
        </h2>
        {movimientos.length === 0 ? (
          <SinDatos mensaje="Este producto todavía no tiene movimientos." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Movimiento</th>
                  <th>Almacén</th>
                  <th>Referencia</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">Costo unit.</th>
                  <th className="text-right">Saldo</th>
                  <th className="text-right">Valorizado</th>
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
                      <td>
                        <Insignia color={entrada ? 'verde' : 'ambar'}>
                          {etiqueta(m.tipo)}
                        </Insignia>
                      </td>
                      <td className="text-xs">{m.almacen.nombre}</td>
                      <td className="max-w-[200px] truncate text-xs text-slate-600">
                        {m.referencia ?? '—'}
                        {m.nota && <span className="block text-[11px] text-slate-400">{m.nota}</span>}
                      </td>
                      <td
                        className={`text-right font-semibold ${entrada ? 'text-emerald-700' : 'text-red-700'}`}
                      >
                        {entrada ? '+' : '−'}
                        {fmtCantidad(m.cantidad)}
                      </td>
                      <td className="text-right text-xs">{soles(m.costoUnitario)}</td>
                      <td className="text-right font-medium">{fmtCantidad(m.saldoCantidad)}</td>
                      <td className="text-right text-xs text-slate-600">
                        {soles(num(m.saldoCantidad, 3) * num(m.saldoCosto, 4))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

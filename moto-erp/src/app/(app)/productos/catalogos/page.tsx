import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { SinDatos } from '@/components/ui/basicos';
import { FormulariosCatalogo } from './formularios';

export const dynamic = 'force-dynamic';

export default async function PaginaCatalogos() {
  await requerirUsuario();

  const [categorias, marcas, marcasMoto, modelosMoto] = await Promise.all([
    db.categoria.findMany({
      include: { _count: { select: { productos: true } } },
      orderBy: { nombre: 'asc' },
    }),
    db.marca.findMany({
      include: { _count: { select: { productos: true } } },
      orderBy: { nombre: 'asc' },
    }),
    db.marcaMoto.findMany({
      include: { _count: { select: { modelos: true } } },
      orderBy: { nombre: 'asc' },
    }),
    db.modeloMoto.findMany({ include: { marcaMoto: true }, orderBy: { nombre: 'asc' } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/productos" className="text-xs font-semibold text-marca-600 hover:underline">
          ← Productos
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-800">Categorías y marcas</h1>
        <p className="text-sm text-slate-500">
          Las listas que alimentan el catálogo y la búsqueda por compatibilidad.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Líneas de producto ({categorias.length})
          </h2>
          {categorias.length === 0 ? (
            <SinDatos />
          ) : (
            <table className="tabla">
              <tbody>
                {categorias.map((c) => (
                  <tr key={c.id}>
                    <td className="text-sm font-medium">{c.nombre}</td>
                    <td className="text-xs text-slate-500">{c.detalle ?? ''}</td>
                    <td className="text-right text-xs text-slate-500">
                      {c._count.productos} productos
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Marcas de repuestos ({marcas.length})
          </h2>
          {marcas.length === 0 ? (
            <SinDatos />
          ) : (
            <div className="flex flex-wrap gap-2 p-4">
              {marcas.map((m) => (
                <span
                  key={m.id}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                >
                  {m.nombre}
                  <span className="ml-1 text-xs text-slate-400">{m._count.productos}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Marcas y modelos de motos
          </h2>
          {marcasMoto.length === 0 ? (
            <SinDatos />
          ) : (
            <ul className="divide-y divide-slate-100">
              {marcasMoto.map((mm) => (
                <li key={mm.id} className="px-4 py-2.5">
                  <p className="text-sm font-semibold text-slate-800">{mm.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {modelosMoto
                      .filter((mo) => mo.marcaMotoId === mm.id)
                      .map((mo) => mo.nombre)
                      .join(' · ') || 'sin modelos cargados'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <FormulariosCatalogo
          marcasMoto={marcasMoto.map((m) => ({ id: m.id, nombre: m.nombre }))}
        />
      </div>
    </div>
  );
}

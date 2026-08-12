import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirRol, ROLES_ADMIN } from '@/lib/auth';
import { soles, num } from '@/lib/money';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { PanelLateral } from '@/components/ui/panel-lateral';
import { FormularioAlmacen } from './formulario';

export const dynamic = 'force-dynamic';

export default async function PaginaAlmacenes() {
  await requerirRol(...ROLES_ADMIN);

  const almacenes = await db.almacen.findMany({
    include: { stocks: true, _count: { select: { ventas: true, ordenes: true } } },
    orderBy: { id: 'asc' },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/configuracion"
            className="text-xs font-semibold text-marca-600 hover:underline"
          >
            ← Configuración
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-800">Almacenes</h1>
        </div>
        <PanelLateral titulo="Nuevo almacén" etiquetaBoton="Nuevo almacén">
          <FormularioAlmacen />
        </PanelLateral>
      </div>

      <section className="tarjeta overflow-hidden">
        {almacenes.length === 0 ? (
          <SinDatos />
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Almacén</th>
                <th>Dirección</th>
                <th className="text-right">Productos con stock</th>
                <th className="text-right">Valorizado</th>
                <th>Etiquetas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {almacenes.map((a) => {
                const conStock = a.stocks.filter((s) => num(s.cantidad, 3) > 0).length;
                const valor = a.stocks.reduce(
                  (acc, s) => acc + num(s.cantidad, 3) * num(s.costoPromedio, 4),
                  0,
                );
                return (
                  <tr key={a.id}>
                    <td className="text-sm font-medium">{a.nombre}</td>
                    <td className="text-xs text-slate-600">{a.direccion ?? '—'}</td>
                    <td className="text-right text-sm">{conStock}</td>
                    <td className="text-right font-semibold">{soles(valor)}</td>
                    <td className="space-x-1">
                      {a.predeterminado && <Insignia color="azul">predeterminado</Insignia>}
                      {a.esTaller && <Insignia color="violeta">taller</Insignia>}
                      <Insignia color={a.activo ? 'verde' : 'gris'}>
                        {a.activo ? 'activo' : 'inactivo'}
                      </Insignia>
                    </td>
                    <td className="text-right">
                      <PanelLateral
                        titulo={`Editar ${a.nombre}`}
                        etiquetaBoton="Editar"
                        varianteBoton="secundario"
                      >
                        <FormularioAlmacen
                          almacen={{
                            id: a.id,
                            nombre: a.nombre,
                            direccion: a.direccion,
                            esTaller: a.esTaller,
                            predeterminado: a.predeterminado,
                            activo: a.activo,
                          }}
                        />
                      </PanelLateral>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <p className="text-xs text-slate-500">
        El almacén marcado como <strong>taller</strong> es el que se sugiere al recibir motos; sus
        repuestos salen del stock cuando el técnico los instala.
      </p>
    </div>
  );
}

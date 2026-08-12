import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles, num } from '@/lib/money';
import { etiqueta } from '@/lib/format';
import { SinDatos } from '@/components/ui/basicos';
import { PanelLateral } from '@/components/ui/panel-lateral';
import { FormularioProveedor } from './formulario';

export const dynamic = 'force-dynamic';

export default async function PaginaProveedores() {
  await requerirUsuario();

  const proveedores = await db.proveedor.findMany({
    include: {
      cuentas: { where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } } },
      _count: { select: { compras: true } },
    },
    orderBy: { razonSocial: 'asc' },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Proveedores</h1>
          <p className="text-sm text-slate-500">{proveedores.length} registros</p>
        </div>
        <PanelLateral titulo="Nuevo proveedor" etiquetaBoton="Nuevo proveedor">
          <FormularioProveedor />
        </PanelLateral>
      </div>

      <section className="tarjeta overflow-hidden">
        {proveedores.length === 0 ? (
          <SinDatos mensaje="Aún no hay proveedores registrados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>RUC</th>
                  <th>Contacto</th>
                  <th className="text-right">Días crédito</th>
                  <th className="text-right">Compras</th>
                  <th className="text-right">Por pagar</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((p) => {
                  const deuda = p.cuentas.reduce((acc, c) => acc + num(c.saldo), 0);
                  return (
                    <tr key={p.id} className={p.activo ? undefined : 'opacity-60'}>
                      <td className="max-w-[300px]">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {p.razonSocial}
                        </p>
                        {p.direccion && (
                          <p className="truncate text-[11px] text-slate-500">{p.direccion}</p>
                        )}
                      </td>
                      <td className="font-mono text-xs">{p.numeroDocumento}</td>
                      <td className="text-xs text-slate-600">
                        {p.contacto ?? '—'}
                        {p.telefono && <span className="block text-slate-400">{p.telefono}</span>}
                      </td>
                      <td className="text-right text-xs">{p.diasCredito}</td>
                      <td className="text-right text-xs text-slate-600">{p._count.compras}</td>
                      <td className="text-right">
                        {deuda > 0 ? (
                          <span className="font-semibold text-amber-700">{soles(deuda)}</span>
                        ) : (
                          <span className="text-xs text-slate-400">al día</span>
                        )}
                      </td>
                      <td className="text-right">
                        <PanelLateral
                          titulo={`Editar ${p.razonSocial}`}
                          etiquetaBoton="Editar"
                          varianteBoton="secundario"
                        >
                          <FormularioProveedor
                            proveedor={{
                              id: p.id,
                              tipoDocumento: p.tipoDocumento,
                              numeroDocumento: p.numeroDocumento,
                              razonSocial: p.razonSocial,
                              direccion: p.direccion,
                              telefono: p.telefono,
                              email: p.email,
                              contacto: p.contacto,
                              diasCredito: p.diasCredito,
                              activo: p.activo,
                            }}
                          />
                        </PanelLateral>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Los estados de cuenta ({etiqueta('PENDIENTE')} / {etiqueta('PARCIAL')}) se gestionan desde
        Cuentas corrientes.
      </p>
    </div>
  );
}

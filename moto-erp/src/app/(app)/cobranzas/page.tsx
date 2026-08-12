import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles, num } from '@/lib/money';
import { fecha as fmtFecha, etiqueta, inicioDia } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { colorEstado } from '@/lib/estados';
import { numeroComprobante } from '@/lib/sunat/catalogos';
import { PanelLateral } from '@/components/ui/panel-lateral';
import { FormularioCobro, FormularioPagoProveedor } from './formularios';

export const dynamic = 'force-dynamic';

export default async function PaginaCobranzas({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  await requerirUsuario();
  const { vista = 'cobrar' } = await searchParams;
  const hoy = inicioDia();

  const [porCobrar, porPagar, totalCobrar, totalPagar] = await Promise.all([
    db.cuentaPorCobrar.findMany({
      where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      include: { cliente: true, venta: true },
      orderBy: { fechaVencimiento: 'asc' },
      take: 200,
    }),
    db.cuentaPorPagar.findMany({
      where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      include: { proveedor: true, compra: true },
      orderBy: { fechaVencimiento: 'asc' },
      take: 200,
    }),
    db.cuentaPorCobrar.aggregate({
      where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      _sum: { saldo: true },
    }),
    db.cuentaPorPagar.aggregate({
      where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      _sum: { saldo: true },
    }),
  ]);

  const vencidasCobrar = porCobrar.filter((c) => c.fechaVencimiento < hoy);
  const vencidasPagar = porPagar.filter((c) => c.fechaVencimiento < hoy);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Cuentas corrientes</h1>
        <p className="text-sm text-slate-500">Créditos otorgados y deudas con proveedores</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="tarjeta border-l-4 border-l-emerald-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Por cobrar</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {soles(totalCobrar._sum.saldo ?? 0)}
          </p>
          <p className="text-xs text-slate-500">{porCobrar.length} cuentas</p>
        </div>
        <div className="tarjeta border-l-4 border-l-red-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Vencido por cobrar</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {soles(vencidasCobrar.reduce((a, c) => a + num(c.saldo), 0))}
          </p>
          <p className="text-xs text-slate-500">{vencidasCobrar.length} cuentas vencidas</p>
        </div>
        <div className="tarjeta border-l-4 border-l-amber-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Por pagar</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {soles(totalPagar._sum.saldo ?? 0)}
          </p>
          <p className="text-xs text-slate-500">{porPagar.length} cuentas</p>
        </div>
        <div className="tarjeta border-l-4 border-l-slate-400 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Posición neta</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {soles(num(totalCobrar._sum.saldo ?? 0) - num(totalPagar._sum.saldo ?? 0))}
          </p>
          <p className="text-xs text-slate-500">cobrar − pagar</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href="/cobranzas?vista=cobrar"
          className={vista === 'cobrar' ? 'boton-primario' : 'boton-secundario'}
        >
          Por cobrar ({porCobrar.length})
        </Link>
        <Link
          href="/cobranzas?vista=pagar"
          className={vista === 'pagar' ? 'boton-primario' : 'boton-secundario'}
        >
          Por pagar ({porPagar.length})
        </Link>
      </div>

      {vista === 'cobrar' ? (
        <section className="tarjeta overflow-hidden">
          {porCobrar.length === 0 ? (
            <SinDatos mensaje="No hay cuentas por cobrar pendientes." />
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Comprobante</th>
                    <th>Emisión</th>
                    <th>Vence</th>
                    <th className="text-right">Original</th>
                    <th className="text-right">Saldo</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {porCobrar.map((c) => {
                    const vencida = c.fechaVencimiento < hoy;
                    const diasVencida = Math.floor(
                      (hoy.getTime() - c.fechaVencimiento.getTime()) / 86400000,
                    );

                    return (
                      <tr key={c.id} className={vencida ? 'bg-red-50/50' : undefined}>
                        <td className="max-w-[220px] truncate text-sm">{c.cliente.nombre}</td>
                        <td>
                          <Link
                            href={`/ventas/${c.ventaId}`}
                            className="font-mono text-xs font-semibold text-marca-700 hover:underline"
                          >
                            {numeroComprobante(c.venta.serie, c.venta.correlativo)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-xs text-slate-600">
                          {fmtFecha(c.fechaEmision)}
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          {fmtFecha(c.fechaVencimiento)}
                          {vencida && (
                            <span className="block text-[11px] font-semibold text-red-600">
                              {diasVencida} días vencida
                            </span>
                          )}
                        </td>
                        <td className="text-right text-xs text-slate-600">
                          {soles(c.montoOriginal)}
                        </td>
                        <td className="text-right font-bold text-amber-700">{soles(c.saldo)}</td>
                        <td>
                          <Insignia color={colorEstado(c.estado)}>{etiqueta(c.estado)}</Insignia>
                        </td>
                        <td className="text-right">
                          <PanelLateral
                            titulo={`Cobrar a ${c.cliente.nombre}`}
                            etiquetaBoton="Cobrar"
                          >
                            <FormularioCobro
                              cuentaId={c.id}
                              cliente={c.cliente.nombre}
                              comprobante={numeroComprobante(c.venta.serie, c.venta.correlativo)}
                              saldo={num(c.saldo)}
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
      ) : (
        <section className="tarjeta overflow-hidden">
          {porPagar.length === 0 ? (
            <SinDatos mensaje="No hay cuentas por pagar pendientes." />
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Documento</th>
                    <th>Emisión</th>
                    <th>Vence</th>
                    <th className="text-right">Original</th>
                    <th className="text-right">Saldo</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {porPagar.map((c) => {
                    const vencida = c.fechaVencimiento < hoy;
                    const documento =
                      [c.compra.serie, c.compra.numero].filter(Boolean).join('-') ||
                      `#${c.compraId}`;

                    return (
                      <tr key={c.id} className={vencida ? 'bg-red-50/50' : undefined}>
                        <td className="max-w-[240px] truncate text-sm">
                          {c.proveedor.razonSocial}
                        </td>
                        <td>
                          <Link
                            href={`/compras/${c.compraId}`}
                            className="font-mono text-xs font-semibold text-marca-700 hover:underline"
                          >
                            {documento}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-xs text-slate-600">
                          {fmtFecha(c.fechaEmision)}
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          {fmtFecha(c.fechaVencimiento)}
                          {vencida && (
                            <span className="block text-[11px] font-semibold text-red-600">
                              vencida
                            </span>
                          )}
                        </td>
                        <td className="text-right text-xs text-slate-600">
                          {soles(c.montoOriginal)}
                        </td>
                        <td className="text-right font-bold text-amber-700">{soles(c.saldo)}</td>
                        <td>
                          <Insignia color={colorEstado(c.estado)}>{etiqueta(c.estado)}</Insignia>
                        </td>
                        <td className="text-right">
                          <PanelLateral
                            titulo={`Pagar a ${c.proveedor.razonSocial}`}
                            etiquetaBoton="Pagar"
                          >
                            <FormularioPagoProveedor
                              cuentaId={c.id}
                              proveedor={c.proveedor.razonSocial}
                              documento={documento}
                              saldo={num(c.saldo)}
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
      )}
    </div>
  );
}

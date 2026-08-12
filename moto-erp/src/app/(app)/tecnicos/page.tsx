import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles, num, porcentaje } from '@/lib/money';
import { fecha as fmtFecha, fechaIso, etiqueta } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { colorEstado } from '@/lib/estados';
import { PanelLateral } from '@/components/ui/panel-lateral';
import { FormularioTecnico, FormularioLiquidacion, BotonVincularCliente } from './formularios';

export const dynamic = 'force-dynamic';

export default async function PaginaTecnicos() {
  await requerirUsuario();

  const [tecnicos, comisionesPendientes, ultimasLiquidaciones] = await Promise.all([
    db.tecnico.findMany({
      include: {
        cliente: { include: { cuentas: { where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } } } } },
        _count: { select: { ordenes: true, ventas: true } },
      },
      orderBy: { nombre: 'asc' },
    }),
    db.comision.groupBy({
      by: ['tecnicoId'],
      where: { estado: 'PENDIENTE' },
      _sum: { monto: true },
      _count: true,
    }),
    db.liquidacionComision.findMany({
      include: { tecnico: true, usuario: true },
      orderBy: { id: 'desc' },
      take: 10,
    }),
  ]);

  const pendientePorTecnico = new Map(
    comisionesPendientes.map((c) => [c.tecnicoId, { monto: num(c._sum.monto ?? 0), cantidad: c._count }]),
  );

  const totalPendiente = comisionesPendientes.reduce((acc, c) => acc + num(c._sum.monto ?? 0), 0);

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Técnicos</h1>
          <p className="text-sm text-slate-500">
            {tecnicos.length} registrados · {soles(totalPendiente)} en comisiones por pagar
          </p>
        </div>
        <div className="flex gap-2">
          <PanelLateral
            titulo="Liquidar comisiones"
            etiquetaBoton="Liquidar comisiones"
            varianteBoton="secundario"
          >
            <FormularioLiquidacion
              tecnicos={tecnicos.map((t) => ({
                id: t.id,
                nombre: t.nombre,
                pendiente: pendientePorTecnico.get(t.id)?.monto ?? 0,
              }))}
              fechaDesde={fechaIso(inicioMes)}
              fechaHasta={fechaIso(hoy)}
            />
          </PanelLateral>
          <PanelLateral titulo="Nuevo técnico" etiquetaBoton="Nuevo técnico">
            <FormularioTecnico />
          </PanelLateral>
        </div>
      </div>

      <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        Los técnicos mueven producto de dos formas: <strong>compran repuestos</strong> con precio de
        técnico (y línea de crédito si tienen ficha de cliente), y <strong>ejecutan servicios</strong>{' '}
        en las órdenes de trabajo. La comisión de venta se calcula sobre el valor de venta sin IGV
        del comprobante que traen; la de servicio, sobre la mano de obra que ejecutan.
      </p>

      <section className="tarjeta overflow-hidden">
        {tecnicos.length === 0 ? (
          <SinDatos mensaje="Aún no hay técnicos registrados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Técnico</th>
                  <th>Contacto</th>
                  <th className="text-right">% venta</th>
                  <th className="text-right">% servicio</th>
                  <th className="text-right">Órdenes</th>
                  <th className="text-right">Deuda</th>
                  <th className="text-right">Comisión pendiente</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tecnicos.map((t) => {
                  const pendiente = pendientePorTecnico.get(t.id);
                  const deuda =
                    t.cliente?.cuentas.reduce((acc, c) => acc + num(c.saldo), 0) ?? 0;

                  return (
                    <tr key={t.id} className={t.activo ? undefined : 'opacity-60'}>
                      <td>
                        <p className="text-sm font-medium text-slate-800">{t.nombre}</p>
                        <p className="text-[11px] text-slate-500">
                          {t.taller ?? 'Sin taller registrado'}
                          {t.documento && ` · ${t.documento}`}
                        </p>
                      </td>
                      <td className="text-xs text-slate-600">{t.telefono ?? '—'}</td>
                      <td className="text-right text-sm">{porcentaje(t.comisionVentaPct)}</td>
                      <td className="text-right text-sm">{porcentaje(t.comisionServicioPct)}</td>
                      <td className="text-right text-xs text-slate-600">{t._count.ordenes}</td>
                      <td className="text-right">
                        {t.cliente ? (
                          deuda > 0 ? (
                            <span className="font-semibold text-amber-700">{soles(deuda)}</span>
                          ) : (
                            <span className="text-xs text-slate-400">al día</span>
                          )
                        ) : (
                          <BotonVincularCliente tecnicoId={t.id} />
                        )}
                      </td>
                      <td className="text-right">
                        {pendiente ? (
                          <>
                            <span className="font-semibold text-slate-800">
                              {soles(pendiente.monto)}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              {pendiente.cantidad} conceptos
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <Link
                          href={`/tecnicos/${t.id}`}
                          className="mr-2 text-xs font-semibold text-marca-600 hover:underline"
                        >
                          Detalle
                        </Link>
                        <PanelLateral
                          titulo={`Editar ${t.nombre}`}
                          etiquetaBoton="Editar"
                          varianteBoton="secundario"
                        >
                          <FormularioTecnico
                            tecnico={{
                              id: t.id,
                              nombre: t.nombre,
                              documento: t.documento,
                              telefono: t.telefono,
                              taller: t.taller,
                              direccion: t.direccion,
                              comisionVentaPct: num(t.comisionVentaPct),
                              comisionServicioPct: num(t.comisionServicioPct),
                              activo: t.activo,
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

      <section className="tarjeta overflow-hidden">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Últimas liquidaciones
        </h2>
        {ultimasLiquidaciones.length === 0 ? (
          <SinDatos mensaje="Todavía no se liquidaron comisiones." />
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Técnico</th>
                <th>Periodo</th>
                <th>Medio</th>
                <th>Registró</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {ultimasLiquidaciones.map((l) => (
                <tr key={l.id}>
                  <td className="text-xs">{fmtFecha(l.fecha)}</td>
                  <td className="text-sm">{l.tecnico.nombre}</td>
                  <td className="text-xs text-slate-600">
                    {fmtFecha(l.fechaDesde)} — {fmtFecha(l.fechaHasta)}
                  </td>
                  <td>
                    <Insignia color={colorEstado('LIQUIDADA')}>{etiqueta(l.metodoPago)}</Insignia>
                  </td>
                  <td className="text-xs text-slate-500">{l.usuario.nombre}</td>
                  <td className="text-right font-semibold">{soles(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

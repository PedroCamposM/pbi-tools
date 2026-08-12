import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { resumenCaja } from '@/actions/caja';
import { soles, num } from '@/lib/money';
import { fechaHora, fecha as fmtFecha, etiqueta } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { colorEstado } from '@/lib/estados';
import { FormularioApertura, FormularioCierre, FormularioMovimiento } from './formularios';

export const dynamic = 'force-dynamic';

export default async function PaginaCaja() {
  const usuario = await requerirUsuario();

  const abierta = await db.cajaSesion.findFirst({
    where: { usuarioId: usuario.id, estado: 'ABIERTA' },
    orderBy: { id: 'desc' },
  });

  const cerradas = await db.cajaSesion.findMany({
    where: { estado: 'CERRADA' },
    include: { usuario: true },
    orderBy: { id: 'desc' },
    take: 12,
  });

  if (!abierta) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-slate-800">Caja</h1>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="tarjeta p-5">
            <h2 className="mb-1 text-base font-semibold text-slate-800">Abrir caja</h2>
            <p className="mb-4 text-sm text-slate-500">
              Ingresa el efectivo con el que empiezas el turno. Sin caja abierta no se pueden
              registrar cobros.
            </p>
            <FormularioApertura />
          </section>

          <HistorialCajas cajas={cerradas} />
        </div>
      </div>
    );
  }

  const resumen = await resumenCaja(abierta.id);

  const movimientos = await db.movimientoCaja.findMany({
    where: { cajaSesionId: abierta.id },
    orderBy: { id: 'desc' },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Caja abierta</h1>
          <p className="text-sm text-slate-500">
            Desde {fechaHora(abierta.fechaApertura)} · {resumen.usuario}
          </p>
        </div>
        <Insignia color="verde">Turno en curso</Insignia>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="tarjeta border-l-4 border-l-slate-400 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Apertura</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(resumen.montoApertura)}</p>
        </div>
        <div className="tarjeta border-l-4 border-l-emerald-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Ingresos en efectivo</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(resumen.efectivoIngresos)}</p>
        </div>
        <div className="tarjeta border-l-4 border-l-red-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Egresos en efectivo</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(resumen.efectivoEgresos)}</p>
        </div>
        <div className="tarjeta border-l-4 border-l-marca-500 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Debe haber en caja</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{soles(resumen.efectivoEsperado)}</p>
        </div>
      </div>

      <section className="tarjeta overflow-hidden">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Movimiento por medio de pago
        </h2>
        {resumen.porMetodo.length === 0 ? (
          <SinDatos mensaje="Aún no hay movimientos en este turno." />
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Medio</th>
                <th className="text-right">Ingresos</th>
                <th className="text-right">Egresos</th>
                <th className="text-right">Neto</th>
              </tr>
            </thead>
            <tbody>
              {resumen.porMetodo.map((m) => (
                <tr key={m.metodo}>
                  <td>{etiqueta(m.metodo)}</td>
                  <td className="text-right text-emerald-700">{soles(m.ingresos)}</td>
                  <td className="text-right text-red-700">{soles(m.egresos)}</td>
                  <td className="text-right font-semibold">{soles(m.neto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="tarjeta p-4 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Registrar movimiento</h2>
          <FormularioMovimiento />
        </section>

        <section className="tarjeta overflow-hidden lg:col-span-2">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Movimientos del turno ({movimientos.length})
          </h2>
          {movimientos.length === 0 ? (
            <SinDatos mensaje="Sin movimientos todavía." />
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="tabla">
                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        {fechaHora(m.fecha).slice(-5)}
                      </td>
                      <td className="max-w-[280px]">
                        <p className="truncate text-sm">{m.concepto}</p>
                        <p className="text-[11px] text-slate-400">
                          {m.categoria} · {etiqueta(m.metodoPago)}
                          {m.referencia && ` · ${m.referencia}`}
                        </p>
                      </td>
                      <td
                        className={`text-right font-semibold ${
                          m.tipo === 'INGRESO' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {m.tipo === 'INGRESO' ? '+' : '−'}
                        {soles(m.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="tarjeta p-5">
        <h2 className="mb-1 text-base font-semibold text-slate-800">Cerrar caja</h2>
        <p className="mb-4 text-sm text-slate-500">
          Cuenta el efectivo físico e ingresa el monto. El sistema calcula la diferencia contra{' '}
          {soles(resumen.efectivoEsperado)}.
        </p>
        <FormularioCierre cajaSesionId={abierta.id} esperado={resumen.efectivoEsperado} />
      </section>

      <HistorialCajas cajas={cerradas} />
    </div>
  );
}

function HistorialCajas({
  cajas,
}: {
  cajas: {
    id: number;
    fechaApertura: Date;
    fechaCierre: Date | null;
    montoApertura: unknown;
    montoCierre: unknown;
    montoEsperado: unknown;
    diferencia: unknown;
    estado: string;
    usuario: { nombre: string };
  }[];
}) {
  return (
    <section className="tarjeta overflow-hidden">
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
        Cierres anteriores
      </h2>
      {cajas.length === 0 ? (
        <SinDatos mensaje="Aún no hay cierres registrados." />
      ) : (
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Responsable</th>
                <th className="text-right">Apertura</th>
                <th className="text-right">Esperado</th>
                <th className="text-right">Contado</th>
                <th className="text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {cajas.map((c) => {
                const dif = num(c.diferencia as never);
                return (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap text-xs">
                      {fmtFecha(c.fechaCierre ?? c.fechaApertura)}
                    </td>
                    <td className="text-sm">{c.usuario.nombre}</td>
                    <td className="text-right text-xs">{soles(c.montoApertura as never)}</td>
                    <td className="text-right text-xs">{soles(c.montoEsperado as never)}</td>
                    <td className="text-right text-xs">{soles(c.montoCierre as never)}</td>
                    <td className="text-right">
                      <Insignia color={dif === 0 ? 'verde' : dif > 0 ? 'azul' : 'rojo'}>
                        {soles(dif)}
                      </Insignia>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        Una diferencia negativa significa que falta efectivo; una positiva, que sobra.{' '}
        <Link href="/reportes" className="font-semibold text-marca-600 hover:underline">
          Ver reportes
        </Link>
      </p>
    </section>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles, cantidad as fmtCantidad, num } from '@/lib/money';
import { fecha as fmtFecha, fechaHora, etiqueta } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { colorEstado } from '@/lib/estados';
import { numeroComprobante } from '@/lib/sunat/catalogos';
import {
  EstadoOrden,
  AgregarRepuesto,
  AgregarServicio,
  QuitarLinea,
  CerrarYFacturar,
} from './acciones';

export const dynamic = 'force-dynamic';

export default async function DetalleOrden({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirUsuario();
  const { id } = await params;

  const orden = await db.ordenTrabajo.findUnique({
    where: { id: Number(id) },
    include: {
      cliente: true,
      moto: { include: { marcaMoto: true, modeloMoto: true } },
      tecnico: true,
      almacen: true,
      usuario: true,
      repuestos: { include: { producto: true }, orderBy: { id: 'asc' } },
      servicios: { include: { producto: true, tecnico: true }, orderBy: { id: 'asc' } },
      venta: true,
    },
  });

  if (!orden) notFound();

  const [tecnicos, servicios, series, caja] = await Promise.all([
    db.tecnico.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    db.producto.findMany({
      where: { activo: true, esServicio: true },
      orderBy: { nombre: 'asc' },
    }),
    db.serieComprobante.findMany({
      where: { activa: true, tipoComprobante: { in: ['FACTURA', 'BOLETA', 'NOTA_VENTA'] } },
    }),
    db.cajaSesion.findFirst({ where: { usuarioId: usuario.id, estado: 'ABIERTA' } }),
  ]);

  const costoRepuestos = orden.repuestos.reduce(
    (acc, r) => acc + num(r.costoUnitario, 4) * num(r.cantidad, 3),
    0,
  );
  const utilidad = num(orden.total) - costoRepuestos;
  const cerrada = orden.estado === 'ENTREGADO' || orden.estado === 'ANULADO';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/taller" className="text-xs font-semibold text-marca-600 hover:underline">
            ← Taller
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="font-mono text-xl font-bold text-slate-800">{orden.numero}</h1>
            <Insignia color={colorEstado(orden.estado)}>{etiqueta(orden.estado)}</Insignia>
          </div>
          <p className="text-sm text-slate-500">
            Ingresó {fechaHora(orden.fechaIngreso)} · recibió {orden.usuario.nombre}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/taller/${orden.id}/imprimir`} className="boton-secundario">
            Imprimir orden
          </Link>
          {orden.venta && (
            <Link href={`/ventas/${orden.venta.id}`} className="boton-secundario">
              Ver comprobante {numeroComprobante(orden.venta.serie, orden.venta.correlativo)}
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="tarjeta p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Cliente</h2>
          <p className="font-medium text-slate-800">{orden.cliente.nombre}</p>
          <p className="text-sm text-slate-600">
            {etiqueta(orden.cliente.tipoDocumento)} {orden.cliente.numeroDocumento}
          </p>
          {orden.cliente.telefono && (
            <p className="text-sm text-slate-500">Tel. {orden.cliente.telefono}</p>
          )}
        </section>

        <section className="tarjeta p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Moto</h2>
          {orden.moto ? (
            <>
              <p className="font-mono text-lg font-bold text-slate-800">
                {orden.moto.placa ?? 'Sin placa'}
              </p>
              <p className="text-sm text-slate-600">
                {[orden.moto.marcaMoto?.nombre, orden.moto.modeloMoto?.nombre, orden.moto.anio]
                  .filter(Boolean)
                  .join(' ')}
              </p>
              {orden.moto.color && <p className="text-sm text-slate-500">Color {orden.moto.color}</p>}
              {orden.kilometraje != null && (
                <p className="text-sm text-slate-500">
                  {orden.kilometraje.toLocaleString('es-PE')} km al ingreso
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">Sin moto registrada.</p>
          )}
        </section>

        <section className="tarjeta p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Resumen</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Repuestos</dt>
              <dd>{soles(orden.totalRepuestos)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Mano de obra</dt>
              <dd>{soles(orden.totalServicios)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold">
              <dt>Total</dt>
              <dd>{soles(orden.total)}</dd>
            </div>
            <div className="flex justify-between pt-1 text-xs">
              <dt className="text-slate-500">Utilidad estimada</dt>
              <dd className={utilidad >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                {soles(utilidad)}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <EstadoOrden
        ordenId={orden.id}
        estado={orden.estado}
        tecnicoId={orden.tecnicoId}
        diagnostico={orden.diagnostico}
        trabajoRealizado={orden.trabajoRealizado}
        observacion={orden.observacion}
        motivoIngreso={orden.motivoIngreso}
        tecnicos={tecnicos.map((t) => ({ id: t.id, nombre: t.nombre }))}
        cerrada={cerrada}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="tarjeta overflow-hidden">
          <h2 className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Repuestos utilizados
            <span className="text-xs font-normal text-slate-500">
              se descuentan de {orden.almacen.nombre}
            </span>
          </h2>

          {orden.repuestos.length === 0 ? (
            <SinDatos mensaje="Todavía no se cargaron repuestos." />
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Repuesto</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">P. unit.</th>
                  <th className="text-right">Importe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orden.repuestos.map((r) => (
                  <tr key={r.id}>
                    <td className="max-w-[220px]">
                      <p className="truncate text-sm">{r.producto.nombre}</p>
                      <p className="font-mono text-[11px] text-slate-400">{r.producto.sku}</p>
                    </td>
                    <td className="text-right">{fmtCantidad(r.cantidad)}</td>
                    <td className="text-right">{soles(r.precioUnitario)}</td>
                    <td className="text-right font-semibold">{soles(r.subtotal)}</td>
                    <td className="text-right">
                      {!cerrada && <QuitarLinea id={r.id} tipo="repuesto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!cerrada && <AgregarRepuesto ordenId={orden.id} almacenId={orden.almacenId} />}
        </section>

        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Mano de obra
          </h2>

          {orden.servicios.length === 0 ? (
            <SinDatos mensaje="Todavía no se cargó mano de obra." />
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Técnico</th>
                  <th className="text-right">Importe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orden.servicios.map((s) => (
                  <tr key={s.id}>
                    <td className="max-w-[220px]">
                      <p className="truncate text-sm">{s.descripcion}</p>
                      {!s.productoId && (
                        <p className="text-[11px] font-semibold text-amber-700">
                          Sin producto asociado — no se podrá facturar
                        </p>
                      )}
                    </td>
                    <td className="text-xs text-slate-600">{s.tecnico?.nombre ?? '—'}</td>
                    <td className="text-right font-semibold">{soles(s.subtotal)}</td>
                    <td className="text-right">
                      {!cerrada && <QuitarLinea id={s.id} tipo="servicio" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!cerrada && (
            <AgregarServicio
              ordenId={orden.id}
              servicios={servicios.map((s) => ({
                id: s.id,
                nombre: s.nombre,
                precio: num(s.precioVenta),
              }))}
              tecnicos={tecnicos.map((t) => ({ id: t.id, nombre: t.nombre }))}
              tecnicoOrden={orden.tecnicoId}
            />
          )}
        </section>
      </div>

      {!cerrada && (
        <CerrarYFacturar
          ordenId={orden.id}
          estado={orden.estado}
          total={num(orden.total)}
          clienteTieneRuc={orden.cliente.tipoDocumento === 'RUC'}
          series={series.map((s) => ({ tipo: s.tipoComprobante, serie: s.serie }))}
          cajaAbierta={Boolean(caja)}
        />
      )}

      {orden.fechaEntrega && (
        <p className="text-center text-xs text-slate-500">
          Entregada el {fmtFecha(orden.fechaEntrega)}
        </p>
      )}
    </div>
  );
}

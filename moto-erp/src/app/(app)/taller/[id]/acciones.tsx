'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  actualizarOrdenTrabajo,
  agregarRepuestoOrden,
  agregarServicioOrden,
  anularOrdenTrabajo,
  facturarOrdenTrabajo,
  quitarRepuestoOrden,
  quitarServicioOrden,
  terminarOrdenTrabajo,
} from '@/actions/taller';
import { buscarProductos } from '@/actions/catalogo';
import { Aviso, BotonEnvio, Campo } from '@/components/ui/basicos';
import { ESTADOS_ORDEN_TRABAJO, METODOS_PAGO } from '@/lib/constantes';
import type { Resultado } from '@/lib/resultado';
import type { OpcionSelect, ProductoBusqueda } from '@/lib/tipos-ui';

const soles = (v: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(v);

// ---------------------------------------------------------------------------
// Estado, diagnóstico y trabajo realizado
// ---------------------------------------------------------------------------

export function EstadoOrden({
  ordenId,
  estado,
  tecnicoId,
  diagnostico,
  trabajoRealizado,
  observacion,
  motivoIngreso,
  tecnicos,
  cerrada,
}: {
  ordenId: number;
  estado: string;
  tecnicoId: number | null;
  diagnostico: string | null;
  trabajoRealizado: string | null;
  observacion: string | null;
  motivoIngreso: string;
  tecnicos: OpcionSelect[];
  cerrada: boolean;
}) {
  const [resultado, accion] = useActionState<Resultado | null, FormData>(
    actualizarOrdenTrabajo,
    null,
  );

  if (cerrada) {
    return (
      <section className="tarjeta space-y-3 p-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Motivo del ingreso
          </h3>
          <p className="whitespace-pre-line text-sm text-slate-700">{motivoIngreso}</p>
        </div>
        {diagnostico && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Diagnóstico
            </h3>
            <p className="whitespace-pre-line text-sm text-slate-700">{diagnostico}</p>
          </div>
        )}
        {trabajoRealizado && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Trabajo realizado
            </h3>
            <p className="whitespace-pre-line text-sm text-slate-700">{trabajoRealizado}</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <form action={accion} className="tarjeta space-y-4 p-4">
      <input type="hidden" name="id" value={ordenId} />

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Motivo del ingreso
        </h3>
        <p className="whitespace-pre-line text-sm text-slate-700">{motivoIngreso}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Estado">
          <select name="estado" defaultValue={estado} className="campo">
            {ESTADOS_ORDEN_TRABAJO.filter((e) => e.valor !== 'ENTREGADO').map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Técnico asignado">
          <select name="tecnicoId" defaultValue={tecnicoId ?? ''} className="campo">
            <option value="">Sin asignar</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo etiqueta="Diagnóstico">
        <textarea
          name="diagnostico"
          rows={2}
          defaultValue={diagnostico ?? ''}
          placeholder="Qué se encontró al revisar la moto"
          className="campo"
        />
      </Campo>

      <Campo etiqueta="Trabajo realizado">
        <textarea
          name="trabajoRealizado"
          rows={2}
          defaultValue={trabajoRealizado ?? ''}
          placeholder="Qué se hizo, para que quede en el historial de la moto"
          className="campo"
        />
      </Campo>

      <Campo etiqueta="Observaciones">
        <input name="observacion" defaultValue={observacion ?? ''} className="campo" />
      </Campo>

      <Aviso resultado={resultado} />
      <BotonEnvio variante="secundario">Guardar avance</BotonEnvio>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Repuestos
// ---------------------------------------------------------------------------

export function AgregarRepuesto({ ordenId, almacenId }: { ordenId: number; almacenId: number }) {
  const router = useRouter();
  const [resultado, accion] = useActionState<Resultado | null, FormData>(
    agregarRepuestoOrden,
    null,
  );

  const [termino, setTermino] = useState('');
  const [resultados, setResultados] = useState<ProductoBusqueda[]>([]);
  const [elegido, setElegido] = useState<ProductoBusqueda | null>(null);

  useEffect(() => {
    if (termino.trim().length < 2) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      setResultados(await buscarProductos(termino, almacenId));
    }, 250);
    return () => clearTimeout(t);
  }, [termino, almacenId]);

  useEffect(() => {
    if (resultado?.ok) {
      setElegido(null);
      setTermino('');
      router.refresh();
    }
  }, [resultado, router]);

  return (
    <div className="border-t border-slate-200 p-3">
      {elegido ? (
        <form action={accion} className="space-y-2">
          <input type="hidden" name="ordenTrabajoId" value={ordenId} />
          <input type="hidden" name="productoId" value={elegido.id} />

          <div className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{elegido.nombre}</p>
              <p className="font-mono text-[11px] text-slate-500">
                {elegido.sku} · stock {elegido.stock}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setElegido(null)}
              className="shrink-0 text-xs text-marca-600 hover:underline"
            >
              cambiar
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              name="cantidad"
              min={0.01}
              step="any"
              defaultValue={1}
              required
              className="campo w-24 text-center"
              aria-label="Cantidad"
            />
            <input
              type="number"
              name="precioUnitario"
              min={0}
              step="0.01"
              defaultValue={elegido.precioVenta}
              className="campo flex-1 text-right"
              aria-label="Precio unitario"
            />
            <BotonEnvio className="shrink-0">Agregar</BotonEnvio>
          </div>

          <Aviso resultado={resultado} />
        </form>
      ) : (
        <>
          <input
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            placeholder="Buscar repuesto por código, nombre o modelo…"
            className="campo"
          />
          {resultados.length > 0 && (
            <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setElegido(p)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-marca-50"
                  >
                    <span className="min-w-0 truncate text-sm">{p.nombre}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {soles(p.precioVenta)} · {p.esServicio ? 'servicio' : `stock ${p.stock}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Aviso resultado={resultado} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mano de obra
// ---------------------------------------------------------------------------

export function AgregarServicio({
  ordenId,
  servicios,
  tecnicos,
  tecnicoOrden,
}: {
  ordenId: number;
  servicios: { id: number; nombre: string; precio: number }[];
  tecnicos: OpcionSelect[];
  tecnicoOrden: number | null;
}) {
  const router = useRouter();
  const [resultado, accion] = useActionState<Resultado | null, FormData>(
    agregarServicioOrden,
    null,
  );
  const [servicioId, setServicioId] = useState('');

  const servicio = servicios.find((s) => String(s.id) === servicioId);

  useEffect(() => {
    if (resultado?.ok) {
      setServicioId('');
      router.refresh();
    }
  }, [resultado, router]);

  return (
    <form action={accion} className="space-y-2 border-t border-slate-200 p-3">
      <input type="hidden" name="ordenTrabajoId" value={ordenId} />

      <select
        name="productoId"
        value={servicioId}
        onChange={(e) => setServicioId(e.target.value)}
        className="campo"
      >
        <option value="">Servicio del catálogo…</option>
        {servicios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre} — {soles(s.precio)}
          </option>
        ))}
      </select>

      <input
        name="descripcion"
        required
        key={servicioId}
        defaultValue={servicio?.nombre ?? ''}
        placeholder="Descripción del trabajo"
        className="campo"
      />

      <div className="flex gap-2">
        <input
          type="number"
          name="cantidad"
          min={0.01}
          step="any"
          defaultValue={1}
          className="campo w-20 text-center"
          aria-label="Cantidad"
        />
        <input
          type="number"
          name="precioUnitario"
          min={0}
          step="0.01"
          key={`precio-${servicioId}`}
          defaultValue={servicio?.precio ?? ''}
          placeholder="Precio"
          required
          className="campo w-28 text-right"
          aria-label="Precio"
        />
        <select name="tecnicoId" defaultValue={tecnicoOrden ?? ''} className="campo flex-1">
          <option value="">Técnico…</option>
          {tecnicos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </div>

      <Aviso resultado={resultado} />
      <BotonEnvio variante="secundario" className="w-full">
        Agregar mano de obra
      </BotonEnvio>
    </form>
  );
}

export function QuitarLinea({ id, tipo }: { id: number; tipo: 'repuesto' | 'servicio' }) {
  const router = useRouter();
  const [procesando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={procesando}
        onClick={() =>
          iniciar(async () => {
            const r = tipo === 'repuesto' ? await quitarRepuestoOrden(id) : await quitarServicioOrden(id);
            if (r.ok) router.refresh();
            else setError(r.error);
          })
        }
        className="text-slate-400 hover:text-red-600 disabled:opacity-50"
        aria-label="Quitar"
      >
        ✕
      </button>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Cierre y facturación
// ---------------------------------------------------------------------------

export function CerrarYFacturar({
  ordenId,
  estado,
  total,
  clienteTieneRuc,
  series,
  cajaAbierta,
}: {
  ordenId: number;
  estado: string;
  total: number;
  clienteTieneRuc: boolean;
  series: { tipo: string; serie: string }[];
  cajaAbierta: boolean;
}) {
  const router = useRouter();
  const [procesando, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const [tipoComprobante, setTipoComprobante] = useState(clienteTieneRuc ? 'FACTURA' : 'BOLETA');
  const [condicionPago, setCondicionPago] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  const terminada = estado === 'TERMINADO';

  function terminar() {
    iniciar(async () => {
      const r = await terminarOrdenTrabajo(ordenId);
      setMensaje(
        r.ok ? { tipo: 'ok', texto: r.mensaje ?? 'Orden terminada.' } : { tipo: 'error', texto: r.error },
      );
      router.refresh();
    });
  }

  function facturar() {
    iniciar(async () => {
      const r = await facturarOrdenTrabajo(ordenId, {
        tipoComprobante: tipoComprobante as 'FACTURA' | 'BOLETA' | 'NOTA_VENTA',
        condicionPago,
        pagos:
          condicionPago === 'CONTADO' ? [{ metodoPago, monto: total, referencia: null }] : [],
      });

      if (r.ok) {
        router.push(`/ventas/${r.datos!.ventaId}/imprimir`);
      } else {
        setMensaje({ tipo: 'error', texto: r.error });
      }
    });
  }

  function anular() {
    if (!motivoAnulacion.trim()) {
      setMensaje({ tipo: 'error', texto: 'Escribe el motivo de la anulación.' });
      return;
    }
    iniciar(async () => {
      const r = await anularOrdenTrabajo(ordenId, motivoAnulacion);
      setMensaje(
        r.ok ? { tipo: 'ok', texto: r.mensaje ?? 'Orden anulada.' } : { tipo: 'error', texto: r.error },
      );
      router.refresh();
    });
  }

  return (
    <section className="tarjeta space-y-4 p-4">
      <h2 className="text-sm font-semibold text-slate-700">Cierre de la orden</h2>

      {mensaje && (
        <p
          className={
            mensaje.tipo === 'ok'
              ? 'rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
              : 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
          }
        >
          {mensaje.texto}
        </p>
      )}

      {!terminada ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={terminar}
            disabled={procesando || total <= 0}
            className="boton-primario"
          >
            {procesando ? 'Procesando…' : 'Marcar como terminada'}
          </button>
          <p className="text-xs text-slate-500">
            Al terminarla se genera la comisión del técnico sobre la mano de obra y queda lista para
            facturar.
          </p>
        </div>
      ) : (
        <div className="space-y-3 rounded-md border border-marca-200 bg-marca-50/50 p-3">
          <p className="text-sm font-medium text-slate-800">
            Facturar {soles(total)} al cliente
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Comprobante">
              <select
                value={tipoComprobante}
                onChange={(e) => setTipoComprobante(e.target.value)}
                className="campo"
              >
                {series.some((s) => s.tipo === 'BOLETA') && <option value="BOLETA">Boleta</option>}
                {series.some((s) => s.tipo === 'FACTURA') && (
                  <option value="FACTURA">Factura</option>
                )}
                {series.some((s) => s.tipo === 'NOTA_VENTA') && (
                  <option value="NOTA_VENTA">Nota de venta</option>
                )}
              </select>
            </Campo>

            <Campo etiqueta="Condición">
              <select
                value={condicionPago}
                onChange={(e) => setCondicionPago(e.target.value as 'CONTADO' | 'CREDITO')}
                className="campo"
              >
                <option value="CONTADO">Contado</option>
                <option value="CREDITO">Crédito</option>
              </select>
            </Campo>

            {condicionPago === 'CONTADO' && (
              <Campo etiqueta="Medio de pago">
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="campo"
                >
                  {METODOS_PAGO.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.etiqueta}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>

          {tipoComprobante === 'FACTURA' && !clienteTieneRuc && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              El cliente no tiene RUC registrado; no se podrá emitir factura.
            </p>
          )}

          {condicionPago === 'CONTADO' && !cajaAbierta && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No tienes caja abierta. Ábrela antes de cobrar.
            </p>
          )}

          <button
            type="button"
            onClick={facturar}
            disabled={procesando}
            className="boton-primario w-full"
          >
            {procesando ? 'Facturando…' : `Facturar y entregar (${soles(total)})`}
          </button>
        </div>
      )}

      <details className="rounded-md border border-slate-200 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-500">
          Anular esta orden
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-600">
            Se devuelven al almacén todos los repuestos cargados y se anulan las comisiones
            pendientes.
          </p>
          <input
            value={motivoAnulacion}
            onChange={(e) => setMotivoAnulacion(e.target.value)}
            placeholder="Motivo de la anulación"
            className="campo"
          />
          <button
            type="button"
            onClick={anular}
            disabled={procesando}
            className="boton-peligro w-full"
          >
            Anular orden
          </button>
        </div>
      </details>
    </section>
  );
}

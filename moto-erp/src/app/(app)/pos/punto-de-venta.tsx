'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { buscarProductos } from '@/actions/catalogo';
import { buscarClientes } from '@/actions/terceros';
import { registrarVenta } from '@/actions/ventas';
import type { ClienteBusqueda, LineaCarrito, ProductoBusqueda } from '@/lib/tipos-ui';
import { METODOS_PAGO } from '@/lib/constantes';
import { Campo, Grupo } from '@/components/ui/basicos';

type Props = {
  almacenes: { id: number; nombre: string }[];
  almacenPredeterminado: number;
  tecnicos: { id: number; nombre: string }[];
  series: { tipo: string; serie: string }[];
  igvPorcentaje: number;
  cajaAbierta: boolean;
};

type Pago = { metodoPago: string; monto: string; referencia: string };

const soles = (v: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(v);

export function PuntoDeVenta({
  almacenes,
  almacenPredeterminado,
  tecnicos,
  series,
  igvPorcentaje,
  cajaAbierta,
}: Props) {
  // --- Estado principal ---------------------------------------------------
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [cliente, setCliente] = useState<ClienteBusqueda | null>(null);
  const [almacenId, setAlmacenId] = useState(almacenPredeterminado);
  const [tipoComprobante, setTipoComprobante] = useState('BOLETA');
  const [serie, setSerie] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [condicionPago, setCondicionPago] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [diasCredito, setDiasCredito] = useState('15');
  const [observacion, setObservacion] = useState('');
  const [pagos, setPagos] = useState<Pago[]>([{ metodoPago: 'EFECTIVO', monto: '', referencia: '' }]);

  // --- Búsqueda de productos ---------------------------------------------
  const [termino, setTermino] = useState('');
  const [resultados, setResultados] = useState<ProductoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const campoBusqueda = useRef<HTMLInputElement>(null);

  // --- Búsqueda de clientes ----------------------------------------------
  const [terminoCliente, setTerminoCliente] = useState('');
  const [clientes, setClientes] = useState<ClienteBusqueda[]>([]);
  const [mostrarClientes, setMostrarClientes] = useState(false);

  const [guardando, iniciarGuardado] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<{ ventaId: number; numero: string; estado: string } | null>(
    null,
  );

  // Atajo: F2 salta al buscador de productos.
  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        campoBusqueda.current?.focus();
        campoBusqueda.current?.select();
      }
    };
    window.addEventListener('keydown', atajo);
    return () => window.removeEventListener('keydown', atajo);
  }, []);

  useEffect(() => {
    if (termino.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        setResultados(await buscarProductos(termino, almacenId));
      } finally {
        setBuscando(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [termino, almacenId]);

  useEffect(() => {
    const t = setTimeout(async () => {
      setClientes(await buscarClientes(terminoCliente));
    }, 250);
    return () => clearTimeout(t);
  }, [terminoCliente]);

  // Serie por defecto cuando cambia el tipo de comprobante.
  useEffect(() => {
    const disponible = series.find((s) => s.tipo === tipoComprobante);
    setSerie(disponible?.serie ?? '');
  }, [tipoComprobante, series]);

  // --- Precios según el tipo de cliente ----------------------------------
  function precioPara(p: ProductoBusqueda): number {
    if (cliente?.tipoCliente === 'TECNICO' && p.precioTecnico > 0) return p.precioTecnico;
    if (cliente?.tipoCliente === 'MAYORISTA' && p.precioMayorista > 0) return p.precioMayorista;
    return p.precioVenta;
  }

  function agregar(p: ProductoBusqueda) {
    setError(null);
    setExito(null);

    setCarrito((actual) => {
      const existente = actual.find((l) => l.productoId === p.id);
      if (existente) {
        return actual.map((l) =>
          l.productoId === p.id ? { ...l, cantidad: l.cantidad + 1 } : l,
        );
      }
      return [
        ...actual,
        {
          productoId: p.id,
          sku: p.sku,
          nombre: p.nombre,
          unidadMedida: p.unidadMedida,
          afectacionIgv: p.afectacionIgv,
          esServicio: p.esServicio,
          stockDisponible: p.stock,
          cantidad: 1,
          precioUnitario: precioPara(p),
          descuento: 0,
        },
      ];
    });

    setTermino('');
    setResultados([]);
    campoBusqueda.current?.focus();
  }

  function actualizarLinea(productoId: number, cambios: Partial<LineaCarrito>) {
    setCarrito((actual) =>
      actual.map((l) => (l.productoId === productoId ? { ...l, ...cambios } : l)),
    );
  }

  function quitar(productoId: number) {
    setCarrito((actual) => actual.filter((l) => l.productoId !== productoId));
  }

  // --- Totales ------------------------------------------------------------
  const totales = useMemo(() => {
    const factor = 1 + igvPorcentaje / 100;
    let total = 0;
    let gravadas = 0;
    let exoneradas = 0;
    let inafectas = 0;

    for (const l of carrito) {
      const totalLinea = Math.round((l.cantidad * l.precioUnitario - l.descuento) * 100) / 100;
      total += totalLinea;
      if (l.afectacionIgv === 'GRAVADO') gravadas += Math.round((totalLinea / factor) * 100) / 100;
      else if (l.afectacionIgv === 'EXONERADO') exoneradas += totalLinea;
      else inafectas += totalLinea;
    }

    const igv = Math.round((total - gravadas - exoneradas - inafectas) * 100) / 100;
    return {
      total: Math.round(total * 100) / 100,
      gravadas: Math.round(gravadas * 100) / 100,
      exoneradas,
      inafectas,
      igv,
    };
  }, [carrito, igvPorcentaje]);

  const totalPagado = pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  const vuelto = Math.round((totalPagado - totales.total) * 100) / 100;
  const saldoCredito = Math.round((totales.total - totalPagado) * 100) / 100;

  const hayStockInsuficiente = carrito.some(
    (l) => !l.esServicio && l.cantidad > l.stockDisponible,
  );

  // --- Envío ---------------------------------------------------------------
  function confirmar() {
    setError(null);

    if (carrito.length === 0) return setError('Agrega al menos un producto.');
    if (!cliente) return setError('Selecciona el cliente.');
    if (tipoComprobante === 'FACTURA' && cliente.tipoDocumento !== 'RUC') {
      return setError('Para emitir factura el cliente debe tener RUC.');
    }
    if (hayStockInsuficiente) {
      return setError('Hay líneas con más cantidad que el stock disponible.');
    }

    const pagosLimpios = pagos
      .filter((p) => Number(p.monto) > 0)
      .map((p) => ({
        metodoPago: p.metodoPago as never,
        monto: Number(p.monto),
        referencia: p.referencia || null,
      }));

    if (condicionPago === 'CONTADO' && totalPagado < totales.total - 0.005) {
      return setError('El cobro no cubre el total de la venta.');
    }
    if (pagosLimpios.length > 0 && !cajaAbierta) {
      return setError('No tienes una caja abierta. Ábrela antes de cobrar.');
    }

    iniciarGuardado(async () => {
      const resultado = await registrarVenta({
        tipoComprobante: tipoComprobante as 'FACTURA' | 'BOLETA' | 'NOTA_VENTA',
        serie: serie || null,
        clienteId: cliente.id,
        tecnicoId: tecnicoId ? Number(tecnicoId) : null,
        almacenId,
        condicionPago,
        diasCredito: Number(diasCredito) || 0,
        observacion: observacion || null,
        items: carrito.map((l) => ({
          productoId: l.productoId,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          descuento: l.descuento,
        })),
        // El vuelto no es parte del cobro: se registra solo lo que cubre la venta.
        pagos: pagosLimpios.map((p, i) =>
          i === 0 && condicionPago === 'CONTADO' && vuelto > 0
            ? { ...p, monto: Math.round((p.monto - vuelto) * 100) / 100 }
            : p,
        ),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setExito({
        ventaId: resultado.datos!.ventaId,
        numero: resultado.datos!.numero,
        estado: resultado.datos!.estadoSunat,
      });
      setCarrito([]);
      setPagos([{ metodoPago: 'EFECTIVO', monto: '', referencia: '' }]);
      setObservacion('');
      setTecnicoId('');
      campoBusqueda.current?.focus();
    });
  }

  // -------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Punto de venta</h1>
        {!cajaAbierta && (
          <Link
            href="/caja"
            className="insignia bg-amber-100 text-amber-800 hover:bg-amber-200"
          >
            Caja cerrada — ábrela para cobrar
          </Link>
        )}
      </div>

      {exito && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm text-emerald-800">
            Venta <span className="font-mono font-bold">{exito.numero}</span> registrada.
            {exito.estado !== 'NO_APLICA' && ` Estado SUNAT: ${exito.estado}.`}
          </p>
          <div className="flex gap-2">
            <Link href={`/ventas/${exito.ventaId}/imprimir`} className="boton-primario py-1.5">
              Imprimir
            </Link>
            <Link href={`/ventas/${exito.ventaId}`} className="boton-secundario py-1.5">
              Ver comprobante
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        {/* ------------------------------ Izquierda ------------------------------ */}
        <div className="space-y-4">
          <section className="tarjeta p-4">
            <div className="relative">
              <input
                ref={campoBusqueda}
                value={termino}
                onChange={(e) => setTermino(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && resultados.length > 0) {
                    e.preventDefault();
                    agregar(resultados[0]);
                  }
                }}
                placeholder="Buscar por código, nombre, código OEM o modelo de moto…  (F2)"
                className="campo py-2.5 text-base"
                autoFocus
              />
              {buscando && (
                <span className="absolute right-3 top-2.5 text-xs text-slate-400">buscando…</span>
              )}
            </div>

            {resultados.length > 0 && (
              <ul className="mt-3 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
                {resultados.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => agregar(p)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-marca-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{p.nombre}</p>
                        <p className="truncate text-xs text-slate-500">
                          <span className="font-mono">{p.sku}</span>
                          {p.marca && ` · ${p.marca}`}
                          {p.ubicacion && ` · Ubic. ${p.ubicacion}`}
                          {p.aplicaciones.length > 0 && ` · ${p.aplicaciones.join(', ')}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-slate-800">
                          {soles(precioPara(p))}
                        </p>
                        <p
                          className={clsx(
                            'text-xs',
                            p.esServicio
                              ? 'text-slate-400'
                              : p.stock <= 0
                                ? 'font-semibold text-red-600'
                                : 'text-slate-500',
                          )}
                        >
                          {p.esServicio ? 'servicio' : `stock ${p.stock}`}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="tarjeta overflow-hidden">
            {carrito.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-slate-400">
                El carrito está vacío. Busca un repuesto para empezar.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="w-24 text-center">Cant.</th>
                      <th className="w-28 text-right">P. unit.</th>
                      <th className="w-24 text-right">Dscto.</th>
                      <th className="w-28 text-right">Importe</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrito.map((l) => {
                      const importe =
                        Math.round((l.cantidad * l.precioUnitario - l.descuento) * 100) / 100;
                      const excede = !l.esServicio && l.cantidad > l.stockDisponible;

                      return (
                        <tr key={l.productoId}>
                          <td>
                            <p className="text-sm font-medium text-slate-800">{l.nombre}</p>
                            <p className="font-mono text-[11px] text-slate-400">
                              {l.sku}
                              {!l.esServicio && ` · stock ${l.stockDisponible}`}
                            </p>
                            {excede && (
                              <p className="text-[11px] font-semibold text-red-600">
                                Excede el stock disponible
                              </p>
                            )}
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0.001}
                              step="any"
                              value={l.cantidad}
                              onChange={(e) =>
                                actualizarLinea(l.productoId, {
                                  cantidad: Number(e.target.value) || 0,
                                })
                              }
                              className={clsx(
                                'campo px-2 py-1 text-center text-sm',
                                excede && 'border-red-400',
                              )}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={l.precioUnitario}
                              onChange={(e) =>
                                actualizarLinea(l.productoId, {
                                  precioUnitario: Number(e.target.value) || 0,
                                })
                              }
                              className="campo px-2 py-1 text-right text-sm"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={l.descuento}
                              onChange={(e) =>
                                actualizarLinea(l.productoId, {
                                  descuento: Number(e.target.value) || 0,
                                })
                              }
                              className="campo px-2 py-1 text-right text-sm"
                            />
                          </td>
                          <td className="text-right font-semibold">{soles(importe)}</td>
                          <td className="text-center">
                            <button
                              type="button"
                              onClick={() => quitar(l.productoId)}
                              className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              aria-label={`Quitar ${l.nombre}`}
                            >
                              ✕
                            </button>
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

        {/* ------------------------------ Derecha ------------------------------ */}
        <div className="space-y-4">
          <section className="tarjeta space-y-3 p-4">
            <Grupo etiqueta="Cliente">
              {cliente ? (
                <div className="flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{cliente.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {cliente.tipoDocumento} {cliente.numeroDocumento}
                      {cliente.tipoCliente !== 'PUBLICO' && ` · ${cliente.tipoCliente}`}
                    </p>
                    {cliente.saldoPendiente > 0 && (
                      <p className="text-xs font-semibold text-amber-700">
                        Deuda actual: {soles(cliente.saldoPendiente)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCliente(null);
                      setMostrarClientes(true);
                    }}
                    className="shrink-0 text-xs font-semibold text-marca-600 hover:underline"
                  >
                    cambiar
                  </button>
                </div>
              ) : (
                <>
                  <input
                    value={terminoCliente}
                    onChange={(e) => {
                      setTerminoCliente(e.target.value);
                      setMostrarClientes(true);
                    }}
                    onFocus={() => setMostrarClientes(true)}
                    placeholder="Nombre o documento…"
                    className="campo"
                  />
                  {mostrarClientes && clientes.length > 0 && (
                    <ul className="mt-1 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
                      {clientes.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setCliente(c);
                              setMostrarClientes(false);
                              setTerminoCliente('');
                              if (c.tipoDocumento === 'RUC') setTipoComprobante('FACTURA');
                              if (c.diasCredito > 0) setDiasCredito(String(c.diasCredito));
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-marca-50"
                          >
                            <p className="truncate text-sm text-slate-800">{c.nombre}</p>
                            <p className="text-xs text-slate-500">
                              {c.tipoDocumento} {c.numeroDocumento}
                              {c.tipoCliente !== 'PUBLICO' && ` · ${c.tipoCliente}`}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href="/clientes"
                    className="mt-1 inline-block text-xs font-semibold text-marca-600 hover:underline"
                  >
                    + Registrar cliente nuevo
                  </Link>
                </>
              )}
            </Grupo>

            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Comprobante">
                <select
                  value={tipoComprobante}
                  onChange={(e) => setTipoComprobante(e.target.value)}
                  className="campo"
                >
                  <option value="BOLETA">Boleta</option>
                  <option value="FACTURA">Factura</option>
                  <option value="NOTA_VENTA">Nota de venta</option>
                </select>
              </Campo>

              <Campo etiqueta="Serie">
                <select value={serie} onChange={(e) => setSerie(e.target.value)} className="campo">
                  {series
                    .filter((s) => s.tipo === tipoComprobante)
                    .map((s) => (
                      <option key={s.serie} value={s.serie}>
                        {s.serie}
                      </option>
                    ))}
                </select>
              </Campo>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Almacén">
                <select
                  value={almacenId}
                  onChange={(e) => setAlmacenId(Number(e.target.value))}
                  className="campo"
                >
                  {almacenes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo etiqueta="Técnico (comisión)">
                <select
                  value={tecnicoId}
                  onChange={(e) => setTecnicoId(e.target.value)}
                  className="campo"
                >
                  <option value="">Sin técnico</option>
                  {tecnicos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>

            <div className="grid grid-cols-2 gap-3">
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

              {condicionPago === 'CREDITO' && (
                <Campo etiqueta="Días de crédito">
                  <input
                    type="number"
                    min={0}
                    value={diasCredito}
                    onChange={(e) => setDiasCredito(e.target.value)}
                    className="campo"
                  />
                </Campo>
              )}
            </div>
          </section>

          <section className="tarjeta p-4">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between text-slate-600">
                <dt>Op. gravadas</dt>
                <dd>{soles(totales.gravadas)}</dd>
              </div>
              {totales.exoneradas > 0 && (
                <div className="flex justify-between text-slate-600">
                  <dt>Op. exoneradas</dt>
                  <dd>{soles(totales.exoneradas)}</dd>
                </div>
              )}
              {totales.inafectas > 0 && (
                <div className="flex justify-between text-slate-600">
                  <dt>Op. inafectas</dt>
                  <dd>{soles(totales.inafectas)}</dd>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <dt>IGV ({igvPorcentaje}%)</dt>
                <dd>{soles(totales.igv)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold text-slate-900">
                <dt>Total</dt>
                <dd>{soles(totales.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="tarjeta space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Cobro</h2>
              <button
                type="button"
                onClick={() =>
                  setPagos((p) => [...p, { metodoPago: 'EFECTIVO', monto: '', referencia: '' }])
                }
                className="text-xs font-semibold text-marca-600 hover:underline"
              >
                + Otro medio
              </button>
            </div>

            {pagos.map((pago, i) => (
              <div key={i} className="space-y-2 rounded-md border border-slate-200 p-2">
                <div className="flex gap-2">
                  <select
                    value={pago.metodoPago}
                    onChange={(e) =>
                      setPagos((actual) =>
                        actual.map((p, j) =>
                          j === i ? { ...p, metodoPago: e.target.value } : p,
                        ),
                      )
                    }
                    className="campo flex-1"
                  >
                    {METODOS_PAGO.map((m) => (
                      <option key={m.valor} value={m.valor}>
                        {m.etiqueta}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={pago.monto}
                    onChange={(e) =>
                      setPagos((actual) =>
                        actual.map((p, j) => (j === i ? { ...p, monto: e.target.value } : p)),
                      )
                    }
                    placeholder="0.00"
                    className="campo w-28 text-right"
                  />

                  {pagos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPagos((actual) => actual.filter((_, j) => j !== i))}
                      className="px-1 text-slate-400 hover:text-red-600"
                      aria-label="Quitar medio de pago"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {pago.metodoPago !== 'EFECTIVO' && (
                  <input
                    value={pago.referencia}
                    onChange={(e) =>
                      setPagos((actual) =>
                        actual.map((p, j) => (j === i ? { ...p, referencia: e.target.value } : p)),
                      )
                    }
                    placeholder="N° de operación / voucher"
                    className="campo text-sm"
                  />
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setPagos((actual) =>
                  actual.map((p, j) => (j === 0 ? { ...p, monto: String(totales.total) } : p)),
                )
              }
              className="w-full rounded-md border border-dashed border-slate-300 py-1.5 text-xs font-semibold text-slate-500 hover:border-marca-400 hover:text-marca-600"
            >
              Importe exacto ({soles(totales.total)})
            </button>

            {condicionPago === 'CONTADO' && vuelto > 0 && (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                Vuelto: {soles(vuelto)}
              </p>
            )}
            {condicionPago === 'CREDITO' && saldoCredito > 0 && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                Queda al crédito: {soles(saldoCredito)}
              </p>
            )}

            <Campo etiqueta="Observación">
              <input
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Opcional"
                className="campo"
              />
            </Campo>

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={confirmar}
              disabled={guardando || carrito.length === 0}
              className="boton-primario w-full py-3 text-base"
            >
              {guardando ? 'Registrando…' : `Cobrar ${soles(totales.total)}`}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

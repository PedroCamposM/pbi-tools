'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { buscarProductos } from '@/actions/catalogo';
import { registrarCompra } from '@/actions/compras';
import { Campo } from '@/components/ui/basicos';
import type { ProductoBusqueda } from '@/lib/tipos-ui';

const soles = (v: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(v);

type LineaCompra = {
  productoId: number;
  sku: string;
  nombre: string;
  stockActual: number;
  precioVentaActual: number;
  cantidad: number;
  costoUnitario: number;
  precioVenta: number;
};

export function FormularioCompra({
  proveedores,
  almacenes,
  igvPorcentaje,
}: {
  proveedores: { id: number; nombre: string; diasCredito: number }[];
  almacenes: { id: number; nombre: string }[];
  igvPorcentaje: number;
}) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();

  const [proveedorId, setProveedorId] = useState('');
  const [almacenId, setAlmacenId] = useState(almacenes[0]?.id ?? 0);
  const [tipoComprobante, setTipoComprobante] = useState('FACTURA');
  const [serie, setSerie] = useState('');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [condicionPago, setCondicionPago] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [diasCredito, setDiasCredito] = useState('30');
  const [incluyeIgv, setIncluyeIgv] = useState(false);
  const [afectoIgv, setAfectoIgv] = useState(true);
  const [observacion, setObservacion] = useState('');

  const [lineas, setLineas] = useState<LineaCompra[]>([]);
  const [termino, setTermino] = useState('');
  const [resultados, setResultados] = useState<ProductoBusqueda[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  function agregar(p: ProductoBusqueda) {
    if (lineas.some((l) => l.productoId === p.id)) return;
    setLineas((actual) => [
      ...actual,
      {
        productoId: p.id,
        sku: p.sku,
        nombre: p.nombre,
        stockActual: p.stock,
        precioVentaActual: p.precioVenta,
        cantidad: 1,
        costoUnitario: 0,
        precioVenta: 0,
      },
    ]);
    setTermino('');
    setResultados([]);
  }

  function actualizar(productoId: number, cambios: Partial<LineaCompra>) {
    setLineas((actual) =>
      actual.map((l) => (l.productoId === productoId ? { ...l, ...cambios } : l)),
    );
  }

  const totales = useMemo(() => {
    const factor = 1 + igvPorcentaje / 100;
    let subtotal = 0;

    for (const l of lineas) {
      const costo = incluyeIgv && afectoIgv ? l.costoUnitario / factor : l.costoUnitario;
      subtotal += l.cantidad * costo;
    }

    subtotal = Math.round(subtotal * 100) / 100;
    const igv = afectoIgv ? Math.round(subtotal * (igvPorcentaje / 100) * 100) / 100 : 0;
    return { subtotal, igv, total: Math.round((subtotal + igv) * 100) / 100 };
  }, [lineas, incluyeIgv, afectoIgv, igvPorcentaje]);

  function guardar() {
    setError(null);
    if (!proveedorId) return setError('Selecciona el proveedor.');
    if (lineas.length === 0) return setError('Agrega al menos un producto.');
    if (lineas.some((l) => l.cantidad <= 0)) return setError('Hay líneas con cantidad en cero.');
    if (lineas.some((l) => l.costoUnitario <= 0))
      return setError('Todas las líneas necesitan un costo unitario.');

    iniciar(async () => {
      const resultado = await registrarCompra({
        proveedorId: Number(proveedorId),
        almacenId,
        tipoComprobante,
        serie: serie || null,
        numero: numero || null,
        fecha,
        condicionPago,
        diasCredito: Number(diasCredito) || 0,
        incluyeIgv,
        afectoIgv,
        observacion: observacion || null,
        items: lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: l.cantidad,
          costoUnitario: l.costoUnitario,
          precioVenta: l.precioVenta,
        })),
      });

      if (resultado.ok) router.push(`/compras/${resultado.datos!.compraId}`);
      else setError(resultado.error);
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <section className="tarjeta grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo etiqueta="Proveedor" className="sm:col-span-2 lg:col-span-3">
            <select
              value={proveedorId}
              onChange={(e) => {
                setProveedorId(e.target.value);
                const p = proveedores.find((x) => String(x.id) === e.target.value);
                if (p && p.diasCredito > 0) {
                  setCondicionPago('CREDITO');
                  setDiasCredito(String(p.diasCredito));
                }
              }}
              className="campo"
            >
              <option value="">Seleccionar proveedor…</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Tipo">
            <select
              value={tipoComprobante}
              onChange={(e) => setTipoComprobante(e.target.value)}
              className="campo"
            >
              <option value="FACTURA">Factura</option>
              <option value="BOLETA">Boleta</option>
              <option value="GUIA">Guía de remisión</option>
              <option value="OTRO">Otro</option>
            </select>
          </Campo>

          <Campo etiqueta="Serie">
            <input
              value={serie}
              onChange={(e) => setSerie(e.target.value.toUpperCase())}
              placeholder="F001"
              className="campo font-mono"
            />
          </Campo>

          <Campo etiqueta="Número">
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="00012345"
              className="campo font-mono"
            />
          </Campo>

          <Campo etiqueta="Fecha">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="campo"
            />
          </Campo>

          <Campo etiqueta="Almacén de ingreso">
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

          <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={incluyeIgv}
                onChange={(e) => setIncluyeIgv(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Los costos que ingreso ya incluyen IGV
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={afectoIgv}
                onChange={(e) => setAfectoIgv(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              La compra está afecta a IGV (crédito fiscal)
            </label>
          </div>
        </section>

        <section className="tarjeta p-4">
          <input
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            placeholder="Buscar producto para agregar a la compra…"
            className="campo"
          />
          {resultados.length > 0 && (
            <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => agregar(p)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-marca-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{p.nombre}</span>
                      <span className="font-mono text-[11px] text-slate-400">{p.sku}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">stock {p.stock}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tarjeta overflow-hidden">
          {lineas.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">
              Agrega los productos que estás comprando.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="w-24 text-center">Cant.</th>
                    <th className="w-28 text-right">
                      Costo {incluyeIgv ? 'c/IGV' : 's/IGV'}
                    </th>
                    <th className="w-28 text-right">Nuevo P. venta</th>
                    <th className="w-28 text-right">Subtotal</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => (
                    <tr key={l.productoId}>
                      <td>
                        <p className="text-sm">{l.nombre}</p>
                        <p className="font-mono text-[11px] text-slate-400">
                          {l.sku} · stock {l.stockActual} · venta actual{' '}
                          {soles(l.precioVentaActual)}
                        </p>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0.01}
                          step="any"
                          value={l.cantidad}
                          onChange={(e) =>
                            actualizar(l.productoId, { cantidad: Number(e.target.value) || 0 })
                          }
                          className="campo px-2 py-1 text-center text-sm"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.0001"
                          value={l.costoUnitario || ''}
                          onChange={(e) =>
                            actualizar(l.productoId, { costoUnitario: Number(e.target.value) || 0 })
                          }
                          placeholder="0.00"
                          className="campo px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.precioVenta || ''}
                          onChange={(e) =>
                            actualizar(l.productoId, { precioVenta: Number(e.target.value) || 0 })
                          }
                          placeholder="sin cambio"
                          className="campo px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="text-right font-semibold">
                        {soles(
                          l.cantidad *
                            (incluyeIgv && afectoIgv
                              ? l.costoUnitario / (1 + igvPorcentaje / 100)
                              : l.costoUnitario),
                        )}
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setLineas((a) => a.filter((x) => x.productoId !== l.productoId))
                          }
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Quitar"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <section className="tarjeta p-4">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-600">
              <dt>Subtotal</dt>
              <dd>{soles(totales.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-slate-600">
              <dt>IGV ({afectoIgv ? igvPorcentaje : 0}%)</dt>
              <dd>{soles(totales.igv)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold text-slate-900">
              <dt>Total</dt>
              <dd>{soles(totales.total)}</dd>
            </div>
          </dl>
        </section>

        <section className="tarjeta space-y-3 p-4">
          <Campo etiqueta="Observación">
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={2}
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
            onClick={guardar}
            disabled={guardando || lineas.length === 0}
            className="boton-primario w-full py-3"
          >
            {guardando ? 'Registrando…' : 'Registrar compra'}
          </button>

          <p className="text-xs text-slate-500">
            Si escribes un nuevo precio de venta, se actualiza la lista de precios del producto al
            guardar.
          </p>
        </section>
      </aside>
    </div>
  );
}

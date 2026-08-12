'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  agregarAplicacion,
  agregarCodigoAlterno,
  eliminarAplicacion,
  eliminarCodigoAlterno,
} from '@/actions/catalogo';
import { Aviso, BotonEnvio, Insignia } from '@/components/ui/basicos';
import type { Resultado } from '@/lib/resultado';

type Codigo = { id: number; codigo: string; tipo: string; nota: string | null };
type Aplicacion = {
  id: number;
  marca: string;
  modelo: string | null;
  anioDesde: number | null;
  anioHasta: number | null;
};

/**
 * Los códigos equivalentes y la compatibilidad son lo que permite atender en
 * mostrador: el cliente llega con un código OEM o simplemente dice "es para
 * una Pulsar 180".
 */
export function CodigosYAplicaciones({
  productoId,
  codigos,
  aplicaciones,
  marcasMoto,
  modelosMoto,
}: {
  productoId: number;
  codigos: Codigo[];
  aplicaciones: Aplicacion[];
  marcasMoto: { id: number; nombre: string }[];
  modelosMoto: { id: number; nombre: string; marcaMotoId: number }[];
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [marcaSeleccionada, setMarcaSeleccionada] = useState('');

  const [estadoCodigo, accionCodigo] = useActionState<Resultado | null, FormData>(
    agregarCodigoAlterno,
    null,
  );
  const [estadoAplicacion, accionAplicacion] = useActionState<Resultado | null, FormData>(
    agregarAplicacion,
    null,
  );

  const modelosFiltrados = marcaSeleccionada
    ? modelosMoto.filter((m) => m.marcaMotoId === Number(marcaSeleccionada))
    : [];

  return (
    <div className="space-y-4">
      <section className="tarjeta">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Códigos equivalentes
        </h2>

        <ul className="divide-y divide-slate-100">
          {codigos.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">Sin códigos registrados.</li>
          )}
          {codigos.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2">
              <div className="min-w-0">
                <span className="font-mono text-sm">{c.codigo}</span>
                <Insignia color="gris">{c.tipo}</Insignia>
                {c.nota && <p className="truncate text-xs text-slate-500">{c.nota}</p>}
              </div>
              <button
                type="button"
                onClick={() =>
                  iniciar(async () => {
                    await eliminarCodigoAlterno(c.id, productoId);
                    router.refresh();
                  })
                }
                className="text-slate-400 hover:text-red-600"
                aria-label={`Eliminar ${c.codigo}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <form action={accionCodigo} className="space-y-2 border-t border-slate-200 p-3">
          <input type="hidden" name="productoId" value={productoId} />
          <div className="flex gap-2">
            <input name="codigo" required placeholder="Código" className="campo flex-1 font-mono" />
            <select name="tipo" className="campo w-40">
              <option value="OEM">OEM</option>
              <option value="EQUIVALENTE">Equivalente</option>
              <option value="PROVEEDOR">Proveedor</option>
              <option value="BARRAS">Código de barras</option>
            </select>
          </div>
          <input name="nota" placeholder="Nota (opcional)" className="campo" />
          <Aviso resultado={estadoCodigo} />
          <BotonEnvio variante="secundario" className="w-full">
            Agregar código
          </BotonEnvio>
        </form>
      </section>

      <section className="tarjeta">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Compatible con
        </h2>

        <ul className="divide-y divide-slate-100">
          {aplicaciones.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">Sin compatibilidades registradas.</li>
          )}
          {aplicaciones.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2">
              <span className="text-sm text-slate-700">
                {a.marca} {a.modelo ?? '(todos los modelos)'}
                {(a.anioDesde || a.anioHasta) && (
                  <span className="text-xs text-slate-500">
                    {' '}
                    · {a.anioDesde ?? '…'}–{a.anioHasta ?? '…'}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() =>
                  iniciar(async () => {
                    await eliminarAplicacion(a.id, productoId);
                    router.refresh();
                  })
                }
                className="text-slate-400 hover:text-red-600"
                aria-label="Eliminar compatibilidad"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <form action={accionAplicacion} className="space-y-2 border-t border-slate-200 p-3">
          <input type="hidden" name="productoId" value={productoId} />
          <div className="flex gap-2">
            <select
              name="marcaMotoId"
              required
              value={marcaSeleccionada}
              onChange={(e) => setMarcaSeleccionada(e.target.value)}
              className="campo flex-1"
            >
              <option value="">Marca de moto…</option>
              {marcasMoto.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            <select name="modeloMotoId" className="campo flex-1">
              <option value="">Todos los modelos</option>
              {modelosFiltrados.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              name="anioDesde"
              placeholder="Año desde"
              className="campo flex-1"
            />
            <input type="number" name="anioHasta" placeholder="Año hasta" className="campo flex-1" />
          </div>
          <Aviso resultado={estadoAplicacion} />
          <BotonEnvio variante="secundario" className="w-full">
            Agregar compatibilidad
          </BotonEnvio>
        </form>
      </section>
    </div>
  );
}

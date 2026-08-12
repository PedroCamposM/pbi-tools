'use client';

import { useActionState, useState } from 'react';
import { guardarProducto } from '@/actions/catalogo';
import { Aviso, BotonEnvio, Campo } from '@/components/ui/basicos';
import { UNIDADES_MEDIDA } from '@/lib/sunat/catalogos';
import type { Resultado } from '@/lib/resultado';
import type { OpcionSelect } from '@/lib/tipos-ui';

type ProductoEditable = {
  id: number;
  sku: string;
  nombre: string;
  descripcion: string | null;
  categoriaId: number;
  marcaId: number | null;
  unidadMedida: string;
  afectacionIgv: string;
  esServicio: boolean;
  precioVenta: number;
  precioTecnico: number;
  precioMayorista: number;
  stockMinimo: number;
  stockMaximo: number;
  ubicacion: string | null;
  activo: boolean;
};

export function FormularioProducto({
  categorias,
  marcas,
  almacenes,
  producto,
}: {
  categorias: OpcionSelect[];
  marcas: OpcionSelect[];
  almacenes: OpcionSelect[];
  producto?: ProductoEditable;
}) {
  const [estado, accion] = useActionState<Resultado<{ id: number }> | null, FormData>(
    guardarProducto,
    null,
  );
  const [esServicio, setEsServicio] = useState(producto?.esServicio ?? false);

  return (
    <form action={accion} className="space-y-4">
      {producto && <input type="hidden" name="id" value={producto.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Código / SKU">
          <input
            name="sku"
            required
            defaultValue={producto?.sku}
            placeholder="EMB-CG125-01"
            className="campo font-mono"
          />
        </Campo>

        <Campo etiqueta="Ubicación en almacén">
          <input
            name="ubicacion"
            defaultValue={producto?.ubicacion ?? ''}
            placeholder="A-01"
            className="campo"
          />
        </Campo>
      </div>

      <Campo etiqueta="Nombre">
        <input
          name="nombre"
          required
          defaultValue={producto?.nombre}
          placeholder="Kit de embrague completo CG 125 (5 discos)"
          className="campo"
        />
      </Campo>

      <Campo etiqueta="Descripción">
        <textarea
          name="descripcion"
          rows={2}
          defaultValue={producto?.descripcion ?? ''}
          className="campo"
        />
      </Campo>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Categoría">
          <select name="categoriaId" required defaultValue={producto?.categoriaId} className="campo">
            <option value="">Seleccionar…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Marca">
          <select name="marcaId" defaultValue={producto?.marcaId ?? ''} className="campo">
            <option value="">Sin marca</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Unidad de medida (SUNAT)">
          <select
            name="unidadMedida"
            defaultValue={producto?.unidadMedida ?? 'NIU'}
            className="campo"
          >
            {UNIDADES_MEDIDA.map((u) => (
              <option key={u.codigo} value={u.codigo}>
                {u.codigo} — {u.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Afectación IGV">
          <select
            name="afectacionIgv"
            defaultValue={producto?.afectacionIgv ?? 'GRAVADO'}
            className="campo"
          >
            <option value="GRAVADO">Gravado (18%)</option>
            <option value="EXONERADO">Exonerado</option>
            <option value="INAFECTO">Inafecto</option>
          </select>
        </Campo>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="esServicio"
          checked={esServicio}
          onChange={(e) => setEsServicio(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Es un servicio de taller (mano de obra, no maneja stock)
      </label>

      <fieldset className="rounded-md border border-slate-200 p-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Precios de venta (incluyen IGV)
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Público">
            <input
              type="number"
              step="0.01"
              min={0}
              name="precioVenta"
              defaultValue={producto?.precioVenta ?? ''}
              className="campo text-right"
            />
          </Campo>
          <Campo etiqueta="Técnico">
            <input
              type="number"
              step="0.01"
              min={0}
              name="precioTecnico"
              defaultValue={producto?.precioTecnico ?? ''}
              className="campo text-right"
            />
          </Campo>
          <Campo etiqueta="Mayorista">
            <input
              type="number"
              step="0.01"
              min={0}
              name="precioMayorista"
              defaultValue={producto?.precioMayorista ?? ''}
              className="campo text-right"
            />
          </Campo>
        </div>
      </fieldset>

      {!esServicio && (
        <fieldset className="rounded-md border border-slate-200 p-3">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Control de stock
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Stock mínimo" ayuda="Avisa cuando el saldo baje de aquí">
              <input
                type="number"
                step="0.01"
                min={0}
                name="stockMinimo"
                defaultValue={producto?.stockMinimo ?? ''}
                className="campo text-right"
              />
            </Campo>
            <Campo etiqueta="Stock máximo">
              <input
                type="number"
                step="0.01"
                min={0}
                name="stockMaximo"
                defaultValue={producto?.stockMaximo ?? ''}
                className="campo text-right"
              />
            </Campo>
          </div>

          {!producto && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Campo etiqueta="Stock inicial">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  name="stockInicial"
                  placeholder="0"
                  className="campo text-right"
                />
              </Campo>
              <Campo etiqueta="Costo inicial" ayuda="Sin IGV">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  name="costoInicial"
                  placeholder="0.00"
                  className="campo text-right"
                />
              </Campo>
              <Campo etiqueta="Almacén">
                <select name="almacenId" className="campo">
                  {almacenes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
          )}
        </fieldset>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={producto?.activo ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        Producto activo
      </label>

      <Aviso resultado={estado} />

      <BotonEnvio className="w-full">
        {producto ? 'Guardar cambios' : 'Crear producto'}
      </BotonEnvio>
    </form>
  );
}

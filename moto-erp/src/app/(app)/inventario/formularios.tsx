'use client';

import { useActionState, useState } from 'react';
import { ajustarStock, transferirStock } from '@/actions/catalogo';
import { Aviso, BotonEnvio, Campo, Grupo } from '@/components/ui/basicos';
import type { Resultado } from '@/lib/resultado';
import type { OpcionSelect } from '@/lib/tipos-ui';

/** Buscador simple sobre una lista ya cargada en el cliente. */
function SelectorProducto({ productos, nombre }: { productos: OpcionSelect[]; nombre: string }) {
  const [filtro, setFiltro] = useState('');

  const visibles = filtro
    ? productos.filter((p) => p.nombre.toLowerCase().includes(filtro.toLowerCase())).slice(0, 60)
    : productos.slice(0, 60);

  return (
    <div className="space-y-2">
      <input
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Filtrar productos…"
        className="campo"
      />
      <select name={nombre} required size={6} className="campo h-auto">
        {visibles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FormularioAjuste({
  productos,
  almacenes,
}: {
  productos: OpcionSelect[];
  almacenes: OpcionSelect[];
}) {
  const [estado, accion] = useActionState<Resultado | null, FormData>(ajustarStock, null);
  const [sentido, setSentido] = useState('ENTRADA');

  return (
    <form action={accion} className="space-y-4">
      <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Un ajuste corrige el saldo del kardex cuando el conteo físico no coincide con el sistema
        (mermas, roturas, sobrantes). Queda registrado con el motivo y el usuario.
      </p>

      <Grupo etiqueta="Producto">
        <SelectorProducto productos={productos} nombre="productoId" />
      </Grupo>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Almacén">
          <select name="almacenId" required className="campo">
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Sentido">
          <select
            name="sentido"
            value={sentido}
            onChange={(e) => setSentido(e.target.value)}
            className="campo"
          >
            <option value="ENTRADA">Entrada (+)</option>
            <option value="SALIDA">Salida (−)</option>
          </select>
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Cantidad">
          <input
            type="number"
            step="0.01"
            min={0.01}
            name="cantidad"
            required
            className="campo text-right"
          />
        </Campo>

        {sentido === 'ENTRADA' && (
          <Campo etiqueta="Costo unitario" ayuda="Sin IGV. Si lo dejas en 0 se usa el costo vigente.">
            <input
              type="number"
              step="0.01"
              min={0}
              name="costoUnitario"
              className="campo text-right"
            />
          </Campo>
        )}
      </div>

      <Campo etiqueta="Motivo">
        <textarea
          name="motivo"
          required
          rows={2}
          placeholder="Ej. Conteo físico del 12/08: faltaban 2 unidades."
          className="campo"
        />
      </Campo>

      <Aviso resultado={estado} />
      <BotonEnvio className="w-full">Registrar ajuste</BotonEnvio>
    </form>
  );
}

export function FormularioTransferencia({
  productos,
  almacenes,
}: {
  productos: OpcionSelect[];
  almacenes: OpcionSelect[];
}) {
  const [estado, accion] = useActionState<Resultado | null, FormData>(transferirStock, null);

  return (
    <form action={accion} className="space-y-4">
      <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Mueve stock de la tienda al taller (o al revés) manteniendo el costo. Es lo que se usa
        cuando el mecánico necesita repuestos para trabajar.
      </p>

      <Grupo etiqueta="Producto">
        <SelectorProducto productos={productos} nombre="productoId" />
      </Grupo>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Desde">
          <select name="origenId" required className="campo">
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Hacia">
          <select name="destinoId" required className="campo" defaultValue={almacenes[1]?.id}>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo etiqueta="Cantidad">
        <input
          type="number"
          step="0.01"
          min={0.01}
          name="cantidad"
          required
          className="campo text-right"
        />
      </Campo>

      <Campo etiqueta="Nota">
        <input name="nota" placeholder="Opcional" className="campo" />
      </Campo>

      <Aviso resultado={estado} />
      <BotonEnvio className="w-full">Transferir</BotonEnvio>
    </form>
  );
}

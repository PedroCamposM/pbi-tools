'use client';

import { useActionState, useState } from 'react';
import { guardarCliente } from '@/actions/terceros';
import { Aviso, BotonEnvio, Campo } from '@/components/ui/basicos';
import { TIPOS_CLIENTE, TIPOS_DOCUMENTO_IDENTIDAD } from '@/lib/constantes';
import type { Resultado } from '@/lib/resultado';

type ClienteEditable = {
  id: number;
  tipoDocumento: string;
  numeroDocumento: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  tipoCliente: string;
  lineaCredito: number;
  diasCredito: number;
  activo: boolean;
};

export function FormularioCliente({ cliente }: { cliente?: ClienteEditable }) {
  const [estado, accion] = useActionState<Resultado<{ id: number }> | null, FormData>(
    guardarCliente,
    null,
  );
  const [tipoDocumento, setTipoDocumento] = useState(cliente?.tipoDocumento ?? 'DNI');

  return (
    <form action={accion} className="space-y-4">
      {cliente && <input type="hidden" name="id" value={cliente.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Tipo de documento">
          <select
            name="tipoDocumento"
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value)}
            className="campo"
          >
            {TIPOS_DOCUMENTO_IDENTIDAD.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          etiqueta="Número"
          ayuda={tipoDocumento === 'RUC' ? 'Necesario para emitir factura' : undefined}
        >
          <input
            name="numeroDocumento"
            required
            defaultValue={cliente?.numeroDocumento}
            inputMode="numeric"
            className="campo font-mono"
          />
        </Campo>
      </div>

      <Campo etiqueta={tipoDocumento === 'RUC' ? 'Razón social' : 'Nombre completo'}>
        <input name="nombre" required defaultValue={cliente?.nombre} className="campo" />
      </Campo>

      <Campo etiqueta="Dirección">
        <input name="direccion" defaultValue={cliente?.direccion ?? ''} className="campo" />
      </Campo>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Teléfono">
          <input name="telefono" defaultValue={cliente?.telefono ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Correo">
          <input type="email" name="email" defaultValue={cliente?.email ?? ''} className="campo" />
        </Campo>
      </div>

      <Campo etiqueta="Tipo de cliente" ayuda="Define qué lista de precios se aplica en el POS">
        <select name="tipoCliente" defaultValue={cliente?.tipoCliente ?? 'PUBLICO'} className="campo">
          {TIPOS_CLIENTE.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>
      </Campo>

      <fieldset className="rounded-md border border-slate-200 p-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Crédito
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Línea de crédito" ayuda="0 = solo vende al contado">
            <input
              type="number"
              step="0.01"
              min={0}
              name="lineaCredito"
              defaultValue={cliente?.lineaCredito ?? 0}
              className="campo text-right"
            />
          </Campo>
          <Campo etiqueta="Días de crédito">
            <input
              type="number"
              min={0}
              name="diasCredito"
              defaultValue={cliente?.diasCredito ?? 0}
              className="campo text-right"
            />
          </Campo>
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={cliente?.activo ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        Cliente activo
      </label>

      <Aviso resultado={estado} />
      <BotonEnvio className="w-full">{cliente ? 'Guardar cambios' : 'Registrar cliente'}</BotonEnvio>
    </form>
  );
}

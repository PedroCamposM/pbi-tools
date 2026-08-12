'use client';

import { useActionState } from 'react';
import { guardarSerie } from '@/actions/configuracion';
import { Aviso, BotonEnvio, Campo } from '@/components/ui/basicos';
import type { Resultado } from '@/lib/resultado';

type SerieEditable = {
  id: number;
  tipoComprobante: string;
  serie: string;
  correlativo: number;
  predeterminada: boolean;
  activa: boolean;
};

export function FormularioSerie({ serie }: { serie?: SerieEditable }) {
  const [estado, accion] = useActionState<Resultado | null, FormData>(guardarSerie, null);

  return (
    <form action={accion} className="space-y-4">
      {serie && <input type="hidden" name="id" value={serie.id} />}

      <Campo etiqueta="Tipo de comprobante">
        <select
          name="tipoComprobante"
          required
          defaultValue={serie?.tipoComprobante}
          className="campo"
        >
          <option value="FACTURA">Factura (serie F###)</option>
          <option value="BOLETA">Boleta (serie B###)</option>
          <option value="NOTA_CREDITO">Nota de crédito (serie F###)</option>
          <option value="NOTA_DEBITO">Nota de débito (serie F###)</option>
          <option value="NOTA_VENTA">Nota de venta interna (serie N###)</option>
        </select>
      </Campo>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Serie" ayuda="4 caracteres, ej. F001">
          <input
            name="serie"
            required
            maxLength={4}
            defaultValue={serie?.serie}
            placeholder="F001"
            className="campo font-mono uppercase"
          />
        </Campo>

        <Campo etiqueta="Último correlativo emitido">
          <input
            type="number"
            min={0}
            name="correlativo"
            defaultValue={serie?.correlativo ?? 0}
            className="campo text-right"
          />
        </Campo>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="predeterminada"
          defaultChecked={serie?.predeterminada ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        Usar como serie predeterminada de este tipo
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="activa"
          defaultChecked={serie?.activa ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        Serie activa
      </label>

      <Aviso resultado={estado} />
      <BotonEnvio className="w-full">{serie ? 'Guardar cambios' : 'Crear serie'}</BotonEnvio>
    </form>
  );
}

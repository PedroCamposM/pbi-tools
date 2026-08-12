'use client';

import { useActionState } from 'react';
import { guardarAlmacen } from '@/actions/configuracion';
import { Aviso, BotonEnvio, Campo } from '@/components/ui/basicos';
import type { Resultado } from '@/lib/resultado';

type AlmacenEditable = {
  id: number;
  nombre: string;
  direccion: string | null;
  esTaller: boolean;
  predeterminado: boolean;
  activo: boolean;
};

export function FormularioAlmacen({ almacen }: { almacen?: AlmacenEditable }) {
  const [estado, accion] = useActionState<Resultado | null, FormData>(guardarAlmacen, null);

  return (
    <form action={accion} className="space-y-4">
      {almacen && <input type="hidden" name="id" value={almacen.id} />}

      <Campo etiqueta="Nombre">
        <input name="nombre" required defaultValue={almacen?.nombre} className="campo" />
      </Campo>

      <Campo etiqueta="Dirección">
        <input name="direccion" defaultValue={almacen?.direccion ?? ''} className="campo" />
      </Campo>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="esTaller"
          defaultChecked={almacen?.esTaller ?? false}
          className="h-4 w-4 rounded border-slate-300"
        />
        Es el almacén del taller
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="predeterminado"
          defaultChecked={almacen?.predeterminado ?? false}
          className="h-4 w-4 rounded border-slate-300"
        />
        Almacén predeterminado para ventas
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={almacen?.activo ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        Activo
      </label>

      <Aviso resultado={estado} />
      <BotonEnvio className="w-full">{almacen ? 'Guardar cambios' : 'Crear almacén'}</BotonEnvio>
    </form>
  );
}

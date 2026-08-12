'use client';

import { useActionState } from 'react';
import { guardarProveedor } from '@/actions/terceros';
import { Aviso, BotonEnvio, Campo } from '@/components/ui/basicos';
import { TIPOS_DOCUMENTO_IDENTIDAD } from '@/lib/constantes';
import type { Resultado } from '@/lib/resultado';

type ProveedorEditable = {
  id: number;
  tipoDocumento: string;
  numeroDocumento: string;
  razonSocial: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  contacto: string | null;
  diasCredito: number;
  activo: boolean;
};

export function FormularioProveedor({ proveedor }: { proveedor?: ProveedorEditable }) {
  const [estado, accion] = useActionState<Resultado<{ id: number }> | null, FormData>(
    guardarProveedor,
    null,
  );

  return (
    <form action={accion} className="space-y-4">
      {proveedor && <input type="hidden" name="id" value={proveedor.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Tipo de documento">
          <select
            name="tipoDocumento"
            defaultValue={proveedor?.tipoDocumento ?? 'RUC'}
            className="campo"
          >
            {TIPOS_DOCUMENTO_IDENTIDAD.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Número">
          <input
            name="numeroDocumento"
            required
            defaultValue={proveedor?.numeroDocumento}
            className="campo font-mono"
          />
        </Campo>
      </div>

      <Campo etiqueta="Razón social">
        <input name="razonSocial" required defaultValue={proveedor?.razonSocial} className="campo" />
      </Campo>

      <Campo etiqueta="Dirección">
        <input name="direccion" defaultValue={proveedor?.direccion ?? ''} className="campo" />
      </Campo>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Persona de contacto">
          <input name="contacto" defaultValue={proveedor?.contacto ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Teléfono">
          <input name="telefono" defaultValue={proveedor?.telefono ?? ''} className="campo" />
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Correo">
          <input name="email" defaultValue={proveedor?.email ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Días de crédito">
          <input
            type="number"
            min={0}
            name="diasCredito"
            defaultValue={proveedor?.diasCredito ?? 0}
            className="campo text-right"
          />
        </Campo>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={proveedor?.activo ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        Proveedor activo
      </label>

      <Aviso resultado={estado} />
      <BotonEnvio className="w-full">
        {proveedor ? 'Guardar cambios' : 'Registrar proveedor'}
      </BotonEnvio>
    </form>
  );
}

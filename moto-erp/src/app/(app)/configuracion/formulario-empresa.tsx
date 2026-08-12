'use client';

import { useActionState } from 'react';
import { guardarEmpresa } from '@/actions/configuracion';
import { Aviso, BotonEnvio, Campo } from '@/components/ui/basicos';
import type { Resultado } from '@/lib/resultado';

type EmpresaEditable = {
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  direccion: string;
  ubigeo: string;
  distrito: string | null;
  provincia: string | null;
  departamento: string | null;
  telefono: string | null;
  email: string | null;
  igvPorcentaje: number;
  regimen: string;
  piePagina: string | null;
};

export function FormularioEmpresa({ empresa }: { empresa?: EmpresaEditable }) {
  const [estado, accion] = useActionState<Resultado | null, FormData>(guardarEmpresa, null);

  return (
    <form action={accion} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="RUC">
          <input
            name="ruc"
            required
            maxLength={11}
            defaultValue={empresa?.ruc}
            className="campo font-mono"
          />
        </Campo>
        <Campo etiqueta="Razón social" className="sm:col-span-2">
          <input name="razonSocial" required defaultValue={empresa?.razonSocial} className="campo" />
        </Campo>
      </div>

      <Campo etiqueta="Nombre comercial" ayuda="El que ve el cliente en el comprobante">
        <input
          name="nombreComercial"
          defaultValue={empresa?.nombreComercial ?? ''}
          className="campo"
        />
      </Campo>

      <Campo etiqueta="Dirección fiscal">
        <input name="direccion" required defaultValue={empresa?.direccion} className="campo" />
      </Campo>

      <div className="grid gap-3 sm:grid-cols-4">
        <Campo etiqueta="Ubigeo" ayuda="6 dígitos (INEI)">
          <input
            name="ubigeo"
            required
            maxLength={6}
            defaultValue={empresa?.ubigeo ?? '150101'}
            className="campo font-mono"
          />
        </Campo>
        <Campo etiqueta="Distrito">
          <input name="distrito" defaultValue={empresa?.distrito ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Provincia">
          <input name="provincia" defaultValue={empresa?.provincia ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Departamento">
          <input name="departamento" defaultValue={empresa?.departamento ?? ''} className="campo" />
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Campo etiqueta="Teléfono">
          <input name="telefono" defaultValue={empresa?.telefono ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Correo">
          <input name="email" defaultValue={empresa?.email ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="IGV %">
          <input
            type="number"
            step="0.01"
            name="igvPorcentaje"
            defaultValue={empresa?.igvPorcentaje ?? 18}
            className="campo text-right"
          />
        </Campo>
        <Campo etiqueta="Régimen tributario">
          <select name="regimen" defaultValue={empresa?.regimen ?? 'MYPE_TRIBUTARIO'} className="campo">
            <option value="NRUS">Nuevo RUS</option>
            <option value="RER">Régimen Especial (RER)</option>
            <option value="MYPE_TRIBUTARIO">Régimen MYPE Tributario</option>
            <option value="GENERAL">Régimen General</option>
          </select>
        </Campo>
      </div>

      <Campo etiqueta="Pie de página del comprobante">
        <input
          name="piePagina"
          defaultValue={empresa?.piePagina ?? ''}
          placeholder="Ej. Gracias por su compra. No se aceptan devoluciones sin comprobante."
          className="campo"
        />
      </Campo>

      <Aviso resultado={estado} />
      <BotonEnvio>Guardar datos de la empresa</BotonEnvio>
    </form>
  );
}

'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { guardarTecnico, vincularClienteTecnico } from '@/actions/terceros';
import { liquidarComisiones } from '@/actions/comisiones';
import { Aviso, BotonEnvio, Campo } from '@/components/ui/basicos';
import { METODOS_PAGO } from '@/lib/constantes';
import type { Resultado } from '@/lib/resultado';

type TecnicoEditable = {
  id: number;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  taller: string | null;
  direccion: string | null;
  comisionVentaPct: number;
  comisionServicioPct: number;
  activo: boolean;
};

export function FormularioTecnico({ tecnico }: { tecnico?: TecnicoEditable }) {
  const [estado, accion] = useActionState<Resultado<{ id: number }> | null, FormData>(
    guardarTecnico,
    null,
  );

  return (
    <form action={accion} className="space-y-4">
      {tecnico && <input type="hidden" name="id" value={tecnico.id} />}

      <Campo etiqueta="Nombre">
        <input name="nombre" required defaultValue={tecnico?.nombre} className="campo" />
      </Campo>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="DNI / RUC" ayuda="Necesario para venderle al crédito">
          <input
            name="documento"
            defaultValue={tecnico?.documento ?? ''}
            className="campo font-mono"
          />
        </Campo>
        <Campo etiqueta="Teléfono">
          <input name="telefono" defaultValue={tecnico?.telefono ?? ''} className="campo" />
        </Campo>
      </div>

      <Campo etiqueta="Taller">
        <input
          name="taller"
          defaultValue={tecnico?.taller ?? ''}
          placeholder="Nombre del taller donde trabaja"
          className="campo"
        />
      </Campo>

      <Campo etiqueta="Dirección">
        <input name="direccion" defaultValue={tecnico?.direccion ?? ''} className="campo" />
      </Campo>

      <fieldset className="rounded-md border border-slate-200 p-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Comisiones
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="% sobre ventas" ayuda="Sobre el valor de venta sin IGV">
            <input
              type="number"
              step="0.01"
              min={0}
              max={100}
              name="comisionVentaPct"
              defaultValue={tecnico?.comisionVentaPct ?? 0}
              className="campo text-right"
            />
          </Campo>
          <Campo etiqueta="% sobre mano de obra" ayuda="De las órdenes de trabajo que ejecuta">
            <input
              type="number"
              step="0.01"
              min={0}
              max={100}
              name="comisionServicioPct"
              defaultValue={tecnico?.comisionServicioPct ?? 0}
              className="campo text-right"
            />
          </Campo>
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={tecnico?.activo ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        Técnico activo
      </label>

      <Aviso resultado={estado} />
      <BotonEnvio className="w-full">{tecnico ? 'Guardar cambios' : 'Registrar técnico'}</BotonEnvio>
    </form>
  );
}

export function FormularioLiquidacion({
  tecnicos,
  fechaDesde,
  fechaHasta,
}: {
  tecnicos: { id: number; nombre: string; pendiente: number }[];
  fechaDesde: string;
  fechaHasta: string;
}) {
  const [estado, accion] = useActionState<
    Resultado<{ total: number; cantidad: number }> | null,
    FormData
  >(liquidarComisiones, null);
  const [tecnicoId, setTecnicoId] = useState('');

  const seleccionado = tecnicos.find((t) => String(t.id) === tecnicoId);

  return (
    <form action={accion} className="space-y-4">
      <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Se liquidan todas las comisiones pendientes del técnico dentro del periodo. El pago se
        registra como egreso en tu caja abierta.
      </p>

      <Campo etiqueta="Técnico">
        <select
          name="tecnicoId"
          required
          value={tecnicoId}
          onChange={(e) => setTecnicoId(e.target.value)}
          className="campo"
        >
          <option value="">Seleccionar…</option>
          {tecnicos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} — S/ {t.pendiente.toFixed(2)} pendiente
            </option>
          ))}
        </select>
      </Campo>

      {seleccionado && seleccionado.pendiente === 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Este técnico no tiene comisiones pendientes.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Desde">
          <input type="date" name="fechaDesde" required defaultValue={fechaDesde} className="campo" />
        </Campo>
        <Campo etiqueta="Hasta">
          <input type="date" name="fechaHasta" required defaultValue={fechaHasta} className="campo" />
        </Campo>
      </div>

      <Campo etiqueta="Medio de pago">
        <select name="metodoPago" className="campo">
          {METODOS_PAGO.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.etiqueta}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Observación">
        <input name="observacion" className="campo" />
      </Campo>

      <Aviso resultado={estado} />
      <BotonEnvio className="w-full">Liquidar y pagar</BotonEnvio>
    </form>
  );
}

export function BotonVincularCliente({ tecnicoId }: { tecnicoId: number }) {
  const router = useRouter();
  const [procesando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={procesando}
        onClick={() =>
          iniciar(async () => {
            const resultado = await vincularClienteTecnico(tecnicoId);
            if (resultado.ok) router.refresh();
            else setError(resultado.error);
          })
        }
        className="text-xs font-semibold text-marca-600 hover:underline disabled:opacity-50"
      >
        {procesando ? 'Creando…' : 'Crear ficha de cliente'}
      </button>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

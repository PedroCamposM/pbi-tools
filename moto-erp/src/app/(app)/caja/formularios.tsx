'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { abrirCaja, cerrarCaja, registrarMovimientoCaja } from '@/actions/caja';
import { Aviso, BotonEnvio, Campo } from '@/components/ui/basicos';
import { CATEGORIAS_MOVIMIENTO_CAJA, METODOS_PAGO } from '@/lib/constantes';
import type { Resultado } from '@/lib/resultado';

const soles = (v: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(v);

export function FormularioApertura() {
  const router = useRouter();
  const [estado, accion] = useActionState<Resultado<{ id: number }> | null, FormData>(
    abrirCaja,
    null,
  );

  useEffect(() => {
    if (estado?.ok) router.refresh();
  }, [estado, router]);

  return (
    <form action={accion} className="space-y-4">
      <Campo etiqueta="Monto de apertura" ayuda="Efectivo con el que empiezas el turno">
        <input
          type="number"
          step="0.01"
          min={0}
          name="montoApertura"
          required
          defaultValue={0}
          autoFocus
          className="campo text-right text-lg"
        />
      </Campo>

      <Campo etiqueta="Observación">
        <input name="observacion" className="campo" />
      </Campo>

      <Aviso resultado={estado} />
      <BotonEnvio className="w-full">Abrir caja</BotonEnvio>
    </form>
  );
}

export function FormularioCierre({
  cajaSesionId,
  esperado,
}: {
  cajaSesionId: number;
  esperado: number;
}) {
  const router = useRouter();
  const [estado, accion] = useActionState<Resultado<{ diferencia: number }> | null, FormData>(
    cerrarCaja,
    null,
  );
  const [contado, setContado] = useState('');

  const diferencia = contado === '' ? null : Math.round((Number(contado) - esperado) * 100) / 100;

  useEffect(() => {
    if (estado?.ok) router.refresh();
  }, [estado, router]);

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="cajaSesionId" value={cajaSesionId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Efectivo contado">
          <input
            type="number"
            step="0.01"
            min={0}
            name="montoCierre"
            required
            value={contado}
            onChange={(e) => setContado(e.target.value)}
            className="campo text-right text-lg"
          />
        </Campo>

        <div>
          <span className="etiqueta-campo">Diferencia</span>
          <p
            className={`rounded-md px-3 py-2 text-right text-lg font-bold ${
              diferencia === null
                ? 'bg-slate-100 text-slate-400'
                : diferencia === 0
                  ? 'bg-emerald-50 text-emerald-800'
                  : diferencia > 0
                    ? 'bg-marca-50 text-marca-800'
                    : 'bg-red-50 text-red-800'
            }`}
          >
            {diferencia === null ? '—' : soles(diferencia)}
          </p>
        </div>
      </div>

      <Campo etiqueta="Observación del cierre">
        <input
          name="observacion"
          placeholder="Ej. Falta S/ 5 por vuelto mal dado en la tarde"
          className="campo"
        />
      </Campo>

      <Aviso resultado={estado} />
      <BotonEnvio variante="peligro" className="w-full">
        Cerrar caja
      </BotonEnvio>
    </form>
  );
}

export function FormularioMovimiento() {
  const router = useRouter();
  const [estado, accion] = useActionState<Resultado | null, FormData>(
    registrarMovimientoCaja,
    null,
  );
  const [tipo, setTipo] = useState('EGRESO');

  useEffect(() => {
    if (estado?.ok) router.refresh();
  }, [estado, router]);

  return (
    <form action={accion} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTipo('INGRESO')}
          className={
            tipo === 'INGRESO'
              ? 'rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white'
              : 'rounded-md border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50'
          }
        >
          Ingreso
        </button>
        <button
          type="button"
          onClick={() => setTipo('EGRESO')}
          className={
            tipo === 'EGRESO'
              ? 'rounded-md bg-red-600 py-2 text-sm font-semibold text-white'
              : 'rounded-md border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50'
          }
        >
          Egreso
        </button>
      </div>
      <input type="hidden" name="tipo" value={tipo} />

      <Campo etiqueta="Categoría">
        <select name="categoria" className="campo">
          {CATEGORIAS_MOVIMIENTO_CAJA.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.etiqueta}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Concepto">
        <input
          name="concepto"
          required
          placeholder="Ej. Movilidad para recoger mercadería"
          className="campo"
        />
      </Campo>

      <div className="grid grid-cols-2 gap-2">
        <Campo etiqueta="Monto">
          <input
            type="number"
            step="0.01"
            min={0.01}
            name="monto"
            required
            className="campo text-right"
          />
        </Campo>
        <Campo etiqueta="Medio">
          <select name="metodoPago" className="campo">
            {METODOS_PAGO.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo etiqueta="Referencia">
        <input name="referencia" placeholder="N° de operación o documento" className="campo" />
      </Campo>

      <Aviso resultado={estado} />
      <BotonEnvio variante="secundario" className="w-full">
        Registrar
      </BotonEnvio>
    </form>
  );
}

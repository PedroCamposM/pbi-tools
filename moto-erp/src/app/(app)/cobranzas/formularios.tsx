'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { registrarCobro, registrarPagoProveedor } from '@/actions/cobranzas';
import { Aviso, BotonEnvio, Campo } from '@/components/ui/basicos';
import { METODOS_PAGO } from '@/lib/constantes';
import type { Resultado } from '@/lib/resultado';

const soles = (v: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(v);

export function FormularioCobro({
  cuentaId,
  cliente,
  comprobante,
  saldo,
}: {
  cuentaId: number;
  cliente: string;
  comprobante: string;
  saldo: number;
}) {
  const router = useRouter();
  const [estado, accion] = useActionState<Resultado | null, FormData>(registrarCobro, null);

  useEffect(() => {
    if (estado?.ok) router.refresh();
  }, [estado, router]);

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="cuentaId" value={cuentaId} />

      <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
        <p className="font-medium text-slate-800">{cliente}</p>
        <p className="text-xs text-slate-500">Comprobante {comprobante}</p>
        <p className="mt-1 text-lg font-bold text-amber-700">Saldo {soles(saldo)}</p>
      </div>

      <Campo etiqueta="Monto a cobrar">
        <input
          type="number"
          step="0.01"
          min={0.01}
          max={saldo}
          name="monto"
          required
          defaultValue={saldo}
          autoFocus
          className="campo text-right text-lg"
        />
      </Campo>

      <Campo etiqueta="Medio de pago">
        <select name="metodoPago" className="campo">
          {METODOS_PAGO.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.etiqueta}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Referencia">
        <input name="referencia" placeholder="N° de operación" className="campo" />
      </Campo>

      <Aviso resultado={estado} />
      <BotonEnvio className="w-full">Registrar cobro</BotonEnvio>

      <p className="text-xs text-slate-500">
        El cobro entra como ingreso a tu caja abierta.
      </p>
    </form>
  );
}

export function FormularioPagoProveedor({
  cuentaId,
  proveedor,
  documento,
  saldo,
}: {
  cuentaId: number;
  proveedor: string;
  documento: string;
  saldo: number;
}) {
  const router = useRouter();
  const [estado, accion] = useActionState<Resultado | null, FormData>(
    registrarPagoProveedor,
    null,
  );

  useEffect(() => {
    if (estado?.ok) router.refresh();
  }, [estado, router]);

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="cuentaId" value={cuentaId} />

      <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
        <p className="font-medium text-slate-800">{proveedor}</p>
        <p className="text-xs text-slate-500">Documento {documento}</p>
        <p className="mt-1 text-lg font-bold text-amber-700">Saldo {soles(saldo)}</p>
      </div>

      <Campo etiqueta="Monto a pagar">
        <input
          type="number"
          step="0.01"
          min={0.01}
          max={saldo}
          name="monto"
          required
          defaultValue={saldo}
          autoFocus
          className="campo text-right text-lg"
        />
      </Campo>

      <Campo etiqueta="Medio de pago">
        <select name="metodoPago" className="campo">
          {METODOS_PAGO.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.etiqueta}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Referencia">
        <input name="referencia" placeholder="N° de operación" className="campo" />
      </Campo>

      <Aviso resultado={estado} />
      <BotonEnvio className="w-full">Registrar pago</BotonEnvio>

      <p className="text-xs text-slate-500">El pago sale como egreso de tu caja abierta.</p>
    </form>
  );
}

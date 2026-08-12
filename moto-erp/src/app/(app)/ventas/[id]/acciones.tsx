'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { anularVenta, reenviarComprobante } from '@/actions/ventas';
import { MOTIVOS_NOTA_CREDITO } from '@/lib/sunat/catalogos';
import { Campo } from '@/components/ui/basicos';

export function AccionesVenta({
  ventaId,
  estado,
  tipoComprobante,
  estadoSunat,
}: {
  ventaId: number;
  estado: string;
  tipoComprobante: string;
  estadoSunat: string | null;
}) {
  const router = useRouter();
  const [procesando, iniciar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [motivoCodigo, setMotivoCodigo] = useState('01');
  const [motivo, setMotivo] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const esNota = tipoComprobante === 'NOTA_CREDITO' || tipoComprobante === 'NOTA_DEBITO';
  const puedeAnular = estado === 'EMITIDA' && !esNota;
  const puedeReenviar =
    estadoSunat !== null && estadoSunat !== 'ACEPTADO' && estadoSunat !== 'NO_APLICA';

  function confirmarAnulacion() {
    if (!motivo.trim()) {
      setMensaje({ tipo: 'error', texto: 'Escribe el motivo de la anulación.' });
      return;
    }

    iniciar(async () => {
      const resultado = await anularVenta(ventaId, motivoCodigo, motivo);
      if (resultado.ok) {
        setAbierto(false);
        setMensaje({ tipo: 'ok', texto: resultado.mensaje ?? 'Venta anulada.' });
        router.refresh();
      } else {
        setMensaje({ tipo: 'error', texto: resultado.error });
      }
    });
  }

  function reenviar() {
    iniciar(async () => {
      const resultado = await reenviarComprobante(ventaId);
      setMensaje(
        resultado.ok
          ? { tipo: 'ok', texto: resultado.mensaje ?? 'Reenviado.' }
          : { tipo: 'error', texto: resultado.error },
      );
      router.refresh();
    });
  }

  return (
    <>
      {puedeReenviar && (
        <button type="button" onClick={reenviar} disabled={procesando} className="boton-secundario">
          Reenviar a SUNAT
        </button>
      )}

      {puedeAnular && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          disabled={procesando}
          className="boton-peligro"
        >
          Anular
        </button>
      )}

      {mensaje && (
        <p
          className={
            mensaje.tipo === 'ok'
              ? 'w-full rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
              : 'w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
          }
        >
          {mensaje.texto}
        </p>
      )}

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setAbierto(false)} />
          <div className="relative w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-800">Anular comprobante</h2>

            <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {tipoComprobante === 'NOTA_VENTA'
                ? 'Se anulará el documento interno y el stock volverá al almacén.'
                : 'Se emitirá una nota de crédito que deja sin efecto el comprobante, el stock volverá al almacén y se cancelará la cuenta por cobrar.'}
            </p>

            {tipoComprobante !== 'NOTA_VENTA' && (
              <Campo etiqueta="Motivo (catálogo 09 SUNAT)">
                <select
                  value={motivoCodigo}
                  onChange={(e) => setMotivoCodigo(e.target.value)}
                  className="campo"
                >
                  {MOTIVOS_NOTA_CREDITO.map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.codigo} — {m.descripcion}
                    </option>
                  ))}
                </select>
              </Campo>
            )}

            <Campo etiqueta="Detalle">
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                placeholder="Ej. El cliente devolvió el repuesto por incompatibilidad."
                className="campo"
              />
            </Campo>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="boton-secundario"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarAnulacion}
                disabled={procesando}
                className="boton-peligro"
              >
                {procesando ? 'Anulando…' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

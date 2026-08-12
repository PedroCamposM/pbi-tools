'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { anularCompra } from '@/actions/compras';

export function AnularCompra({ compraId }: { compraId: number }) {
  const router = useRouter();
  const [procesando, iniciar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      {!abierto ? (
        <button type="button" onClick={() => setAbierto(true)} className="boton-peligro">
          Anular compra
        </button>
      ) : (
        <div className="w-72 space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-800">
            Se revierte el ingreso al kardex y se anula la cuenta por pagar.
          </p>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo"
            className="campo"
          />
          {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="boton-secundario flex-1"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={procesando}
              onClick={() =>
                iniciar(async () => {
                  if (!motivo.trim()) return setError('Escribe el motivo.');
                  const r = await anularCompra(compraId, motivo);
                  if (r.ok) {
                    setAbierto(false);
                    router.refresh();
                  } else setError(r.error);
                })
              }
              className="boton-peligro flex-1"
            >
              {procesando ? '…' : 'Anular'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

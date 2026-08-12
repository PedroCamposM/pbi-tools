'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

/**
 * Panel deslizante que se usa para los formularios de alta/edición sin salir
 * del listado. Mantiene el flujo rápido en mostrador.
 */
export function PanelLateral({
  titulo,
  etiquetaBoton,
  children,
  varianteBoton = 'primario',
  abiertoInicial = false,
  ancho = 'max-w-lg',
}: {
  titulo: string;
  etiquetaBoton: string;
  children: React.ReactNode;
  varianteBoton?: 'primario' | 'secundario';
  abiertoInicial?: boolean;
  ancho?: string;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);

  useEffect(() => {
    if (!abierto) return;
    const cerrarConEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('keydown', cerrarConEscape);
    return () => document.removeEventListener('keydown', cerrarConEscape);
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={varianteBoton === 'primario' ? 'boton-primario' : 'boton-secundario'}
      >
        {etiquetaBoton}
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setAbierto(false)}
            aria-hidden
          />
          <div
            className={clsx(
              'relative flex h-full w-full flex-col overflow-y-auto bg-white shadow-xl',
              ancho,
            )}
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
              <h2 className="text-base font-semibold text-slate-800">{titulo}</h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import { useFormStatus } from 'react-dom';
import clsx from 'clsx';
import type { Resultado } from '@/lib/resultado';
import { COLORES_INSIGNIA, type ColorInsignia } from '@/lib/estados';

/** Botón que se deshabilita solo mientras la server action está corriendo. */
export function BotonEnvio({
  children,
  className,
  variante = 'primario',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'peligro';
}) {
  const { pending } = useFormStatus();
  const clase =
    variante === 'primario'
      ? 'boton-primario'
      : variante === 'peligro'
        ? 'boton-peligro'
        : 'boton-secundario';

  return (
    <button type="submit" disabled={pending} className={clsx(clase, className)} {...props}>
      {pending ? 'Guardando…' : children}
    </button>
  );
}

/** Muestra el resultado de una server action. */
export function Aviso({ resultado }: { resultado: Resultado<unknown> | null }) {
  if (!resultado) return null;

  if (resultado.ok) {
    if (!resultado.mensaje) return null;
    return (
      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        {resultado.mensaje}
      </p>
    );
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <p>{resultado.error}</p>
      {resultado.campos && (
        <ul className="mt-1 list-inside list-disc text-xs">
          {Object.entries(resultado.campos).map(([campo, mensaje]) => (
            <li key={campo}>
              <span className="font-semibold">{campo}:</span> {mensaje}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Insignia({
  children,
  color = 'gris',
}: {
  children: React.ReactNode;
  color?: ColorInsignia;
}) {
  return <span className={clsx('insignia', COLORES_INSIGNIA[color])}>{children}</span>;
}

/**
 * Campo de formulario con su etiqueta. Envuelve el control en un <label>, así
 * que solo debe contener UN control de formulario (input, select o textarea).
 *
 * Si el bloque incluye botones, listas de resultados o varios controles, usa
 * `Grupo`: los elementos interactivos dentro de un <label> son HTML inválido y
 * el navegador reenvía el clic al control asociado, lo que hace que se pierdan
 * las actualizaciones de estado de React.
 */
export function Campo({
  etiqueta,
  children,
  ayuda,
  className,
}: {
  etiqueta: string;
  children: React.ReactNode;
  ayuda?: string;
  className?: string;
}) {
  return (
    <label className={clsx('block', className)}>
      <span className="etiqueta-campo">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-slate-500">{ayuda}</span>}
    </label>
  );
}

/** Bloque etiquetado para contenido con botones o varios controles. */
export function Grupo({
  etiqueta,
  children,
  ayuda,
  className,
}: {
  etiqueta: string;
  children: React.ReactNode;
  ayuda?: string;
  className?: string;
}) {
  return (
    <div className={clsx('block', className)}>
      <span className="etiqueta-campo">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-slate-500">{ayuda}</span>}
    </div>
  );
}

export function SinDatos({ mensaje = 'No hay registros para mostrar.' }: { mensaje?: string }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-slate-500">
      <p>{mensaje}</p>
    </div>
  );
}

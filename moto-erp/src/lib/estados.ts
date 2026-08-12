/**
 * Colores de los estados del sistema.
 *
 * Vive fuera de los componentes cliente a propósito: los listados y fichas son
 * Server Components y necesitan llamar a `colorEstado` durante el render en el
 * servidor, cosa que no se puede hacer con una función exportada desde un
 * módulo marcado con 'use client'.
 */

export type ColorInsignia = 'verde' | 'rojo' | 'ambar' | 'azul' | 'gris' | 'violeta';

export const COLORES_INSIGNIA: Record<ColorInsignia, string> = {
  verde: 'bg-emerald-100 text-emerald-800',
  rojo: 'bg-red-100 text-red-800',
  ambar: 'bg-amber-100 text-amber-800',
  azul: 'bg-marca-100 text-marca-800',
  gris: 'bg-slate-200 text-slate-700',
  violeta: 'bg-violet-100 text-violet-800',
};

/** Color de insignia según el estado del documento. */
export function colorEstado(estado: string): ColorInsignia {
  switch (estado) {
    case 'ACEPTADO':
    case 'EMITIDA':
    case 'PAGADA':
    case 'RECIBIDA':
    case 'TERMINADO':
    case 'LIQUIDADA':
    case 'ABIERTA':
      return 'verde';
    case 'ANULADA':
    case 'ANULADO':
    case 'RECHAZADO':
      return 'rojo';
    case 'PENDIENTE':
    case 'PARCIAL':
    case 'OBSERVADO':
    case 'ESPERANDO_REPUESTOS':
      return 'ambar';
    case 'ENTREGADO':
    case 'EN_PROCESO':
    case 'ENVIADO':
      return 'azul';
    case 'RECEPCION':
    case 'DIAGNOSTICO':
      return 'violeta';
    default:
      return 'gris';
  }
}

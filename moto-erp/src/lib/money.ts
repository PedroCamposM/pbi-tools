import { Prisma } from '@prisma/client';

export type Numerico = Prisma.Decimal | number | string | null | undefined;

/** Construye un Decimal de forma segura desde cualquier entrada. */
export function d(v: Numerico): Prisma.Decimal {
  if (v === null || v === undefined || v === '') return new Prisma.Decimal(0);
  return new Prisma.Decimal(v);
}

export const CERO = () => new Prisma.Decimal(0);

/** Redondeo comercial (mitad hacia arriba), el que usa SUNAT para importes. */
export function redondear(v: Numerico, decimales = 2): Prisma.Decimal {
  return d(v).toDecimalPlaces(decimales, Prisma.Decimal.ROUND_HALF_UP);
}

/** Convierte a number plano para poder serializarlo hacia el cliente. */
export function num(v: Numerico, decimales = 2): number {
  return redondear(v, decimales).toNumber();
}

export function suma(...valores: Numerico[]): Prisma.Decimal {
  return valores.reduce<Prisma.Decimal>((acc, v) => acc.plus(d(v)), CERO());
}

export function esCero(v: Numerico): boolean {
  return d(v).isZero();
}

export function esPositivo(v: Numerico): boolean {
  return d(v).greaterThan(0);
}

/** Formatea un importe como moneda peruana: S/ 1,234.50 */
export function soles(v: Numerico): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(num(v));
}

/** Formatea un numero sin simbolo de moneda. */
export function decimal(v: Numerico, decimales = 2): string {
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(num(v, decimales));
}

/** Cantidad: muestra hasta 3 decimales pero sin ceros innecesarios. */
export function cantidad(v: Numerico): string {
  const n = num(v, 3);
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 3 }).format(n);
}

export function porcentaje(v: Numerico): string {
  return `${decimal(v, 2)}%`;
}

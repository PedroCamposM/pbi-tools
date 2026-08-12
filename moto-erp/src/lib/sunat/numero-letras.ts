/**
 * Conversion de importes a letras para la leyenda 1000 del comprobante.
 * Ejemplo: 1250.40 -> "SON MIL DOSCIENTOS CINCUENTA CON 40/100 SOLES"
 */

const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];

const ESPECIALES: Record<number, string> = {
  10: 'DIEZ',
  11: 'ONCE',
  12: 'DOCE',
  13: 'TRECE',
  14: 'CATORCE',
  15: 'QUINCE',
  16: 'DIECISEIS',
  17: 'DIECISIETE',
  18: 'DIECIOCHO',
  19: 'DIECINUEVE',
  20: 'VEINTE',
  21: 'VEINTIUNO',
  22: 'VEINTIDOS',
  23: 'VEINTITRES',
  24: 'VEINTICUATRO',
  25: 'VEINTICINCO',
  26: 'VEINTISEIS',
  27: 'VEINTISIETE',
  28: 'VEINTIOCHO',
  29: 'VEINTINUEVE',
};

const DECENAS = [
  '',
  '',
  'VEINTE',
  'TREINTA',
  'CUARENTA',
  'CINCUENTA',
  'SESENTA',
  'SETENTA',
  'OCHENTA',
  'NOVENTA',
];

const CENTENAS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
];

/** Convierte un grupo de 0 a 999 a letras. */
function grupoALetras(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';

  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];

  if (centena > 0) partes.push(CENTENAS[centena]);

  if (resto > 0) {
    if (resto < 10) {
      partes.push(UNIDADES[resto]);
    } else if (resto <= 29) {
      partes.push(ESPECIALES[resto]);
    } else {
      const decena = Math.floor(resto / 10);
      const unidad = resto % 10;
      partes.push(unidad > 0 ? `${DECENAS[decena]} Y ${UNIDADES[unidad]}` : DECENAS[decena]);
    }
  }

  return partes.join(' ');
}

/** "VEINTIUNO" -> "VEINTIUN" (apocope antes de MIL / MILLONES). */
function apocopar(texto: string): string {
  if (texto === 'UNO') return 'UN';
  return texto.endsWith('UNO') ? `${texto.slice(0, -1)}` : texto;
}

/** Convierte la parte entera de un numero a letras (soporta hasta 999 999 999). */
export function enteroALetras(entero: number): string {
  if (entero === 0) return 'CERO';
  if (entero < 0) return `MENOS ${enteroALetras(Math.abs(entero))}`;

  const millones = Math.floor(entero / 1_000_000);
  const miles = Math.floor((entero % 1_000_000) / 1000);
  const resto = entero % 1000;

  const partes: string[] = [];

  if (millones > 0) {
    partes.push(millones === 1 ? 'UN MILLON' : `${apocopar(enteroALetras(millones))} MILLONES`);
  }

  if (miles > 0) {
    partes.push(miles === 1 ? 'MIL' : `${apocopar(grupoALetras(miles))} MIL`);
  }

  if (resto > 0) partes.push(grupoALetras(resto));

  return partes.join(' ');
}

const NOMBRE_MONEDA: Record<string, string> = {
  PEN: 'SOLES',
  USD: 'DOLARES AMERICANOS',
  EUR: 'EUROS',
};

/**
 * Genera la leyenda completa del comprobante.
 * montoALetras(1250.4) => "SON MIL DOSCIENTOS CINCUENTA CON 40/100 SOLES"
 */
export function montoALetras(monto: number, moneda = 'PEN'): string {
  const redondeado = Math.round(Math.abs(monto) * 100) / 100;
  const entero = Math.floor(redondeado);
  const centimos = Math.round((redondeado - entero) * 100);
  const nombre = NOMBRE_MONEDA[moneda] ?? moneda;

  return `SON ${enteroALetras(entero)} CON ${String(centimos).padStart(2, '0')}/100 ${nombre}`;
}

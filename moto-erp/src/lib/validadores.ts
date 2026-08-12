import { z } from 'zod';

/** Convierte un campo de formulario a number aceptando coma decimal. */
export const numeroForm = (predeterminado = 0) =>
  z.preprocess((v) => {
    if (v === null || v === undefined || v === '') return predeterminado;
    const texto = String(v).replace(/\s/g, '').replace(',', '.');
    const n = Number(texto);
    return Number.isFinite(n) ? n : predeterminado;
  }, z.number());

export const enteroForm = (predeterminado = 0) =>
  z.preprocess((v) => {
    if (v === null || v === undefined || v === '') return predeterminado;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : predeterminado;
  }, z.number().int());

export const idOpcional = z.preprocess(
  (v) => (v === null || v === undefined || v === '' || v === '0' ? null : Number(v)),
  z.number().int().positive().nullable(),
);

export const textoOpcional = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().trim().nullable().optional(),
);

export const booleanoForm = z.preprocess(
  (v) => v === 'on' || v === 'true' || v === true || v === '1',
  z.boolean(),
);

/** Valida el numero de documento segun su tipo. */
export function validarDocumento(tipo: string, numero: string): string | null {
  const limpio = numero.trim();
  switch (tipo) {
    case 'DNI':
      return /^\d{8}$/.test(limpio) ? null : 'El DNI debe tener 8 dígitos.';
    case 'RUC':
      if (!/^\d{11}$/.test(limpio)) return 'El RUC debe tener 11 dígitos.';
      if (!['10', '15', '17', '20'].includes(limpio.slice(0, 2))) {
        return 'El RUC debe empezar con 10, 15, 17 o 20.';
      }
      return null;
    case 'CARNET_EXTRANJERIA':
      return limpio.length >= 8 && limpio.length <= 12
        ? null
        : 'El carnet de extranjería debe tener entre 8 y 12 caracteres.';
    case 'PASAPORTE':
      return limpio.length >= 6 ? null : 'El pasaporte debe tener al menos 6 caracteres.';
    default:
      return null;
  }
}

/**
 * Digito verificador del RUC peruano (modulo 11).
 * Sirve para atajar tipeos antes de emitir una factura.
 */
export function rucValido(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, peso, i) => acc + peso * Number(ruc[i]), 0);
  const resto = 11 - (suma % 11);
  const esperado = resto === 10 ? 0 : resto === 11 ? 1 : resto;
  return esperado === Number(ruc[10]);
}

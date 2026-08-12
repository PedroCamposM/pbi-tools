/**
 * Resultado uniforme de las server actions, para que los formularios puedan
 * mostrar errores sin lanzar excepciones al usuario.
 */

import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export type Resultado<T = undefined> =
  | { ok: true; datos?: T; mensaje?: string }
  | { ok: false; error: string; campos?: Record<string, string> };

export function exito<T>(datos?: T, mensaje?: string): Resultado<T> {
  return { ok: true, datos, mensaje };
}

export function falla(error: string, campos?: Record<string, string>): Resultado<never> {
  return { ok: false, error, campos };
}

/** Traduce cualquier excepcion a un mensaje entendible para el usuario. */
export function desdeError(error: unknown): Resultado<never> {
  if (error instanceof ZodError) {
    const campos: Record<string, string> = {};
    for (const issue of error.issues) {
      const clave = issue.path.join('.') || 'general';
      if (!campos[clave]) campos[clave] = issue.message;
    }
    return falla('Revisa los datos ingresados.', campos);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const campo = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(', ')
        : 'el registro';
      return falla(`Ya existe un registro con ese valor (${campo}).`);
    }
    if (error.code === 'P2003') {
      return falla('No se puede completar: el registro está referenciado por otros documentos.');
    }
    if (error.code === 'P2025') {
      return falla('El registro no existe o ya fue eliminado.');
    }
  }

  if (error instanceof Error) return falla(error.message);

  return falla('Ocurrió un error inesperado.');
}

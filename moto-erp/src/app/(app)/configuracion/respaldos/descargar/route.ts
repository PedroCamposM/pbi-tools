import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { requerirRol, ROLES_ADMIN } from '@/lib/auth';
import { rutaDeRespaldo } from '@/lib/respaldos';

/**
 * Descarga un respaldo al equipo de quien lo pide.
 *
 * Es la parte que convierte esto en un respaldo de verdad: un archivo guardado
 * en el mismo disco que la base no sirve de nada el día que ese disco falla.
 * Desde aquí se copia a un USB o se sube a la nube.
 */
export async function GET(peticion: Request) {
  await requerirRol(...ROLES_ADMIN);

  const archivo = new URL(peticion.url).searchParams.get('archivo') ?? '';
  const ruta = rutaDeRespaldo(archivo);
  if (!ruta) return new NextResponse('Archivo no válido.', { status: 400 });

  let bytes: number;
  try {
    bytes = (await stat(ruta)).size;
  } catch {
    return new NextResponse('Ese respaldo ya no existe.', { status: 404 });
  }

  // En streaming: un respaldo grande no tiene por qué pasar entero por memoria.
  const cuerpo = Readable.toWeb(createReadStream(ruta)) as ReadableStream;

  return new NextResponse(cuerpo, {
    headers: {
      'Content-Type': 'application/sql; charset=utf-8',
      'Content-Length': String(bytes),
      'Content-Disposition': `attachment; filename="${archivo}"`,
    },
  });
}

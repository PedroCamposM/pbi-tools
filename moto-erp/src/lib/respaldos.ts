/**
 * Respaldos de la base de datos.
 *
 * Un ERP sin respaldos es una bomba de tiempo: si el disco falla, se pierde la
 * contabilidad, el stock y los comprobantes emitidos. Este módulo genera un
 * archivo `.sql` restaurable y se encarga de que exista uno por día sin que
 * nadie tenga que acordarse.
 *
 * Hay dos formas de generar el volcado y el sistema elige sola la mejor
 * disponible:
 *
 * 1. `pg_dump`, si está instalado. Es la herramienta oficial de PostgreSQL y
 *    guarda estructura + datos, así que el archivo se restaura solo, sobre una
 *    base vacía, sin necesitar nada más.
 * 2. Volcado propio por SQL, si no lo está. Guarda solo los datos. Para
 *    restaurarlo hay que crear antes la estructura con `prisma migrate deploy`.
 *
 * La segunda existe porque la imagen Docker de la aplicación no trae las
 * herramientas de PostgreSQL: sin ella, quien usa Docker se quedaría sin
 * respaldos automáticos. El instalador de Windows sí llevará PostgreSQL
 * incluido, y ahí entra el camino 1 sin cambiar una línea.
 */

import 'server-only';
import { execFile } from 'node:child_process';
import { constants as fsConstantes, promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { db } from './db';

const ejecutar = promisify(execFile);

/** Carpeta donde viven los respaldos. */
export function carpetaRespaldos(): string {
  return process.env.RESPALDOS_DIR || path.join(process.cwd(), 'respaldos');
}

/** Días que se conservan los respaldos antes de borrarse. */
function diasRetencion(): number {
  const valor = Number(process.env.RESPALDOS_DIAS);
  return Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 30;
}

/**
 * Nunca se baja de esta cantidad de archivos, pase lo que pase con la
 * retención. Si el negocio estuvo cerrado dos meses, borrar "todo lo viejo"
 * dejaría cero respaldos justo cuando son el único rastro que queda.
 */
const MINIMO_A_CONSERVAR = 10;

export type ModoRespaldo = 'completo' | 'solo-datos';
export type OrigenRespaldo = 'auto' | 'manual';

export type Respaldo = {
  archivo: string;
  ruta: string;
  bytes: number;
  fecha: Date;
  origen: OrigenRespaldo;
};

export type ResultadoRespaldo = Respaldo & { modo: ModoRespaldo };

const PATRON = /^motoerp-(\d{4}-\d{2}-\d{2})-(\d{4})-(auto|manual)\.sql$/;

function nombreArchivo(momento: Date, origen: OrigenRespaldo): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const fecha = `${momento.getFullYear()}-${p(momento.getMonth() + 1)}-${p(momento.getDate())}`;
  const hora = `${p(momento.getHours())}${p(momento.getMinutes())}`;
  return `motoerp-${fecha}-${hora}-${origen}.sql`;
}

/** Fecha local en formato AAAA-MM-DD, para comparar "es de hoy". */
function diaLocal(momento: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${momento.getFullYear()}-${p(momento.getMonth() + 1)}-${p(momento.getDate())}`;
}

// ---------------------------------------------------------------------------
// Camino 1: pg_dump
// ---------------------------------------------------------------------------

/**
 * `libpq` rechaza parámetros que no conoce y Prisma agrega `schema=public` a la
 * cadena de conexión. Hay que quitarlo antes de pasársela a `pg_dump`.
 */
function urlParaPgDump(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete('schema');
    u.searchParams.delete('connection_limit');
    u.searchParams.delete('pool_timeout');
    return u.toString();
  } catch {
    return url;
  }
}

async function rutaPgDump(): Promise<string | null> {
  const candidato = process.env.PG_DUMP_PATH?.trim();
  if (candidato) {
    try {
      await fs.access(candidato);
      return candidato;
    } catch {
      return null;
    }
  }

  try {
    await ejecutar('pg_dump', ['--version']);
    return 'pg_dump';
  } catch {
    return null;
  }
}

async function volcarConPgDump(binario: string, destino: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL.');

  await ejecutar(
    binario,
    [
      '--no-owner',
      '--no-privileges',
      // Permiten restaurar encima de una base que ya tiene datos.
      '--clean',
      '--if-exists',
      '--file',
      destino,
      urlParaPgDump(url),
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );
}

// ---------------------------------------------------------------------------
// Camino 2: volcado propio
// ---------------------------------------------------------------------------

/**
 * Genera los INSERT dejando que PostgreSQL arme cada literal con
 * `quote_nullable`. Escapar los valores desde JavaScript sería reinventar —
 * mal — algo que el motor ya hace bien para cualquier tipo: texto con comillas,
 * fechas, JSON, arreglos, binarios y nulos.
 */
async function volcarConSql(destino: string): Promise<void> {
  const tablas = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;

  const partes: string[] = [
    '-- Respaldo de MotoERP (solo datos).',
    '--',
    '-- Para restaurarlo, la base debe tener la estructura creada:',
    '--   1) npx prisma migrate deploy',
    '--   2) psql -U motoerp -d motoerp -f este-archivo.sql',
    `-- Generado: ${new Date().toISOString()}`,
    '',
    '-- Desactiva las llaves foráneas mientras carga, así el orden no importa.',
    'SET session_replication_role = replica;',
    'BEGIN;',
    '',
  ];

  if (tablas.length) {
    const lista = tablas.map((t) => `"${t.tablename}"`).join(', ');
    partes.push(`TRUNCATE TABLE ${lista} CASCADE;`, '');
  }

  for (const { tablename } of tablas) {
    const columnas = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tablename}
      ORDER BY ordinal_position
    `;
    if (!columnas.length) continue;

    const nombres = columnas.map((c) => `"${c.column_name}"`).join(', ');
    const literales = columnas
      .map((c) => `quote_nullable("${c.column_name}"::text)`)
      .join(` || ', ' || `);

    const filas = await db.$queryRawUnsafe<{ linea: string }[]>(
      `SELECT 'INSERT INTO "${tablename}" (${nombres}) VALUES (' || ${literales} || ');' AS linea
       FROM "${tablename}"`,
    );

    if (filas.length) {
      partes.push(`-- ${tablename} (${filas.length})`);
      for (const f of filas) partes.push(f.linea);
      partes.push('');
    }
  }

  // Sin esto, el siguiente registro que se cree chocaría con un id ya usado.
  const secuencias = await db.$queryRaw<{ sequencename: string }[]>`
    SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename
  `;

  if (secuencias.length) partes.push('-- Contadores de id');
  for (const { sequencename } of secuencias) {
    const [estado] = await db.$queryRawUnsafe<{ last_value: bigint | null; is_called: boolean }[]>(
      `SELECT last_value, is_called FROM "${sequencename}"`,
    );
    if (!estado?.last_value) continue;
    partes.push(
      `SELECT setval('public."${sequencename}"', ${estado.last_value}, ${estado.is_called});`,
    );
  }

  partes.push('', 'COMMIT;', 'SET session_replication_role = DEFAULT;', '');

  await fs.writeFile(destino, partes.join('\n'), 'utf8');
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Crea un respaldo y devuelve sus datos. Lanza si no pudo escribirlo. */
export async function crearRespaldo(origen: OrigenRespaldo = 'manual'): Promise<ResultadoRespaldo> {
  const carpeta = carpetaRespaldos();
  try {
    await fs.mkdir(carpeta, { recursive: true });
    await fs.access(carpeta, fsConstantes.W_OK);
  } catch {
    throw new Error(
      `No se puede escribir en la carpeta de respaldos (${carpeta}). ` +
        'Revisa los permisos de esa carpeta o indica otra en RESPALDOS_DIR.',
    );
  }

  const momento = new Date();
  const archivo = nombreArchivo(momento, origen);
  const ruta = path.join(carpeta, archivo);

  const binario = await rutaPgDump();
  let modo: ModoRespaldo;

  try {
    if (binario) {
      await volcarConPgDump(binario, ruta);
      modo = 'completo';
    } else {
      await volcarConSql(ruta);
      modo = 'solo-datos';
    }
  } catch (error) {
    // No dejar un archivo a medias: pareciría un respaldo válido.
    await fs.rm(ruta, { force: true });
    throw error;
  }

  const info = await fs.stat(ruta);
  if (info.size === 0) {
    await fs.rm(ruta, { force: true });
    throw new Error('El respaldo salió vacío.');
  }

  await eliminarAntiguos();

  return { archivo, ruta, bytes: info.size, fecha: momento, origen, modo };
}

/** Los respaldos existentes, del más reciente al más antiguo. */
export async function listarRespaldos(): Promise<Respaldo[]> {
  const carpeta = carpetaRespaldos();

  let nombres: string[];
  try {
    nombres = await fs.readdir(carpeta);
  } catch {
    return [];
  }

  const respaldos: Respaldo[] = [];
  for (const archivo of nombres) {
    const coincide = PATRON.exec(archivo);
    if (!coincide) continue;

    const ruta = path.join(carpeta, archivo);
    try {
      const info = await fs.stat(ruta);
      respaldos.push({
        archivo,
        ruta,
        bytes: info.size,
        fecha: info.mtime,
        origen: coincide[3] as OrigenRespaldo,
      });
    } catch {
      // Desapareció entre el listado y el stat; no es un problema.
    }
  }

  return respaldos.sort((a, b) => b.archivo.localeCompare(a.archivo));
}

/** Borra los respaldos vencidos, conservando siempre los últimos. */
export async function eliminarAntiguos(): Promise<number> {
  const respaldos = await listarRespaldos();
  if (respaldos.length <= MINIMO_A_CONSERVAR) return 0;

  const limite = Date.now() - diasRetencion() * 24 * 60 * 60 * 1000;
  const candidatos = respaldos.slice(MINIMO_A_CONSERVAR).filter((r) => r.fecha.getTime() < limite);

  let borrados = 0;
  for (const r of candidatos) {
    try {
      await fs.rm(r.ruta);
      borrados++;
    } catch {
      // Si no se pudo borrar, se reintenta en el próximo respaldo.
    }
  }

  return borrados;
}

/**
 * Ruta de un respaldo a partir de su nombre, o null si el nombre no es uno de
 * los nuestros. El patrón no admite barras ni puntos suspensivos, así que no
 * hay forma de salir de la carpeta; la comprobación de contención queda igual
 * por si el patrón se afloja algún día.
 */
export function rutaDeRespaldo(archivo: string): string | null {
  if (!PATRON.test(archivo)) return null;

  const carpeta = path.resolve(carpetaRespaldos());
  const ruta = path.resolve(carpeta, archivo);

  return ruta.startsWith(carpeta + path.sep) ? ruta : null;
}

/** ¿Ya se hizo el respaldo automático de hoy? */
export async function hayRespaldoDeHoy(): Promise<boolean> {
  const hoy = diaLocal(new Date());
  const respaldos = await listarRespaldos();
  return respaldos.some((r) => r.archivo.startsWith(`motoerp-${hoy}-`));
}

/** Qué camino usaría un respaldo hecho ahora. Para avisarlo en pantalla. */
export async function modoDisponible(): Promise<ModoRespaldo> {
  return (await rutaPgDump()) ? 'completo' : 'solo-datos';
}

import Link from 'next/link';
import { requerirRol, ROLES_ADMIN } from '@/lib/auth';
import { fechaHora } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { carpetaRespaldos, listarRespaldos, modoDisponible } from '@/lib/respaldos';
import { BotonRespaldar } from './panel';

export const dynamic = 'force-dynamic';

function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function PaginaRespaldos() {
  await requerirRol(...ROLES_ADMIN);

  const [respaldos, modo] = await Promise.all([listarRespaldos(), modoDisponible()]);
  const ultimo = respaldos[0];
  const dias = process.env.RESPALDOS_DIAS || '30';

  return (
    <div className="space-y-4">
      <div>
        <Link href="/configuracion" className="text-xs font-semibold text-marca-600 hover:underline">
          ← Configuración
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-800">Respaldos</h1>
        <p className="text-sm text-slate-500">
          Copias de seguridad de toda la información: ventas, stock, clientes y comprobantes.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="tarjeta p-5 lg:col-span-2">
          <h2 className="mb-1 text-base font-semibold text-slate-800">Cómo funciona</h2>
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              El sistema hace <strong>un respaldo por día de forma automática</strong>. No revisa el
              reloj: revisa si ya existe el respaldo de hoy, y si no lo hay lo genera. Así, si la
              computadora estuvo apagada, el respaldo se hace apenas la enciendes.
            </p>
            <p>
              Los archivos se guardan en{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                {carpetaRespaldos()}
              </code>
              . Se conservan {dias} días, y nunca se borran los últimos 10 aunque sean más viejos.
            </p>
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              <strong>Bájate una copia de vez en cuando.</strong> Un respaldo guardado en el mismo
              disco que la base no te salva del día en que ese disco falle. Descarga el más reciente
              a un USB o súbelo a la nube.
            </p>
          </div>
        </section>

        <section className="tarjeta p-5">
          <h2 className="mb-1 text-base font-semibold text-slate-800">Respaldar ahora</h2>
          <p className="mb-4 text-sm text-slate-500">
            Hazlo antes de cualquier cambio grande: cargar precios nuevos, un inventario o una
            actualización.
          </p>

          <BotonRespaldar />

          <dl className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Último respaldo</dt>
              <dd className="text-right font-medium text-slate-700">
                {ultimo ? fechaHora(ultimo.fecha) : 'Todavía ninguno'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Guardados</dt>
              <dd className="font-medium text-slate-700">{respaldos.length}</dd>
            </div>
          </dl>
        </section>
      </div>

      {modo === 'solo-datos' && (
        <section className="tarjeta border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <h2 className="mb-1 text-base font-semibold">Respaldos de solo datos</h2>
          <p>
            En este equipo no están instaladas las herramientas de PostgreSQL, así que el respaldo
            guarda <strong>los datos pero no la estructura</strong> de la base. Se restaura igual,
            solo que hay que crear la estructura primero — el procedimiento completo está más abajo.
          </p>
        </section>
      )}

      <section className="tarjeta overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-800">Archivos guardados</h2>
        </div>

        {respaldos.length === 0 ? (
          <SinDatos mensaje="Todavía no hay respaldos. El primero se hará solo, o puedes crearlo ahora." />
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Fecha</th>
                <th>Origen</th>
                <th className="text-right">Tamaño</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {respaldos.map((r) => (
                <tr key={r.archivo}>
                  <td className="font-mono text-xs">{r.archivo}</td>
                  <td className="text-xs text-slate-600">{fechaHora(r.fecha)}</td>
                  <td>
                    <Insignia color={r.origen === 'auto' ? 'azul' : 'gris'}>
                      {r.origen === 'auto' ? 'Automático' : 'Manual'}
                    </Insignia>
                  </td>
                  <td className="text-right font-mono text-xs">{tamano(r.bytes)}</td>
                  <td className="text-right">
                    <a
                      href={`/configuracion/respaldos/descargar?archivo=${encodeURIComponent(r.archivo)}`}
                      className="text-xs font-semibold text-marca-600 hover:underline"
                    >
                      Descargar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="tarjeta p-5">
        <h2 className="mb-1 text-base font-semibold text-slate-800">Cómo restaurar</h2>
        <p className="mb-3 text-sm text-slate-500">
          Restaurar <strong>reemplaza</strong> toda la información actual por la del respaldo. Todo
          lo registrado después de esa fecha se pierde, así que hazlo solo si de verdad hace falta.
        </p>

        <div className="space-y-3 text-sm text-slate-600">
          <div>
            <p className="font-semibold text-slate-700">Si usas Docker</p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-slate-800 px-3 py-2 font-mono text-xs text-slate-100">
              {modo === 'solo-datos'
                ? 'docker compose exec aplicacion node node_modules/prisma/build/index.js migrate deploy\ndocker compose exec -T base-de-datos psql -U motoerp -d motoerp < respaldos\\ARCHIVO.sql'
                : 'docker compose exec -T base-de-datos psql -U motoerp -d motoerp < respaldos\\ARCHIVO.sql'}
            </pre>
          </div>
          <p className="text-xs text-slate-500">
            Reemplaza <code className="font-mono">ARCHIVO.sql</code> por el nombre del respaldo, y
            corre el comando desde la carpeta <code className="font-mono">moto-erp</code>.
          </p>
        </div>
      </section>
    </div>
  );
}

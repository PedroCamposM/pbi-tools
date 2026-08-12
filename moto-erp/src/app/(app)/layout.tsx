import Link from 'next/link';
import { requerirUsuario } from '@/lib/auth';
import { db } from '@/lib/db';
import { cerrarSesion } from '@/actions/auth';
import { Navegacion } from '@/components/navegacion';
import { etiqueta } from '@/lib/format';

export default async function LayoutAplicacion({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuario();
  const empresa = await db.empresa.findFirst();

  const cajaAbierta = await db.cajaSesion.findFirst({
    where: { usuarioId: usuario.id, estado: 'ABIERTA' },
    select: { id: true },
  });

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Navegacion rol={usuario.rol} nombre={usuario.nombre} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-imprimir hidden items-center justify-between border-b border-slate-200 bg-white px-6 py-3 lg:flex">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {empresa?.nombreComercial ?? empresa?.razonSocial ?? 'MotoERP'}
            </p>
            <p className="text-xs text-slate-500">RUC {empresa?.ruc ?? '—'}</p>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/caja"
              className={
                cajaAbierta
                  ? 'insignia bg-emerald-100 text-emerald-800'
                  : 'insignia bg-amber-100 text-amber-800'
              }
            >
              {cajaAbierta ? 'Caja abierta' : 'Caja cerrada'}
            </Link>

            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">{usuario.nombre}</p>
              <p className="text-xs text-slate-500">{etiqueta(usuario.rol)}</p>
            </div>

            <form action={cerrarSesion}>
              <button type="submit" className="boton-secundario px-3 py-1.5 text-xs">
                Salir
              </button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

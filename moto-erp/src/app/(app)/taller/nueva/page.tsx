import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { RecepcionMoto } from './recepcion';

export const dynamic = 'force-dynamic';

export default async function PaginaNuevaOrden() {
  await requerirUsuario();

  const [clientes, tecnicos, almacenes, marcasMoto, modelosMoto, motos] = await Promise.all([
    db.cliente.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, take: 500 }),
    db.tecnico.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    db.almacen.findMany({ where: { activo: true }, orderBy: { predeterminado: 'desc' } }),
    db.marcaMoto.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    db.modeloMoto.findMany({ orderBy: { nombre: 'asc' } }),
    db.moto.findMany({
      include: { marcaMoto: true, modeloMoto: true },
      orderBy: { id: 'desc' },
      take: 500,
    }),
  ]);

  /**
   * De dónde salen los repuestos de la orden.
   *
   * Por defecto es el almacén principal: en una tienda de barrio el mecánico
   * toma la pieza del mismo anaquel que atiende el mostrador. El almacén
   * "Taller" queda como opción para los negocios que sí separan el stock, y
   * se abastece con una transferencia desde Inventario.
   */
  const almacenPorDefecto = almacenes.find((a) => a.predeterminado) ?? almacenes[0];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/taller" className="text-xs font-semibold text-marca-600 hover:underline">
          ← Taller
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-800">Recepción de moto</h1>
        <p className="text-sm text-slate-500">
          Registra el ingreso al taller. Los repuestos y la mano de obra se agregan luego en la
          orden.
        </p>
      </div>

      <div className="tarjeta p-5">
        <RecepcionMoto
          clientes={clientes.map((c) => ({
            id: c.id,
            nombre: `${c.nombre} — ${c.numeroDocumento}`,
          }))}
          tecnicos={tecnicos.map((t) => ({ id: t.id, nombre: t.nombre }))}
          almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
          almacenPredeterminado={almacenPorDefecto?.id ?? 0}
          marcasMoto={marcasMoto.map((m) => ({ id: m.id, nombre: m.nombre }))}
          modelosMoto={modelosMoto.map((m) => ({
            id: m.id,
            nombre: m.nombre,
            marcaMotoId: m.marcaMotoId,
          }))}
          motos={motos.map((m) => ({
            id: m.id,
            clienteId: m.clienteId,
            descripcion: `${m.placa ?? 'Sin placa'} — ${[m.marcaMoto?.nombre, m.modeloMoto?.nombre].filter(Boolean).join(' ')}`,
          }))}
        />
      </div>
    </div>
  );
}

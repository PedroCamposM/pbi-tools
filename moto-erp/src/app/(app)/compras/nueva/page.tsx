import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirRol, ROLES_ALMACEN } from '@/lib/auth';
import { num } from '@/lib/money';
import { FormularioCompra } from './formulario';

export const dynamic = 'force-dynamic';

export default async function PaginaNuevaCompra() {
  await requerirRol(...ROLES_ALMACEN);

  const [proveedores, almacenes, empresa] = await Promise.all([
    db.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: 'asc' } }),
    db.almacen.findMany({ where: { activo: true }, orderBy: { predeterminado: 'desc' } }),
    db.empresa.findFirst(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/compras" className="text-xs font-semibold text-marca-600 hover:underline">
          ← Compras
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-800">Registrar compra</h1>
        <p className="text-sm text-slate-500">
          Al guardar, la mercadería ingresa al kardex y se recalcula el costo promedio de cada
          producto.
        </p>
      </div>

      <FormularioCompra
        proveedores={proveedores.map((p) => ({
          id: p.id,
          nombre: `${p.razonSocial} — ${p.numeroDocumento}`,
          diasCredito: p.diasCredito,
        }))}
        almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
        igvPorcentaje={num(empresa?.igvPorcentaje ?? 18)}
      />
    </div>
  );
}

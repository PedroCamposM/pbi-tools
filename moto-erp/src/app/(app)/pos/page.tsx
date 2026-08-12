import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { num } from '@/lib/money';
import { PuntoDeVenta } from './punto-de-venta';

export const dynamic = 'force-dynamic';

export default async function PaginaPos() {
  const usuario = await requerirUsuario();

  const [almacenes, tecnicos, series, empresa, caja] = await Promise.all([
    db.almacen.findMany({ where: { activo: true }, orderBy: { predeterminado: 'desc' } }),
    db.tecnico.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    db.serieComprobante.findMany({
      where: { activa: true, tipoComprobante: { in: ['FACTURA', 'BOLETA', 'NOTA_VENTA'] } },
      orderBy: [{ tipoComprobante: 'asc' }, { predeterminada: 'desc' }],
    }),
    db.empresa.findFirst(),
    db.cajaSesion.findFirst({
      where: { usuarioId: usuario.id, estado: 'ABIERTA' },
      select: { id: true },
    }),
  ]);

  const almacenVenta = almacenes.find((a) => !a.esTaller) ?? almacenes[0];

  if (!almacenVenta) {
    return (
      <div className="tarjeta p-6">
        <p className="text-sm text-slate-600">
          No hay almacenes configurados. Crea uno en{' '}
          <Link href="/configuracion/almacenes" className="font-semibold text-marca-600">
            Configuración → Almacenes
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <PuntoDeVenta
      almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
      almacenPredeterminado={almacenVenta.id}
      tecnicos={tecnicos.map((t) => ({ id: t.id, nombre: t.nombre }))}
      series={series.map((s) => ({ tipo: s.tipoComprobante, serie: s.serie }))}
      igvPorcentaje={num(empresa?.igvPorcentaje ?? 18)}
      cajaAbierta={Boolean(caja)}
    />
  );
}

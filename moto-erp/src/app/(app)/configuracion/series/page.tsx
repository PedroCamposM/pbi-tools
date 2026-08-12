import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirRol, ROLES_ADMIN } from '@/lib/auth';
import { etiqueta } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { PanelLateral } from '@/components/ui/panel-lateral';
import { formatearCorrelativo } from '@/lib/sunat/catalogos';
import { FormularioSerie } from './formulario';

export const dynamic = 'force-dynamic';

export default async function PaginaSeries() {
  await requerirRol(...ROLES_ADMIN);

  const series = await db.serieComprobante.findMany({
    include: { almacen: true },
    orderBy: [{ tipoComprobante: 'asc' }, { serie: 'asc' }],
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/configuracion"
            className="text-xs font-semibold text-marca-600 hover:underline"
          >
            ← Configuración
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-800">Series y correlativos</h1>
        </div>
        <PanelLateral titulo="Nueva serie" etiquetaBoton="Nueva serie">
          <FormularioSerie />
        </PanelLateral>
      </div>

      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        El correlativo se incrementa solo con cada emisión. Solo edítalo manualmente si estás
        migrando desde otro sistema y necesitas continuar la numeración que ya declaraste a SUNAT:
        escribe el <strong>último número emitido</strong>, el sistema seguirá desde el siguiente.
      </p>

      <section className="tarjeta overflow-hidden">
        {series.length === 0 ? (
          <SinDatos mensaje="No hay series configuradas. Sin series no se puede facturar." />
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Comprobante</th>
                <th>Serie</th>
                <th className="text-right">Último emitido</th>
                <th>Siguiente</th>
                <th>Almacén</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.id}>
                  <td className="text-sm">{etiqueta(s.tipoComprobante)}</td>
                  <td className="font-mono text-sm font-semibold">{s.serie}</td>
                  <td className="text-right font-mono text-xs">
                    {formatearCorrelativo(s.correlativo)}
                  </td>
                  <td className="font-mono text-xs text-slate-500">
                    {s.serie}-{formatearCorrelativo(s.correlativo + 1)}
                  </td>
                  <td className="text-xs text-slate-600">{s.almacen?.nombre ?? '—'}</td>
                  <td className="space-x-1">
                    {s.predeterminada && <Insignia color="azul">predeterminada</Insignia>}
                    <Insignia color={s.activa ? 'verde' : 'gris'}>
                      {s.activa ? 'activa' : 'inactiva'}
                    </Insignia>
                  </td>
                  <td className="text-right">
                    <PanelLateral
                      titulo={`Editar serie ${s.serie}`}
                      etiquetaBoton="Editar"
                      varianteBoton="secundario"
                    >
                      <FormularioSerie
                        serie={{
                          id: s.id,
                          tipoComprobante: s.tipoComprobante,
                          serie: s.serie,
                          correlativo: s.correlativo,
                          predeterminada: s.predeterminada,
                          activa: s.activa,
                        }}
                      />
                    </PanelLateral>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

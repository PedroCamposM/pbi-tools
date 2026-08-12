import 'server-only';
import type { TipoComprobante } from '@prisma/client';
import type { Tx } from './inventario';

/**
 * Reserva el siguiente correlativo de una serie de forma atomica.
 * El incremento lo hace la base de datos, asi que dos cajas emitiendo a la vez
 * nunca reciben el mismo numero.
 */
export async function siguienteCorrelativo(
  tx: Tx,
  tipoComprobante: TipoComprobante,
  serie?: string | null,
): Promise<{ serie: string; correlativo: number }> {
  const registro = serie
    ? await tx.serieComprobante.findUnique({ where: { tipoComprobante_serie: { tipoComprobante, serie } } })
    : await tx.serieComprobante.findFirst({
        where: { tipoComprobante, activa: true },
        orderBy: [{ predeterminada: 'desc' }, { id: 'asc' }],
      });

  if (!registro || !registro.activa) {
    throw new Error(
      `No hay una serie activa configurada para ${tipoComprobante}. Registrala en Configuracion > Series.`,
    );
  }

  const actualizado = await tx.serieComprobante.update({
    where: { id: registro.id },
    data: { correlativo: { increment: 1 } },
    select: { serie: true, correlativo: true },
  });

  return { serie: actualizado.serie, correlativo: actualizado.correlativo };
}

/** Numero de orden de trabajo derivado del id: OT-000123 */
export function numeroOrdenTrabajo(id: number): string {
  return `OT-${String(id).padStart(6, '0')}`;
}

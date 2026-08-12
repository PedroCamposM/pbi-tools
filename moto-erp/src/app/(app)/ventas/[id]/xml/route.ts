import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sesionActual } from '@/lib/auth';

/** Descarga el XML UBL 2.1 del comprobante, para archivarlo o auditarlo. */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await sesionActual();
  if (!usuario) return new NextResponse('No autorizado', { status: 401 });

  const { id } = await params;

  const comprobante = await db.comprobanteElectronico.findUnique({
    where: { ventaId: Number(id) },
  });

  if (!comprobante) {
    return new NextResponse('Este documento no tiene comprobante electrónico.', { status: 404 });
  }

  return new NextResponse(comprobante.xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${comprobante.nombreArchivo}.xml"`,
    },
  });
}

import 'server-only';
import { db } from './db';
import { num } from './money';
import { fechaIso, horaIso } from './format';
import {
  CATEGORIA_TRIBUTARIA,
  CODIGO_AFECTACION,
  CODIGO_TIPO_COMPROBANTE,
  CODIGO_TIPO_DOCUMENTO,
  TRIBUTO,
  esElectronico,
  formatearCorrelativo,
  numeroComprobante,
} from './sunat/catalogos';
import { montoALetras } from './sunat/numero-letras';
import { emitirComprobante } from './sunat/proveedor';
import type { ComprobanteCpe } from './sunat/tipos';

/** Arma la estructura del comprobante electronico a partir de una venta. */
export async function construirComprobante(ventaId: number): Promise<ComprobanteCpe> {
  const venta = await db.venta.findUniqueOrThrow({
    where: { id: ventaId },
    include: {
      cliente: true,
      detalles: { include: { producto: true }, orderBy: { id: 'asc' } },
      documentoRef: true,
    },
  });

  const empresa = await db.empresa.findFirstOrThrow();

  return {
    tipoDocumento: CODIGO_TIPO_COMPROBANTE[venta.tipoComprobante],
    serie: venta.serie,
    correlativo: formatearCorrelativo(venta.correlativo),
    fechaEmision: fechaIso(venta.fecha),
    horaEmision: horaIso(venta.fecha),
    fechaVencimiento: venta.fechaVencimiento ? fechaIso(venta.fechaVencimiento) : null,
    moneda: venta.moneda,
    formaPago: venta.condicionPago === 'CREDITO' ? 'Credito' : 'Contado',
    montoPendiente: num(venta.total),
    igvPorcentaje: num(empresa.igvPorcentaje),

    emisor: {
      ruc: empresa.ruc,
      razonSocial: empresa.razonSocial,
      nombreComercial: empresa.nombreComercial,
      direccion: empresa.direccion,
      ubigeo: empresa.ubigeo,
      distrito: empresa.distrito,
      provincia: empresa.provincia,
      departamento: empresa.departamento,
    },

    receptor: {
      tipoDocumento: CODIGO_TIPO_DOCUMENTO[venta.cliente.tipoDocumento],
      numeroDocumento: venta.cliente.numeroDocumento,
      nombre: venta.cliente.nombre,
      direccion: venta.cliente.direccion,
    },

    items: venta.detalles.map((det, indice) => {
      const valorUnitario = num(det.precioUnitario, 4);
      const igvUnitario =
        det.afectacionIgv === 'GRAVADO'
          ? (valorUnitario * num(empresa.igvPorcentaje, 2)) / 100
          : 0;

      return {
        orden: indice + 1,
        codigo: det.producto.sku,
        descripcion: det.descripcion,
        unidadMedida: det.unidadMedida,
        cantidad: num(det.cantidad, 3),
        valorUnitario,
        precioUnitario: Math.round((valorUnitario + igvUnitario) * 10000) / 10000,
        descuento: num(det.descuento),
        valorVenta: num(det.valorVenta),
        igv: num(det.igv),
        codigoAfectacion: CODIGO_AFECTACION[det.afectacionIgv],
        categoriaTributaria: CATEGORIA_TRIBUTARIA[det.afectacionIgv],
        tributoId: TRIBUTO[det.afectacionIgv].id,
        tributoNombre: TRIBUTO[det.afectacionIgv].nombre,
        tributoCodigo: TRIBUTO[det.afectacionIgv].codigo,
        total: num(det.total),
      };
    }),

    totalOpGravadas: num(venta.opGravadas),
    totalOpExoneradas: num(venta.opExoneradas),
    totalOpInafectas: num(venta.opInafectas),
    totalIgv: num(venta.igv),
    totalDescuentos: num(venta.descuentoTotal),
    importeTotal: num(venta.total),
    leyenda: montoALetras(num(venta.total), venta.moneda),

    referencia: venta.documentoRef
      ? {
          tipoDocumento: CODIGO_TIPO_COMPROBANTE[venta.documentoRef.tipoComprobante],
          numeroDocumento: numeroComprobante(
            venta.documentoRef.serie,
            venta.documentoRef.correlativo,
          ),
          codigoMotivo: venta.motivoNotaCodigo ?? '01',
          descripcionMotivo: venta.motivoNota ?? 'Anulacion de la operacion',
        }
      : null,
  };
}

/**
 * Genera el XML, lo envia al proveedor configurado y guarda el resultado.
 * Es idempotente: si ya existe un comprobante para la venta, lo actualiza.
 */
export async function emitirYGuardar(ventaId: number): Promise<{
  estado: string;
  mensaje: string | null;
}> {
  const venta = await db.venta.findUniqueOrThrow({
    where: { id: ventaId },
    select: { tipoComprobante: true },
  });

  // Las notas de venta son documentos internos: no van a SUNAT.
  if (!esElectronico(venta.tipoComprobante)) {
    return { estado: 'NO_APLICA', mensaje: 'Documento interno, no se declara a SUNAT.' };
  }

  const comprobante = await construirComprobante(ventaId);
  const { xml, nombreArchivo, proveedor, respuesta } = await emitirComprobante(comprobante);

  const datos = {
    codigoTipoDoc: comprobante.tipoDocumento,
    nombreArchivo,
    xml,
    hashCpe: respuesta.hash ?? null,
    estado: respuesta.estado,
    proveedor,
    codigoRespuesta: respuesta.codigo ?? null,
    mensajeRespuesta: respuesta.mensaje ?? null,
    cdrXml: respuesta.cdrXml ?? null,
    enlacePdf: respuesta.enlacePdf ?? null,
    enviadoEn: new Date(),
  };

  const existente = await db.comprobanteElectronico.findUnique({ where: { ventaId } });

  if (existente) {
    await db.comprobanteElectronico.update({
      where: { ventaId },
      data: { ...datos, intentos: { increment: 1 } },
    });
  } else {
    await db.comprobanteElectronico.create({
      data: { ventaId, ...datos, intentos: 1 },
    });
  }

  return { estado: respuesta.estado, mensaje: respuesta.mensaje ?? null };
}

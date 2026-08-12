/**
 * Capa de integracion con el proveedor de facturacion electronica.
 *
 * El sistema NO habla directo con SUNAT: arma el comprobante completo (XML UBL
 * 2.1) y lo entrega a un proveedor que se encarga de firmarlo con el
 * certificado digital y enviarlo (OSE o PSE).
 *
 * Para pasar a produccion solo hay que:
 *   1. Contratar el proveedor y obtener sus credenciales.
 *   2. Poner PROVEEDOR_FE=<nombre> en el .env con sus variables.
 *   3. Implementar la clase correspondiente aqui (ya esta el esqueleto).
 *
 * Nada mas del sistema cambia: ventas, notas y anulaciones siguen llamando a
 * `obtenerProveedorFe()`.
 */

import { createHash } from 'node:crypto';
import { generarXmlCpe, nombreArchivoCpe } from './xml';
import type { ComprobanteCpe, RespuestaEnvio } from './tipos';

export interface ProveedorFacturacion {
  readonly nombre: string;
  /** Envia el comprobante y devuelve el resultado del fisco. */
  enviar(comprobante: ComprobanteCpe, xml: string): Promise<RespuestaEnvio>;
  /** Comunica la baja / anulacion de un comprobante ya aceptado. */
  anular(comprobante: ComprobanteCpe, motivo: string): Promise<RespuestaEnvio>;
}

/** Hash SHA-256 del XML, equivalente funcional al hash del CPE firmado. */
export function calcularHash(xml: string): string {
  return createHash('sha256').update(xml, 'utf8').digest('base64');
}

/**
 * Proveedor de desarrollo. Genera el XML real y simula la aceptacion de SUNAT.
 * Sirve para operar el negocio desde el dia uno mientras se tramita el
 * certificado digital, sin dejar deuda tecnica: el XML que produce es el mismo
 * que se enviara en produccion.
 */
class ProveedorMock implements ProveedorFacturacion {
  readonly nombre = 'mock';

  async enviar(comprobante: ComprobanteCpe, xml: string): Promise<RespuestaEnvio> {
    const numero = `${comprobante.serie}-${comprobante.correlativo}`;
    return {
      aceptado: true,
      estado: 'ACEPTADO',
      codigo: '0',
      mensaje: `La ${nombreLegible(comprobante.tipoDocumento)} ${numero}, ha sido aceptada (simulacion local).`,
      hash: calcularHash(xml),
      cdrXml: null,
      enlacePdf: null,
    };
  }

  async anular(comprobante: ComprobanteCpe, motivo: string): Promise<RespuestaEnvio> {
    return {
      aceptado: true,
      estado: 'ANULADO',
      codigo: '0',
      mensaje: `Baja registrada (simulacion local). Motivo: ${motivo}`,
    };
  }
}

/**
 * Integracion con Nubefact (uno de los PSE mas usados por MYPEs peruanas).
 * Se activa con PROVEEDOR_FE=nubefact + NUBEFACT_URL + NUBEFACT_TOKEN.
 *
 * Nubefact recibe un JSON propio (no el XML), por eso se mapea el comprobante
 * a su formato. El XML UBL se sigue guardando en la base como respaldo.
 */
class ProveedorNubefact implements ProveedorFacturacion {
  readonly nombre = 'nubefact';

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private async postear(cuerpo: unknown): Promise<RespuestaEnvio> {
    const respuesta = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Token token="${this.token}"`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
    });

    const datos = (await respuesta.json()) as Record<string, unknown>;

    if (!respuesta.ok || datos.errors) {
      return {
        aceptado: false,
        estado: 'RECHAZADO',
        codigo: String(datos.codigo ?? respuesta.status),
        mensaje: String(datos.errors ?? 'Error al comunicarse con el proveedor'),
      };
    }

    return {
      aceptado: datos.aceptada_por_sunat === true,
      estado: datos.aceptada_por_sunat === true ? 'ACEPTADO' : 'OBSERVADO',
      codigo: datos.sunat_responsecode ? String(datos.sunat_responsecode) : null,
      mensaje: datos.sunat_description ? String(datos.sunat_description) : null,
      hash: datos.cadena_para_codigo_qr ? String(datos.cadena_para_codigo_qr) : null,
      enlacePdf: datos.enlace_del_pdf ? String(datos.enlace_del_pdf) : null,
    };
  }

  async enviar(c: ComprobanteCpe): Promise<RespuestaEnvio> {
    return this.postear({
      operacion: 'generar_comprobante',
      tipo_de_comprobante: c.tipoDocumento === '01' ? 1 : c.tipoDocumento === '03' ? 2 : c.tipoDocumento === '07' ? 3 : 4,
      serie: c.serie,
      numero: Number(c.correlativo),
      sunat_transaction: 1,
      cliente_tipo_de_documento: c.receptor.tipoDocumento,
      cliente_numero_de_documento: c.receptor.numeroDocumento,
      cliente_denominacion: c.receptor.nombre,
      cliente_direccion: c.receptor.direccion ?? '',
      fecha_de_emision: c.fechaEmision,
      moneda: c.moneda === 'PEN' ? 1 : 2,
      porcentaje_de_igv: c.igvPorcentaje,
      total_gravada: c.totalOpGravadas,
      total_exonerada: c.totalOpExoneradas,
      total_inafecta: c.totalOpInafectas,
      total_igv: c.totalIgv,
      total: c.importeTotal,
      documento_que_se_modifica_tipo: c.referencia?.tipoDocumento ?? null,
      documento_que_se_modifica_numero: c.referencia?.numeroDocumento ?? null,
      tipo_de_nota_de_credito: c.tipoDocumento === '07' ? c.referencia?.codigoMotivo : null,
      tipo_de_nota_de_debito: c.tipoDocumento === '08' ? c.referencia?.codigoMotivo : null,
      enviar_automaticamente_a_la_sunat: true,
      enviar_automaticamente_al_cliente: false,
      items: c.items.map((i) => ({
        unidad_de_medida: i.unidadMedida,
        codigo: i.codigo,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        valor_unitario: i.valorUnitario,
        precio_unitario: i.precioUnitario,
        descuento: i.descuento,
        subtotal: i.valorVenta,
        tipo_de_igv: i.codigoAfectacion === '10' ? 1 : i.codigoAfectacion === '20' ? 8 : 9,
        igv: i.igv,
        total: i.total,
        anticipo_regularizacion: false,
      })),
    });
  }

  async anular(c: ComprobanteCpe, motivo: string): Promise<RespuestaEnvio> {
    return this.postear({
      operacion: 'generar_anulacion',
      tipo_de_comprobante: c.tipoDocumento === '01' ? 1 : 2,
      serie: c.serie,
      numero: Number(c.correlativo),
      motivo,
    });
  }
}

function nombreLegible(codigo: string): string {
  switch (codigo) {
    case '01':
      return 'FACTURA';
    case '03':
      return 'BOLETA DE VENTA';
    case '07':
      return 'NOTA DE CREDITO';
    case '08':
      return 'NOTA DE DEBITO';
    default:
      return 'COMPROBANTE';
  }
}

/** Devuelve el proveedor configurado en el entorno. */
export function obtenerProveedorFe(): ProveedorFacturacion {
  const configurado = (process.env.PROVEEDOR_FE ?? 'mock').toLowerCase();

  if (configurado === 'nubefact') {
    const url = process.env.NUBEFACT_URL;
    const token = process.env.NUBEFACT_TOKEN;
    if (!url || !token) {
      throw new Error('PROVEEDOR_FE=nubefact requiere NUBEFACT_URL y NUBEFACT_TOKEN en el .env');
    }
    return new ProveedorNubefact(url, token);
  }

  return new ProveedorMock();
}

/**
 * Genera el XML del comprobante y lo envia con el proveedor configurado.
 * Devuelve todo lo necesario para persistir en `comprobante_electronico`.
 */
export async function emitirComprobante(comprobante: ComprobanteCpe): Promise<{
  xml: string;
  nombreArchivo: string;
  proveedor: string;
  respuesta: RespuestaEnvio;
}> {
  const xml = generarXmlCpe(comprobante);
  const proveedor = obtenerProveedorFe();

  let respuesta: RespuestaEnvio;
  try {
    respuesta = await proveedor.enviar(comprobante, xml);
  } catch (error) {
    // Un fallo de red no debe tumbar la venta: el comprobante queda pendiente
    // y se puede reintentar desde la ficha de la venta.
    respuesta = {
      aceptado: false,
      estado: 'PENDIENTE',
      codigo: 'ERROR_CONEXION',
      mensaje: error instanceof Error ? error.message : 'No se pudo contactar al proveedor',
      hash: calcularHash(xml),
    };
  }

  return {
    xml,
    nombreArchivo: nombreArchivoCpe(comprobante),
    proveedor: proveedor.nombre,
    respuesta,
  };
}

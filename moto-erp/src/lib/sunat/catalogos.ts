/**
 * Catalogos oficiales de SUNAT usados por el sistema.
 * Referencia: Anexo V - Catalogos de la facturacion electronica.
 */

import type { AfectacionIgv, TipoComprobante, TipoDocumentoIdentidad } from '@prisma/client';

/** Catalogo 01 - Tipo de documento */
export const CODIGO_TIPO_COMPROBANTE: Record<TipoComprobante, string> = {
  FACTURA: '01',
  BOLETA: '03',
  NOTA_CREDITO: '07',
  NOTA_DEBITO: '08',
  // La nota de venta es un documento interno, no se declara a SUNAT.
  NOTA_VENTA: '00',
};

export const NOMBRE_TIPO_COMPROBANTE: Record<TipoComprobante, string> = {
  FACTURA: 'Factura electronica',
  BOLETA: 'Boleta de venta electronica',
  NOTA_CREDITO: 'Nota de credito electronica',
  NOTA_DEBITO: 'Nota de debito electronica',
  NOTA_VENTA: 'Nota de venta (interna)',
};

/** Catalogo 06 - Tipo de documento de identidad */
export const CODIGO_TIPO_DOCUMENTO: Record<TipoDocumentoIdentidad, string> = {
  SIN_DOCUMENTO: '0',
  DNI: '1',
  CARNET_EXTRANJERIA: '4',
  RUC: '6',
  PASAPORTE: '7',
};

export const NOMBRE_TIPO_DOCUMENTO: Record<TipoDocumentoIdentidad, string> = {
  SIN_DOCUMENTO: 'Sin documento',
  DNI: 'DNI',
  CARNET_EXTRANJERIA: 'Carnet de extranjeria',
  RUC: 'RUC',
  PASAPORTE: 'Pasaporte',
};

/** Catalogo 07 - Tipo de afectacion del IGV */
export const CODIGO_AFECTACION: Record<AfectacionIgv, string> = {
  GRAVADO: '10', // Gravado - Operacion onerosa
  EXONERADO: '20', // Exonerado - Operacion onerosa
  INAFECTO: '30', // Inafecto - Operacion onerosa
};

/** Codigo de categoria tributaria (UN/ECE 5305) segun la afectacion. */
export const CATEGORIA_TRIBUTARIA: Record<AfectacionIgv, string> = {
  GRAVADO: 'S',
  EXONERADO: 'E',
  INAFECTO: 'O',
};

/** Nombre / codigo del tributo segun la afectacion. */
export const TRIBUTO: Record<AfectacionIgv, { id: string; nombre: string; codigo: string }> = {
  GRAVADO: { id: '1000', nombre: 'IGV', codigo: 'VAT' },
  EXONERADO: { id: '9997', nombre: 'EXO', codigo: 'VAT' },
  INAFECTO: { id: '9998', nombre: 'INA', codigo: 'FRE' },
};

/** Catalogo 09 - Tipo de nota de credito */
export const MOTIVOS_NOTA_CREDITO: { codigo: string; descripcion: string }[] = [
  { codigo: '01', descripcion: 'Anulacion de la operacion' },
  { codigo: '02', descripcion: 'Anulacion por error en el RUC' },
  { codigo: '03', descripcion: 'Correccion por error en la descripcion' },
  { codigo: '04', descripcion: 'Descuento global' },
  { codigo: '05', descripcion: 'Descuento por item' },
  { codigo: '06', descripcion: 'Devolucion total' },
  { codigo: '07', descripcion: 'Devolucion por item' },
  { codigo: '08', descripcion: 'Bonificacion' },
  { codigo: '09', descripcion: 'Disminucion en el valor' },
  { codigo: '10', descripcion: 'Otros conceptos' },
];

/** Catalogo 10 - Tipo de nota de debito */
export const MOTIVOS_NOTA_DEBITO: { codigo: string; descripcion: string }[] = [
  { codigo: '01', descripcion: 'Intereses por mora' },
  { codigo: '02', descripcion: 'Aumento en el valor' },
  { codigo: '03', descripcion: 'Penalidades / otros conceptos' },
];

/** Catalogo 03 - Unidades de medida mas usadas en el rubro. */
export const UNIDADES_MEDIDA: { codigo: string; nombre: string }[] = [
  { codigo: 'NIU', nombre: 'Unidad' },
  { codigo: 'ZZ', nombre: 'Servicio' },
  { codigo: 'LTR', nombre: 'Litro' },
  { codigo: 'GLL', nombre: 'Galon' },
  { codigo: 'MLT', nombre: 'Mililitro' },
  { codigo: 'SET', nombre: 'Juego / kit' },
  { codigo: 'PR', nombre: 'Par' },
  { codigo: 'BX', nombre: 'Caja' },
  { codigo: 'MTR', nombre: 'Metro' },
  { codigo: 'KGM', nombre: 'Kilogramo' },
];

/** Catalogo 51 - Tipo de operacion (venta interna por defecto). */
export const TIPO_OPERACION_VENTA_INTERNA = '0101';

/** Catalogo 52 - Codigo de leyenda: monto en letras. */
export const LEYENDA_MONTO_LETRAS = '1000';

/** Codigo de moneda ISO 4217. */
export const MONEDA_PEN = 'PEN';

/** Comprobantes que se declaran electronicamente a SUNAT. */
export const COMPROBANTES_ELECTRONICOS: TipoComprobante[] = [
  'FACTURA',
  'BOLETA',
  'NOTA_CREDITO',
  'NOTA_DEBITO',
];

export function esElectronico(tipo: TipoComprobante): boolean {
  return COMPROBANTES_ELECTRONICOS.includes(tipo);
}

/** Formatea el correlativo con ceros a la izquierda (8 digitos, como pide SUNAT). */
export function formatearCorrelativo(correlativo: number): string {
  return String(correlativo).padStart(8, '0');
}

/** Numero completo del comprobante: F001-00000123 */
export function numeroComprobante(serie: string, correlativo: number): string {
  return `${serie}-${formatearCorrelativo(correlativo)}`;
}

/**
 * Estructura serializable con todo lo que necesita un comprobante electronico.
 * Se arma desde la base de datos y se entrega al generador de XML y al
 * proveedor de facturacion (OSE / PSE).
 */

export type EmisorCpe = {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string | null;
  direccion: string;
  ubigeo: string;
  distrito?: string | null;
  provincia?: string | null;
  departamento?: string | null;
};

export type ReceptorCpe = {
  /** Catalogo 06: 0, 1, 4, 6, 7 */
  tipoDocumento: string;
  numeroDocumento: string;
  nombre: string;
  direccion?: string | null;
};

export type ItemCpe = {
  orden: number;
  codigo: string;
  descripcion: string;
  /** Catalogo 03 */
  unidadMedida: string;
  cantidad: number;
  /** Valor unitario SIN IGV */
  valorUnitario: number;
  /** Precio unitario CON IGV */
  precioUnitario: number;
  descuento: number;
  /** Base imponible de la linea (cantidad * valorUnitario - descuento) */
  valorVenta: number;
  igv: number;
  /** Catalogo 07: 10, 20, 30 */
  codigoAfectacion: string;
  /** UN/ECE 5305: S, E, O */
  categoriaTributaria: string;
  tributoId: string;
  tributoNombre: string;
  tributoCodigo: string;
  /** Importe total de la linea (valorVenta + igv) */
  total: number;
};

export type ReferenciaCpe = {
  /** Catalogo 01 del documento que se modifica */
  tipoDocumento: string;
  /** Numero completo, ej: F001-00000123 */
  numeroDocumento: string;
  /** Catalogo 09 (NC) o 10 (ND) */
  codigoMotivo: string;
  descripcionMotivo: string;
};

export type ComprobanteCpe = {
  /** Catalogo 01: 01 factura, 03 boleta, 07 NC, 08 ND */
  tipoDocumento: string;
  serie: string;
  /** Correlativo formateado a 8 digitos */
  correlativo: string;
  /** yyyy-MM-dd */
  fechaEmision: string;
  /** HH:mm:ss */
  horaEmision: string;
  /** yyyy-MM-dd, solo si es al credito */
  fechaVencimiento?: string | null;
  moneda: string;
  formaPago: 'Contado' | 'Credito';
  montoPendiente?: number;
  igvPorcentaje: number;

  emisor: EmisorCpe;
  receptor: ReceptorCpe;
  items: ItemCpe[];

  totalOpGravadas: number;
  totalOpExoneradas: number;
  totalOpInafectas: number;
  totalIgv: number;
  totalDescuentos: number;
  importeTotal: number;
  leyenda: string;

  referencia?: ReferenciaCpe | null;
};

/** Resultado devuelto por un proveedor de facturacion electronica. */
export type RespuestaEnvio = {
  aceptado: boolean;
  estado: 'ACEPTADO' | 'RECHAZADO' | 'OBSERVADO' | 'ENVIADO' | 'PENDIENTE' | 'ANULADO';
  codigo?: string | null;
  mensaje?: string | null;
  hash?: string | null;
  cdrXml?: string | null;
  enlacePdf?: string | null;
};

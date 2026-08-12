/**
 * Tipos planos (serializables) que viajan del servidor a los componentes
 * cliente. Nunca exponen objetos Decimal ni entidades completas de Prisma.
 */

export type ProductoBusqueda = {
  id: number;
  sku: string;
  nombre: string;
  marca: string | null;
  categoria: string;
  unidadMedida: string;
  afectacionIgv: 'GRAVADO' | 'EXONERADO' | 'INAFECTO';
  esServicio: boolean;
  precioVenta: number;
  precioTecnico: number;
  precioMayorista: number;
  stock: number;
  ubicacion: string | null;
  aplicaciones: string[];
};

export type ClienteBusqueda = {
  id: number;
  tipoDocumento: string;
  numeroDocumento: string;
  nombre: string;
  direccion: string | null;
  tipoCliente: 'PUBLICO' | 'TECNICO' | 'MAYORISTA';
  lineaCredito: number;
  diasCredito: number;
  saldoPendiente: number;
};

/** Linea del carrito del punto de venta. */
export type LineaCarrito = {
  productoId: number;
  sku: string;
  nombre: string;
  unidadMedida: string;
  afectacionIgv: 'GRAVADO' | 'EXONERADO' | 'INAFECTO';
  esServicio: boolean;
  stockDisponible: number;
  cantidad: number;
  /** Precio unitario CON IGV, que es como se cotiza en mostrador. */
  precioUnitario: number;
  descuento: number;
};

export type OpcionSelect = {
  id: number;
  nombre: string;
};

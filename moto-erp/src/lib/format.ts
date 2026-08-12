import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function fecha(valor: Date | string | null | undefined): string {
  if (!valor) return '—';
  return format(new Date(valor), 'dd/MM/yyyy');
}

export function fechaHora(valor: Date | string | null | undefined): string {
  if (!valor) return '—';
  return format(new Date(valor), 'dd/MM/yyyy HH:mm');
}

export function fechaLarga(valor: Date | string | null | undefined): string {
  if (!valor) return '—';
  return format(new Date(valor), "d 'de' MMMM 'de' yyyy", { locale: es });
}

/** yyyy-MM-dd, el formato que piden los <input type="date"> y SUNAT. */
export function fechaIso(valor: Date | string | null | undefined): string {
  if (!valor) return '';
  return format(new Date(valor), 'yyyy-MM-dd');
}

export function horaIso(valor: Date | string | null | undefined): string {
  if (!valor) return '00:00:00';
  return format(new Date(valor), 'HH:mm:ss');
}

/** Inicio del dia (00:00:00) de la fecha indicada. */
export function inicioDia(valor: Date = new Date()): Date {
  const f = new Date(valor);
  f.setHours(0, 0, 0, 0);
  return f;
}

/** Fin del dia (23:59:59.999). */
export function finDia(valor: Date = new Date()): Date {
  const f = new Date(valor);
  f.setHours(23, 59, 59, 999);
  return f;
}

export function sumarDias(valor: Date, dias: number): Date {
  const f = new Date(valor);
  f.setDate(f.getDate() + dias);
  return f;
}

/** Convierte "2026-08-12" (input date) a Date local sin corrimiento de zona. */
export function desdeInputFecha(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const [a, m, dia] = valor.split('-').map(Number);
  if (!a || !m || !dia) return null;
  return new Date(a, m - 1, dia);
}

/** Etiquetas legibles para los enums del sistema. */
export const ETIQUETAS: Record<string, string> = {
  // Roles
  ADMINISTRADOR: 'Administrador',
  VENDEDOR: 'Vendedor',
  ALMACENERO: 'Almacenero',
  CAJERO: 'Cajero',
  // Comprobantes
  FACTURA: 'Factura',
  BOLETA: 'Boleta',
  NOTA_VENTA: 'Nota de venta',
  NOTA_CREDITO: 'Nota de crédito',
  NOTA_DEBITO: 'Nota de débito',
  // Clientes
  PUBLICO: 'Público',
  TECNICO: 'Técnico',
  MAYORISTA: 'Mayorista',
  // Documentos
  SIN_DOCUMENTO: 'Sin documento',
  DNI: 'DNI',
  CARNET_EXTRANJERIA: 'Carnet de extranjería',
  RUC: 'RUC',
  PASAPORTE: 'Pasaporte',
  // Pagos
  EFECTIVO: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TARJETA_DEBITO: 'Tarjeta débito',
  TARJETA_CREDITO: 'Tarjeta crédito',
  TRANSFERENCIA: 'Transferencia',
  CREDITO: 'Crédito',
  CONTADO: 'Contado',
  // Estados
  EMITIDA: 'Emitida',
  ANULADA: 'Anulada',
  NO_APLICA: 'No aplica',
  PENDIENTE: 'Pendiente',
  ENVIADO: 'Enviado',
  ACEPTADO: 'Aceptado',
  OBSERVADO: 'Observado',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
  PARCIAL: 'Parcial',
  PAGADA: 'Pagada',
  LIQUIDADA: 'Liquidada',
  BORRADOR: 'Borrador',
  RECIBIDA: 'Recibida',
  ABIERTA: 'Abierta',
  CERRADA: 'Cerrada',
  // Orden de trabajo
  RECEPCION: 'Recepción',
  DIAGNOSTICO: 'Diagnóstico',
  EN_PROCESO: 'En proceso',
  ESPERANDO_REPUESTOS: 'Esperando repuestos',
  TERMINADO: 'Terminado',
  ENTREGADO: 'Entregado',
  // Afectación
  GRAVADO: 'Gravado',
  EXONERADO: 'Exonerado',
  INAFECTO: 'Inafecto',
  // Movimientos
  INVENTARIO_INICIAL: 'Inventario inicial',
  ENTRADA_COMPRA: 'Compra',
  ENTRADA_AJUSTE: 'Ajuste (+)',
  ENTRADA_DEVOLUCION_CLIENTE: 'Devolución cliente',
  ENTRADA_TRANSFERENCIA: 'Transferencia (+)',
  SALIDA_VENTA: 'Venta',
  SALIDA_AJUSTE: 'Ajuste (−)',
  SALIDA_TALLER: 'Consumo taller',
  SALIDA_DEVOLUCION_PROVEEDOR: 'Devolución proveedor',
  SALIDA_TRANSFERENCIA: 'Transferencia (−)',
  // Comisiones
  VENTA: 'Venta',
  SERVICIO: 'Servicio',
  INGRESO: 'Ingreso',
  EGRESO: 'Egreso',
};

export function etiqueta(valor: string | null | undefined): string {
  if (!valor) return '—';
  return ETIQUETAS[valor] ?? valor;
}

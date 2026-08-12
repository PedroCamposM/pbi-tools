/** Constantes de UI compartidas entre servidor y cliente. */

export const METODOS_PAGO = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'YAPE', etiqueta: 'Yape' },
  { valor: 'PLIN', etiqueta: 'Plin' },
  { valor: 'TARJETA_DEBITO', etiqueta: 'Tarjeta débito' },
  { valor: 'TARJETA_CREDITO', etiqueta: 'Tarjeta crédito' },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
] as const;

export const CATEGORIAS_MOVIMIENTO_CAJA = [
  { valor: 'GASTO', etiqueta: 'Gasto operativo' },
  { valor: 'COMPRA', etiqueta: 'Pago a proveedor' },
  { valor: 'RETIRO', etiqueta: 'Retiro de efectivo' },
  { valor: 'DEPOSITO', etiqueta: 'Depósito / aporte' },
  { valor: 'LIQUIDACION_COMISION', etiqueta: 'Pago de comisiones' },
  { valor: 'COBRANZA', etiqueta: 'Cobranza' },
  { valor: 'DEVOLUCION', etiqueta: 'Devolución' },
  { valor: 'OTRO', etiqueta: 'Otro' },
] as const;

export const ESTADOS_ORDEN_TRABAJO = [
  { valor: 'RECEPCION', etiqueta: 'Recepción' },
  { valor: 'DIAGNOSTICO', etiqueta: 'Diagnóstico' },
  { valor: 'EN_PROCESO', etiqueta: 'En proceso' },
  { valor: 'ESPERANDO_REPUESTOS', etiqueta: 'Esperando repuestos' },
  { valor: 'TERMINADO', etiqueta: 'Terminado' },
  { valor: 'ENTREGADO', etiqueta: 'Entregado' },
] as const;

export const TIPOS_DOCUMENTO_IDENTIDAD = [
  { valor: 'DNI', etiqueta: 'DNI' },
  { valor: 'RUC', etiqueta: 'RUC' },
  { valor: 'CARNET_EXTRANJERIA', etiqueta: 'Carnet de extranjería' },
  { valor: 'PASAPORTE', etiqueta: 'Pasaporte' },
  { valor: 'SIN_DOCUMENTO', etiqueta: 'Sin documento' },
] as const;

export const TIPOS_CLIENTE = [
  { valor: 'PUBLICO', etiqueta: 'Público general' },
  { valor: 'TECNICO', etiqueta: 'Técnico / mecánico' },
  { valor: 'MAYORISTA', etiqueta: 'Mayorista' },
] as const;

/** Cliente generico para boletas rapidas de mostrador. */
export const DOC_CLIENTE_VARIOS = '00000000';

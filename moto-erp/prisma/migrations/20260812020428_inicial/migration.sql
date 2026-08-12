-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMINISTRADOR', 'VENDEDOR', 'ALMACENERO', 'CAJERO');

-- CreateEnum
CREATE TYPE "TipoDocumentoIdentidad" AS ENUM ('SIN_DOCUMENTO', 'DNI', 'CARNET_EXTRANJERIA', 'RUC', 'PASAPORTE');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('PUBLICO', 'TECNICO', 'MAYORISTA');

-- CreateEnum
CREATE TYPE "TipoComprobante" AS ENUM ('FACTURA', 'BOLETA', 'NOTA_VENTA', 'NOTA_CREDITO', 'NOTA_DEBITO');

-- CreateEnum
CREATE TYPE "AfectacionIgv" AS ENUM ('GRAVADO', 'EXONERADO', 'INAFECTO');

-- CreateEnum
CREATE TYPE "CondicionPago" AS ENUM ('CONTADO', 'CREDITO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'YAPE', 'PLIN', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'TRANSFERENCIA', 'CREDITO');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('EMITIDA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoSunat" AS ENUM ('NO_APLICA', 'PENDIENTE', 'ENVIADO', 'ACEPTADO', 'OBSERVADO', 'RECHAZADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('INVENTARIO_INICIAL', 'ENTRADA_COMPRA', 'ENTRADA_AJUSTE', 'ENTRADA_DEVOLUCION_CLIENTE', 'ENTRADA_TRANSFERENCIA', 'SALIDA_VENTA', 'SALIDA_AJUSTE', 'SALIDA_TALLER', 'SALIDA_DEVOLUCION_PROVEEDOR', 'SALIDA_TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "EstadoCompra" AS ENUM ('BORRADOR', 'RECIBIDA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoOrdenTrabajo" AS ENUM ('RECEPCION', 'DIAGNOSTICO', 'EN_PROCESO', 'ESPERANDO_REPUESTOS', 'TERMINADO', 'ENTREGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoCajaSesion" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoComision" AS ENUM ('PENDIENTE', 'LIQUIDADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "TipoComision" AS ENUM ('VENTA', 'SERVICIO');

-- CreateEnum
CREATE TYPE "TipoCodigoAlterno" AS ENUM ('OEM', 'PROVEEDOR', 'BARRAS', 'EQUIVALENTE');

-- CreateTable
CREATE TABLE "empresa" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ruc" VARCHAR(11) NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "direccion" TEXT NOT NULL,
    "ubigeo" VARCHAR(6) NOT NULL DEFAULT '150101',
    "distrito" TEXT,
    "provincia" TEXT,
    "departamento" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "igvPorcentaje" DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "regimen" TEXT NOT NULL DEFAULT 'MYPE_TRIBUTARIO',
    "logoUrl" TEXT,
    "piePagina" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'VENDEDOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serie_comprobante" (
    "id" SERIAL NOT NULL,
    "tipoComprobante" "TipoComprobante" NOT NULL,
    "serie" VARCHAR(4) NOT NULL,
    "correlativo" INTEGER NOT NULL DEFAULT 0,
    "almacenId" INTEGER,
    "predeterminada" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "serie_comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "detalle" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marca" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "marca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marca_moto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "marca_moto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelo_moto" (
    "id" SERIAL NOT NULL,
    "marcaMotoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "cilindrada" TEXT,

    CONSTRAINT "modelo_moto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto" (
    "id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoriaId" INTEGER NOT NULL,
    "marcaId" INTEGER,
    "unidadMedida" VARCHAR(4) NOT NULL DEFAULT 'NIU',
    "afectacionIgv" "AfectacionIgv" NOT NULL DEFAULT 'GRAVADO',
    "esServicio" BOOLEAN NOT NULL DEFAULT false,
    "costoPromedio" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "ultimoCosto" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "precioVenta" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "precioTecnico" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "precioMayorista" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "stockMaximo" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "ubicacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigo_alterno" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoCodigoAlterno" NOT NULL DEFAULT 'EQUIVALENTE',
    "nota" TEXT,

    CONSTRAINT "codigo_alterno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aplicacion_moto" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "marcaMotoId" INTEGER NOT NULL,
    "modeloMotoId" INTEGER,
    "anioDesde" INTEGER,
    "anioHasta" INTEGER,

    CONSTRAINT "aplicacion_moto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "almacen" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "esTaller" BOOLEAN NOT NULL DEFAULT false,
    "predeterminado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "almacen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "almacenId" INTEGER NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "costoPromedio" DECIMAL(14,4) NOT NULL DEFAULT 0,

    CONSTRAINT "stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_inventario" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productoId" INTEGER NOT NULL,
    "almacenId" INTEGER NOT NULL,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "costoUnitario" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "saldoCantidad" DECIMAL(12,3) NOT NULL,
    "saldoCosto" DECIMAL(14,4) NOT NULL,
    "referencia" TEXT,
    "ventaId" INTEGER,
    "compraId" INTEGER,
    "ordenTrabajoId" INTEGER,
    "usuarioId" INTEGER,
    "nota" TEXT,

    CONSTRAINT "movimiento_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" SERIAL NOT NULL,
    "tipoDocumento" "TipoDocumentoIdentidad" NOT NULL DEFAULT 'DNI',
    "numeroDocumento" VARCHAR(15) NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "tipoCliente" "TipoCliente" NOT NULL DEFAULT 'PUBLICO',
    "lineaCredito" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "diasCredito" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id" SERIAL NOT NULL,
    "tipoDocumento" "TipoDocumentoIdentidad" NOT NULL DEFAULT 'RUC',
    "numeroDocumento" VARCHAR(15) NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "contacto" TEXT,
    "diasCredito" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tecnico" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "documento" VARCHAR(15),
    "telefono" TEXT,
    "taller" TEXT,
    "direccion" TEXT,
    "comisionVentaPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "comisionServicioPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "clienteId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tecnico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moto" (
    "id" SERIAL NOT NULL,
    "placa" VARCHAR(10),
    "clienteId" INTEGER,
    "marcaMotoId" INTEGER,
    "modeloMotoId" INTEGER,
    "anio" INTEGER,
    "color" TEXT,
    "numeroMotor" TEXT,
    "numeroChasis" TEXT,
    "observacion" TEXT,

    CONSTRAINT "moto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compra" (
    "id" SERIAL NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "almacenId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipoComprobante" TEXT NOT NULL DEFAULT 'FACTURA',
    "serie" VARCHAR(10),
    "numero" VARCHAR(20),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "condicionPago" "CondicionPago" NOT NULL DEFAULT 'CONTADO',
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igv" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estado" "EstadoCompra" NOT NULL DEFAULT 'RECIBIDA',
    "observacion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compra_detalle" (
    "id" SERIAL NOT NULL,
    "compraId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "costoUnitario" DECIMAL(14,4) NOT NULL,
    "precioVenta" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "compra_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta" (
    "id" SERIAL NOT NULL,
    "tipoComprobante" "TipoComprobante" NOT NULL,
    "serie" VARCHAR(4) NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clienteId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "almacenId" INTEGER NOT NULL,
    "tecnicoId" INTEGER,
    "condicionPago" "CondicionPago" NOT NULL DEFAULT 'CONTADO',
    "fechaVencimiento" TIMESTAMP(3),
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "tipoCambio" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "opGravadas" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "opExoneradas" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "opInafectas" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "descuentoTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igv" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costoTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'EMITIDA',
    "observacion" TEXT,
    "documentoRefId" INTEGER,
    "motivoNotaCodigo" VARCHAR(2),
    "motivoNota" TEXT,
    "ordenTrabajoId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta_detalle" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidadMedida" VARCHAR(4) NOT NULL DEFAULT 'NIU',
    "cantidad" DECIMAL(12,3) NOT NULL,
    "precioUnitario" DECIMAL(14,4) NOT NULL,
    "descuento" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "afectacionIgv" "AfectacionIgv" NOT NULL DEFAULT 'GRAVADO',
    "valorVenta" DECIMAL(14,2) NOT NULL,
    "igv" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "costoUnitario" DECIMAL(14,4) NOT NULL DEFAULT 0,

    CONSTRAINT "venta_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago_venta" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "referencia" TEXT,
    "cajaSesionId" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobante_electronico" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "codigoTipoDoc" VARCHAR(2) NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "xml" TEXT NOT NULL,
    "hashCpe" TEXT,
    "estado" "EstadoSunat" NOT NULL DEFAULT 'PENDIENTE',
    "proveedor" TEXT NOT NULL DEFAULT 'mock',
    "codigoRespuesta" TEXT,
    "mensajeRespuesta" TEXT,
    "cdrXml" TEXT,
    "enlacePdf" TEXT,
    "enviadoEn" TIMESTAMP(3),
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobante_electronico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_trabajo" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "motoId" INTEGER,
    "tecnicoId" INTEGER,
    "almacenId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaPrometida" TIMESTAMP(3),
    "fechaEntrega" TIMESTAMP(3),
    "kilometraje" INTEGER,
    "estado" "EstadoOrdenTrabajo" NOT NULL DEFAULT 'RECEPCION',
    "motivoIngreso" TEXT NOT NULL,
    "diagnostico" TEXT,
    "trabajoRealizado" TEXT,
    "observacion" TEXT,
    "totalRepuestos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalServicios" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orden_trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_trabajo_repuesto" (
    "id" SERIAL NOT NULL,
    "ordenTrabajoId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "precioUnitario" DECIMAL(14,4) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "costoUnitario" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "descontado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "orden_trabajo_repuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_trabajo_servicio" (
    "id" SERIAL NOT NULL,
    "ordenTrabajoId" INTEGER NOT NULL,
    "productoId" INTEGER,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "precioUnitario" DECIMAL(14,4) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tecnicoId" INTEGER,

    CONSTRAINT "orden_trabajo_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caja_sesion" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoApertura" DECIMAL(14,2) NOT NULL,
    "fechaCierre" TIMESTAMP(3),
    "montoCierre" DECIMAL(14,2),
    "montoEsperado" DECIMAL(14,2),
    "diferencia" DECIMAL(14,2),
    "estado" "EstadoCajaSesion" NOT NULL DEFAULT 'ABIERTA',
    "observacion" TEXT,

    CONSTRAINT "caja_sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_caja" (
    "id" SERIAL NOT NULL,
    "cajaSesionId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "categoria" TEXT NOT NULL DEFAULT 'OTRO',
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "referencia" TEXT,

    CONSTRAINT "movimiento_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuenta_por_cobrar" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "montoOriginal" DECIMAL(14,2) NOT NULL,
    "saldo" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "cuenta_por_cobrar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobro_cuenta_por_cobrar" (
    "id" SERIAL NOT NULL,
    "cuentaId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(14,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "referencia" TEXT,
    "cajaSesionId" INTEGER,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "cobro_cuenta_por_cobrar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuenta_por_pagar" (
    "id" SERIAL NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "compraId" INTEGER NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "montoOriginal" DECIMAL(14,2) NOT NULL,
    "saldo" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "cuenta_por_pagar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago_cuenta_por_pagar" (
    "id" SERIAL NOT NULL,
    "cuentaId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(14,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "referencia" TEXT,
    "cajaSesionId" INTEGER,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "pago_cuenta_por_pagar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comision" (
    "id" SERIAL NOT NULL,
    "tecnicoId" INTEGER NOT NULL,
    "tipo" "TipoComision" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ventaId" INTEGER,
    "ordenTrabajoId" INTEGER,
    "concepto" TEXT NOT NULL,
    "baseCalculo" DECIMAL(14,2) NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoComision" NOT NULL DEFAULT 'PENDIENTE',
    "liquidacionId" INTEGER,

    CONSTRAINT "comision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion_comision" (
    "id" SERIAL NOT NULL,
    "tecnicoId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "observacion" TEXT,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "liquidacion_comision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "serie_comprobante_tipoComprobante_serie_key" ON "serie_comprobante"("tipoComprobante", "serie");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_nombre_key" ON "categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "marca_nombre_key" ON "marca"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "marca_moto_nombre_key" ON "marca_moto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "modelo_moto_marcaMotoId_nombre_key" ON "modelo_moto"("marcaMotoId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "producto_sku_key" ON "producto"("sku");

-- CreateIndex
CREATE INDEX "producto_nombre_idx" ON "producto"("nombre");

-- CreateIndex
CREATE INDEX "producto_categoriaId_idx" ON "producto"("categoriaId");

-- CreateIndex
CREATE INDEX "codigo_alterno_codigo_idx" ON "codigo_alterno"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "codigo_alterno_productoId_codigo_key" ON "codigo_alterno"("productoId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "almacen_nombre_key" ON "almacen"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "stock_productoId_almacenId_key" ON "stock"("productoId", "almacenId");

-- CreateIndex
CREATE INDEX "movimiento_inventario_productoId_almacenId_fecha_idx" ON "movimiento_inventario"("productoId", "almacenId", "fecha");

-- CreateIndex
CREATE INDEX "movimiento_inventario_fecha_idx" ON "movimiento_inventario"("fecha");

-- CreateIndex
CREATE INDEX "cliente_nombre_idx" ON "cliente"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_tipoDocumento_numeroDocumento_key" ON "cliente"("tipoDocumento", "numeroDocumento");

-- CreateIndex
CREATE UNIQUE INDEX "proveedor_tipoDocumento_numeroDocumento_key" ON "proveedor"("tipoDocumento", "numeroDocumento");

-- CreateIndex
CREATE UNIQUE INDEX "tecnico_clienteId_key" ON "tecnico"("clienteId");

-- CreateIndex
CREATE INDEX "moto_placa_idx" ON "moto"("placa");

-- CreateIndex
CREATE INDEX "compra_fecha_idx" ON "compra"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "venta_ordenTrabajoId_key" ON "venta"("ordenTrabajoId");

-- CreateIndex
CREATE INDEX "venta_fecha_idx" ON "venta"("fecha");

-- CreateIndex
CREATE INDEX "venta_clienteId_idx" ON "venta"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "venta_tipoComprobante_serie_correlativo_key" ON "venta"("tipoComprobante", "serie", "correlativo");

-- CreateIndex
CREATE UNIQUE INDEX "comprobante_electronico_ventaId_key" ON "comprobante_electronico"("ventaId");

-- CreateIndex
CREATE UNIQUE INDEX "orden_trabajo_numero_key" ON "orden_trabajo"("numero");

-- CreateIndex
CREATE INDEX "orden_trabajo_estado_idx" ON "orden_trabajo"("estado");

-- CreateIndex
CREATE INDEX "movimiento_caja_fecha_idx" ON "movimiento_caja"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "cuenta_por_cobrar_ventaId_key" ON "cuenta_por_cobrar"("ventaId");

-- CreateIndex
CREATE INDEX "cuenta_por_cobrar_estado_idx" ON "cuenta_por_cobrar"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "cuenta_por_pagar_compraId_key" ON "cuenta_por_pagar"("compraId");

-- CreateIndex
CREATE INDEX "cuenta_por_pagar_estado_idx" ON "cuenta_por_pagar"("estado");

-- CreateIndex
CREATE INDEX "comision_tecnicoId_estado_idx" ON "comision"("tecnicoId", "estado");

-- AddForeignKey
ALTER TABLE "serie_comprobante" ADD CONSTRAINT "serie_comprobante_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelo_moto" ADD CONSTRAINT "modelo_moto_marcaMotoId_fkey" FOREIGN KEY ("marcaMotoId") REFERENCES "marca_moto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "marca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigo_alterno" ADD CONSTRAINT "codigo_alterno_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacion_moto" ADD CONSTRAINT "aplicacion_moto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacion_moto" ADD CONSTRAINT "aplicacion_moto_marcaMotoId_fkey" FOREIGN KEY ("marcaMotoId") REFERENCES "marca_moto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacion_moto" ADD CONSTRAINT "aplicacion_moto_modeloMotoId_fkey" FOREIGN KEY ("modeloMotoId") REFERENCES "modelo_moto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "stock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "stock_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "orden_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tecnico" ADD CONSTRAINT "tecnico_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moto" ADD CONSTRAINT "moto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moto" ADD CONSTRAINT "moto_marcaMotoId_fkey" FOREIGN KEY ("marcaMotoId") REFERENCES "marca_moto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moto" ADD CONSTRAINT "moto_modeloMotoId_fkey" FOREIGN KEY ("modeloMotoId") REFERENCES "modelo_moto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_detalle" ADD CONSTRAINT "compra_detalle_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_detalle" ADD CONSTRAINT "compra_detalle_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "tecnico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "orden_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_documentoRefId_fkey" FOREIGN KEY ("documentoRefId") REFERENCES "venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_detalle" ADD CONSTRAINT "venta_detalle_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_detalle" ADD CONSTRAINT "venta_detalle_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_venta" ADD CONSTRAINT "pago_venta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_venta" ADD CONSTRAINT "pago_venta_cajaSesionId_fkey" FOREIGN KEY ("cajaSesionId") REFERENCES "caja_sesion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante_electronico" ADD CONSTRAINT "comprobante_electronico_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_motoId_fkey" FOREIGN KEY ("motoId") REFERENCES "moto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "tecnico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo_repuesto" ADD CONSTRAINT "orden_trabajo_repuesto_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "orden_trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo_repuesto" ADD CONSTRAINT "orden_trabajo_repuesto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo_servicio" ADD CONSTRAINT "orden_trabajo_servicio_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "orden_trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo_servicio" ADD CONSTRAINT "orden_trabajo_servicio_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo_servicio" ADD CONSTRAINT "orden_trabajo_servicio_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "tecnico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caja_sesion" ADD CONSTRAINT "caja_sesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_cajaSesionId_fkey" FOREIGN KEY ("cajaSesionId") REFERENCES "caja_sesion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_por_cobrar" ADD CONSTRAINT "cuenta_por_cobrar_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_por_cobrar" ADD CONSTRAINT "cuenta_por_cobrar_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobro_cuenta_por_cobrar" ADD CONSTRAINT "cobro_cuenta_por_cobrar_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuenta_por_cobrar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobro_cuenta_por_cobrar" ADD CONSTRAINT "cobro_cuenta_por_cobrar_cajaSesionId_fkey" FOREIGN KEY ("cajaSesionId") REFERENCES "caja_sesion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobro_cuenta_por_cobrar" ADD CONSTRAINT "cobro_cuenta_por_cobrar_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_por_pagar" ADD CONSTRAINT "cuenta_por_pagar_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_por_pagar" ADD CONSTRAINT "cuenta_por_pagar_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_cuenta_por_pagar" ADD CONSTRAINT "pago_cuenta_por_pagar_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuenta_por_pagar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_cuenta_por_pagar" ADD CONSTRAINT "pago_cuenta_por_pagar_cajaSesionId_fkey" FOREIGN KEY ("cajaSesionId") REFERENCES "caja_sesion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_cuenta_por_pagar" ADD CONSTRAINT "pago_cuenta_por_pagar_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision" ADD CONSTRAINT "comision_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "tecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision" ADD CONSTRAINT "comision_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision" ADD CONSTRAINT "comision_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "orden_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision" ADD CONSTRAINT "comision_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "liquidacion_comision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_comision" ADD CONSTRAINT "liquidacion_comision_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "tecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_comision" ADD CONSTRAINT "liquidacion_comision_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

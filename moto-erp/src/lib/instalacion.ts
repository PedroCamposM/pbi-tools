import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from './db';
import { CATEGORIAS_BASE, MARCAS_BASE, MOTOS_BASE, SERVICIOS_BASE } from './datos-base';

/**
 * Estado de instalación del sistema.
 *
 * Un sistema recién instalado tiene la base creada pero vacía. Hasta que
 * alguien complete el asistente no hay empresa (sin la cual no se puede emitir
 * un comprobante) ni usuario con quien iniciar sesión.
 */
export async function sistemaConfigurado(): Promise<boolean> {
  const [empresa, usuarios] = await Promise.all([
    db.empresa.findFirst({ select: { id: true } }),
    db.usuario.count(),
  ]);
  return Boolean(empresa) && usuarios > 0;
}

export type DatosInstalacion = {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string | null;
  direccion: string;
  ubigeo: string;
  distrito?: string | null;
  provincia?: string | null;
  departamento?: string | null;
  telefono?: string | null;
  email?: string | null;
  igvPorcentaje: number;
  regimen: string;

  serieFactura: string;
  serieBoleta: string;
  correlativoFactura: number;
  correlativoBoleta: number;

  adminNombre: string;
  adminEmail: string;
  adminPassword: string;

  /** Crea las líneas de producto, marcas y modelos de moto del rubro. */
  cargarCatalogoBase: boolean;
  /** Crea los servicios de taller más comunes como productos facturables. */
  cargarServicios: boolean;
};

/**
 * Deja el sistema listo para operar.
 *
 * Todo ocurre en una sola transacción: si algo falla, la base queda vacía y el
 * asistente se puede reintentar sin arrastrar registros a medias.
 */
export async function instalarSistema(datos: DatosInstalacion): Promise<void> {
  const bcrypt = (await import('bcryptjs')).default;
  const passwordHash = await bcrypt.hash(datos.adminPassword, 10);

  await db.$transaction(async (tx) => {
    // Nadie debe poder correr el asistente dos veces y duplicar la empresa.
    if (await tx.empresa.findFirst({ select: { id: true } })) {
      throw new Error('El sistema ya fue configurado.');
    }

    await tx.empresa.create({
      data: {
        id: 1,
        ruc: datos.ruc,
        razonSocial: datos.razonSocial,
        nombreComercial: datos.nombreComercial ?? null,
        direccion: datos.direccion,
        ubigeo: datos.ubigeo,
        distrito: datos.distrito ?? null,
        provincia: datos.provincia ?? null,
        departamento: datos.departamento ?? null,
        telefono: datos.telefono ?? null,
        email: datos.email ?? null,
        igvPorcentaje: new Prisma.Decimal(datos.igvPorcentaje),
        regimen: datos.regimen,
      },
    });

    await tx.usuario.create({
      data: {
        nombre: datos.adminNombre,
        email: datos.adminEmail.toLowerCase(),
        passwordHash,
        rol: 'ADMINISTRADOR',
      },
    });

    const tienda = await tx.almacen.create({
      data: { nombre: 'Tienda principal', predeterminado: true },
    });
    await tx.almacen.create({ data: { nombre: 'Taller', esTaller: true } });

    // Las notas de crédito y débito comparten la serie de la factura, como
    // exige SUNAT para los comprobantes que modifican a otro.
    const series: { tipoComprobante: 'FACTURA' | 'BOLETA' | 'NOTA_VENTA' | 'NOTA_CREDITO' | 'NOTA_DEBITO'; serie: string; correlativo: number }[] = [
      { tipoComprobante: 'FACTURA', serie: datos.serieFactura, correlativo: datos.correlativoFactura },
      { tipoComprobante: 'BOLETA', serie: datos.serieBoleta, correlativo: datos.correlativoBoleta },
      { tipoComprobante: 'NOTA_CREDITO', serie: datos.serieFactura, correlativo: 0 },
      { tipoComprobante: 'NOTA_DEBITO', serie: datos.serieFactura, correlativo: 0 },
      { tipoComprobante: 'NOTA_VENTA', serie: 'N001', correlativo: 0 },
    ];

    for (const s of series) {
      await tx.serieComprobante.create({
        data: { ...s, predeterminada: true, activa: true, almacenId: tienda.id },
      });
    }

    if (datos.cargarCatalogoBase || datos.cargarServicios) {
      const idCategoria = new Map<string, number>();

      for (const [nombre, detalle] of CATEGORIAS_BASE) {
        const c = await tx.categoria.create({ data: { nombre, detalle } });
        idCategoria.set(nombre, c.id);
      }

      if (datos.cargarCatalogoBase) {
        for (const nombre of MARCAS_BASE) {
          await tx.marca.create({ data: { nombre } });
        }

        for (const [marca, modelos] of Object.entries(MOTOS_BASE)) {
          const mm = await tx.marcaMoto.create({ data: { nombre: marca } });
          for (const [modelo, cilindrada] of modelos) {
            await tx.modeloMoto.create({
              data: { marcaMotoId: mm.id, nombre: modelo, cilindrada },
            });
          }
        }
      }

      if (datos.cargarServicios) {
        const categoriaServicios = idCategoria.get('Servicios de taller')!;
        for (const [sku, nombre, precio] of SERVICIOS_BASE) {
          await tx.producto.create({
            data: {
              sku,
              nombre,
              categoriaId: categoriaServicios,
              unidadMedida: 'ZZ',
              esServicio: true,
              precioVenta: new Prisma.Decimal(precio),
              precioTecnico: new Prisma.Decimal(precio),
              precioMayorista: new Prisma.Decimal(precio),
            },
          });
        }
      }
    }

    // Cliente genérico para las boletas rápidas de mostrador.
    await tx.cliente.create({
      data: {
        tipoDocumento: 'SIN_DOCUMENTO',
        numeroDocumento: '00000000',
        nombre: 'CLIENTE VARIOS',
        tipoCliente: 'PUBLICO',
      },
    });
  });
}

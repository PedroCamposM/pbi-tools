'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requerirUsuario, requerirRol, ROLES_ALMACEN } from '@/lib/auth';
import { desdeError, exito, falla, type Resultado } from '@/lib/resultado';
import { booleanoForm, idOpcional, numeroForm, textoOpcional } from '@/lib/validadores';
import { registrarMovimiento } from '@/lib/inventario';
import type { ProductoBusqueda } from '@/lib/tipos-ui';

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

const esquemaProducto = z.object({
  sku: z.string().trim().min(1, 'El código es obligatorio').max(40),
  nombre: z.string().trim().min(2, 'El nombre es obligatorio'),
  descripcion: textoOpcional,
  categoriaId: z.coerce.number().int().positive('Selecciona una categoría'),
  marcaId: idOpcional,
  unidadMedida: z.string().trim().default('NIU'),
  afectacionIgv: z.enum(['GRAVADO', 'EXONERADO', 'INAFECTO']).default('GRAVADO'),
  esServicio: booleanoForm.default(false),
  precioVenta: numeroForm(0),
  precioTecnico: numeroForm(0),
  precioMayorista: numeroForm(0),
  stockMinimo: numeroForm(0),
  stockMaximo: numeroForm(0),
  ubicacion: textoOpcional,
  activo: booleanoForm.default(true),
});

function leerProducto(formData: FormData) {
  return esquemaProducto.parse({
    sku: formData.get('sku'),
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion'),
    categoriaId: formData.get('categoriaId'),
    marcaId: formData.get('marcaId'),
    unidadMedida: formData.get('unidadMedida') || 'NIU',
    afectacionIgv: formData.get('afectacionIgv') || 'GRAVADO',
    esServicio: formData.get('esServicio'),
    precioVenta: formData.get('precioVenta'),
    precioTecnico: formData.get('precioTecnico'),
    precioMayorista: formData.get('precioMayorista'),
    stockMinimo: formData.get('stockMinimo'),
    stockMaximo: formData.get('stockMaximo'),
    ubicacion: formData.get('ubicacion'),
    activo: formData.get('activo'),
  });
}

export async function guardarProducto(
  _estado: Resultado<{ id: number }> | null,
  formData: FormData,
): Promise<Resultado<{ id: number }>> {
  try {
    await requerirRol(...ROLES_ALMACEN);
    const id = Number(formData.get('id') ?? 0);
    const datos = leerProducto(formData);

    if (datos.precioVenta < 0) return falla('El precio de venta no puede ser negativo.');

    const producto = id
      ? await db.producto.update({ where: { id }, data: datos })
      : await db.producto.create({ data: datos });

    // Stock inicial opcional al crear el producto
    const stockInicial = Number(formData.get('stockInicial') ?? 0);
    const costoInicial = Number(formData.get('costoInicial') ?? 0);
    const almacenId = Number(formData.get('almacenId') ?? 0);

    if (!id && stockInicial > 0 && almacenId > 0 && !datos.esServicio) {
      const usuario = await requerirUsuario();
      await db.$transaction(async (tx) => {
        await registrarMovimiento(tx, {
          productoId: producto.id,
          almacenId,
          tipo: 'INVENTARIO_INICIAL',
          cantidad: stockInicial,
          costoUnitario: costoInicial,
          referencia: 'Carga inicial',
          usuarioId: usuario.id,
        });
      });
    }

    revalidatePath('/productos');
    revalidatePath('/inventario');
    return exito({ id: producto.id }, id ? 'Producto actualizado.' : 'Producto creado.');
  } catch (error) {
    return desdeError(error);
  }
}

export async function cambiarEstadoProducto(id: number, activo: boolean): Promise<Resultado> {
  try {
    await requerirRol(...ROLES_ALMACEN);
    await db.producto.update({ where: { id }, data: { activo } });
    revalidatePath('/productos');
    return exito(undefined, activo ? 'Producto activado.' : 'Producto desactivado.');
  } catch (error) {
    return desdeError(error);
  }
}

// ---------------------------------------------------------------------------
// Codigos equivalentes (OEM, proveedor, barras)
// ---------------------------------------------------------------------------

export async function agregarCodigoAlterno(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    await requerirRol(...ROLES_ALMACEN);
    const datos = z
      .object({
        productoId: z.coerce.number().int().positive(),
        codigo: z.string().trim().min(1, 'Ingresa el código'),
        tipo: z.enum(['OEM', 'PROVEEDOR', 'BARRAS', 'EQUIVALENTE']).default('EQUIVALENTE'),
        nota: textoOpcional,
      })
      .parse({
        productoId: formData.get('productoId'),
        codigo: formData.get('codigo'),
        tipo: formData.get('tipo') || 'EQUIVALENTE',
        nota: formData.get('nota'),
      });

    await db.codigoAlterno.create({ data: datos });
    revalidatePath(`/productos/${datos.productoId}`);
    return exito(undefined, 'Código agregado.');
  } catch (error) {
    return desdeError(error);
  }
}

export async function eliminarCodigoAlterno(id: number, productoId: number): Promise<Resultado> {
  try {
    await requerirRol(...ROLES_ALMACEN);
    await db.codigoAlterno.delete({ where: { id } });
    revalidatePath(`/productos/${productoId}`);
    return exito();
  } catch (error) {
    return desdeError(error);
  }
}

// ---------------------------------------------------------------------------
// Compatibilidad con motos
// ---------------------------------------------------------------------------

export async function agregarAplicacion(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    await requerirRol(...ROLES_ALMACEN);
    const datos = z
      .object({
        productoId: z.coerce.number().int().positive(),
        marcaMotoId: z.coerce.number().int().positive('Selecciona la marca de la moto'),
        modeloMotoId: idOpcional,
        anioDesde: z.preprocess((v) => (v === '' ? null : Number(v)), z.number().int().nullable()),
        anioHasta: z.preprocess((v) => (v === '' ? null : Number(v)), z.number().int().nullable()),
      })
      .parse({
        productoId: formData.get('productoId'),
        marcaMotoId: formData.get('marcaMotoId'),
        modeloMotoId: formData.get('modeloMotoId'),
        anioDesde: formData.get('anioDesde'),
        anioHasta: formData.get('anioHasta'),
      });

    await db.aplicacionMoto.create({ data: datos });
    revalidatePath(`/productos/${datos.productoId}`);
    return exito(undefined, 'Compatibilidad agregada.');
  } catch (error) {
    return desdeError(error);
  }
}

export async function eliminarAplicacion(id: number, productoId: number): Promise<Resultado> {
  try {
    await requerirRol(...ROLES_ALMACEN);
    await db.aplicacionMoto.delete({ where: { id } });
    revalidatePath(`/productos/${productoId}`);
    return exito();
  } catch (error) {
    return desdeError(error);
  }
}

// ---------------------------------------------------------------------------
// Categorias, marcas y modelos
// ---------------------------------------------------------------------------

export async function guardarCategoria(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    await requerirRol(...ROLES_ALMACEN);
    const id = Number(formData.get('id') ?? 0);
    const datos = z
      .object({ nombre: z.string().trim().min(2, 'Nombre muy corto'), detalle: textoOpcional })
      .parse({ nombre: formData.get('nombre'), detalle: formData.get('detalle') });

    if (id) await db.categoria.update({ where: { id }, data: datos });
    else await db.categoria.create({ data: datos });

    revalidatePath('/productos/catalogos');
    return exito(undefined, 'Categoría guardada.');
  } catch (error) {
    return desdeError(error);
  }
}

export async function guardarMarca(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    await requerirRol(...ROLES_ALMACEN);
    const id = Number(formData.get('id') ?? 0);
    const nombre = z.string().trim().min(1, 'Nombre obligatorio').parse(formData.get('nombre'));

    if (id) await db.marca.update({ where: { id }, data: { nombre } });
    else await db.marca.create({ data: { nombre } });

    revalidatePath('/productos/catalogos');
    return exito(undefined, 'Marca guardada.');
  } catch (error) {
    return desdeError(error);
  }
}

export async function guardarMarcaMoto(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    await requerirRol(...ROLES_ALMACEN);
    const nombre = z.string().trim().min(1, 'Nombre obligatorio').parse(formData.get('nombre'));
    await db.marcaMoto.create({ data: { nombre } });
    revalidatePath('/productos/catalogos');
    return exito(undefined, 'Marca de moto guardada.');
  } catch (error) {
    return desdeError(error);
  }
}

export async function guardarModeloMoto(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    await requerirRol(...ROLES_ALMACEN);
    const datos = z
      .object({
        marcaMotoId: z.coerce.number().int().positive('Selecciona la marca'),
        nombre: z.string().trim().min(1, 'Nombre obligatorio'),
        cilindrada: textoOpcional,
      })
      .parse({
        marcaMotoId: formData.get('marcaMotoId'),
        nombre: formData.get('nombre'),
        cilindrada: formData.get('cilindrada'),
      });

    await db.modeloMoto.create({ data: datos });
    revalidatePath('/productos/catalogos');
    return exito(undefined, 'Modelo guardado.');
  } catch (error) {
    return desdeError(error);
  }
}

// ---------------------------------------------------------------------------
// Busqueda de productos para el POS y el taller
// ---------------------------------------------------------------------------

/**
 * Busca por codigo, nombre, codigo equivalente (OEM / proveedor / barras) o
 * por modelo de moto compatible. Es la busqueda que usa el mostrador.
 */
export async function buscarProductos(
  termino: string,
  almacenId: number,
  limite = 25,
): Promise<ProductoBusqueda[]> {
  await requerirUsuario();

  const texto = termino.trim();
  if (texto.length < 2) return [];

  const productos = await db.producto.findMany({
    where: {
      activo: true,
      OR: [
        { sku: { contains: texto, mode: 'insensitive' } },
        { nombre: { contains: texto, mode: 'insensitive' } },
        { descripcion: { contains: texto, mode: 'insensitive' } },
        { codigosAlterno: { some: { codigo: { contains: texto, mode: 'insensitive' } } } },
        { marca: { nombre: { contains: texto, mode: 'insensitive' } } },
        {
          aplicaciones: {
            some: {
              OR: [
                { marcaMoto: { nombre: { contains: texto, mode: 'insensitive' } } },
                { modeloMoto: { nombre: { contains: texto, mode: 'insensitive' } } },
              ],
            },
          },
        },
      ],
    },
    include: {
      marca: true,
      categoria: true,
      stocks: { where: { almacenId } },
      aplicaciones: { include: { marcaMoto: true, modeloMoto: true }, take: 6 },
    },
    orderBy: { nombre: 'asc' },
    take: limite,
  });

  return productos.map((p) => ({
    id: p.id,
    sku: p.sku,
    nombre: p.nombre,
    marca: p.marca?.nombre ?? null,
    categoria: p.categoria.nombre,
    unidadMedida: p.unidadMedida,
    afectacionIgv: p.afectacionIgv,
    esServicio: p.esServicio,
    precioVenta: Number(p.precioVenta),
    precioTecnico: Number(p.precioTecnico),
    precioMayorista: Number(p.precioMayorista),
    stock: Number(p.stocks[0]?.cantidad ?? 0),
    ubicacion: p.ubicacion,
    aplicaciones: p.aplicaciones.map((a) =>
      [a.marcaMoto.nombre, a.modeloMoto?.nombre].filter(Boolean).join(' '),
    ),
  }));
}

// ---------------------------------------------------------------------------
// Ajustes de inventario y transferencias
// ---------------------------------------------------------------------------

export async function ajustarStock(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    const usuario = await requerirRol(...ROLES_ALMACEN);
    const datos = z
      .object({
        productoId: z.coerce.number().int().positive('Selecciona el producto'),
        almacenId: z.coerce.number().int().positive('Selecciona el almacén'),
        sentido: z.enum(['ENTRADA', 'SALIDA']),
        cantidad: numeroForm(0),
        costoUnitario: numeroForm(0),
        motivo: z.string().trim().min(3, 'Explica el motivo del ajuste'),
      })
      .parse({
        productoId: formData.get('productoId'),
        almacenId: formData.get('almacenId'),
        sentido: formData.get('sentido'),
        cantidad: formData.get('cantidad'),
        costoUnitario: formData.get('costoUnitario'),
        motivo: formData.get('motivo'),
      });

    if (datos.cantidad <= 0) return falla('La cantidad debe ser mayor a cero.');

    await db.$transaction(async (tx) => {
      await registrarMovimiento(tx, {
        productoId: datos.productoId,
        almacenId: datos.almacenId,
        tipo: datos.sentido === 'ENTRADA' ? 'ENTRADA_AJUSTE' : 'SALIDA_AJUSTE',
        cantidad: datos.cantidad,
        costoUnitario: datos.sentido === 'ENTRADA' ? datos.costoUnitario : null,
        referencia: 'Ajuste de inventario',
        usuarioId: usuario.id,
        nota: datos.motivo,
      });
    });

    revalidatePath('/inventario');
    return exito(undefined, 'Ajuste registrado.');
  } catch (error) {
    return desdeError(error);
  }
}

export async function transferirStock(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    const usuario = await requerirRol(...ROLES_ALMACEN);
    const datos = z
      .object({
        productoId: z.coerce.number().int().positive('Selecciona el producto'),
        origenId: z.coerce.number().int().positive('Selecciona el almacén de origen'),
        destinoId: z.coerce.number().int().positive('Selecciona el almacén de destino'),
        cantidad: numeroForm(0),
        nota: textoOpcional,
      })
      .parse({
        productoId: formData.get('productoId'),
        origenId: formData.get('origenId'),
        destinoId: formData.get('destinoId'),
        cantidad: formData.get('cantidad'),
        nota: formData.get('nota'),
      });

    if (datos.origenId === datos.destinoId) {
      return falla('El almacén de origen y destino deben ser distintos.');
    }
    if (datos.cantidad <= 0) return falla('La cantidad debe ser mayor a cero.');

    await db.$transaction(async (tx) => {
      const salida = await registrarMovimiento(tx, {
        productoId: datos.productoId,
        almacenId: datos.origenId,
        tipo: 'SALIDA_TRANSFERENCIA',
        cantidad: datos.cantidad,
        referencia: 'Transferencia entre almacenes',
        usuarioId: usuario.id,
        nota: datos.nota,
      });

      await registrarMovimiento(tx, {
        productoId: datos.productoId,
        almacenId: datos.destinoId,
        tipo: 'ENTRADA_TRANSFERENCIA',
        cantidad: datos.cantidad,
        costoUnitario: salida.costoUnitario,
        referencia: 'Transferencia entre almacenes',
        usuarioId: usuario.id,
        nota: datos.nota,
      });
    });

    revalidatePath('/inventario');
    return exito(undefined, 'Transferencia realizada.');
  } catch (error) {
    return desdeError(error);
  }
}

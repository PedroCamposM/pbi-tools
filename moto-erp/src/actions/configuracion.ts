'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requerirRol, ROLES_ADMIN } from '@/lib/auth';
import { desdeError, exito, falla, type Resultado } from '@/lib/resultado';
import { booleanoForm, enteroForm, numeroForm, textoOpcional, rucValido } from '@/lib/validadores';

export async function guardarEmpresa(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    await requerirRol(...ROLES_ADMIN);

    const datos = z
      .object({
        ruc: z.string().trim().length(11, 'El RUC debe tener 11 dígitos'),
        razonSocial: z.string().trim().min(3, 'Ingresa la razón social'),
        nombreComercial: textoOpcional,
        direccion: z.string().trim().min(5, 'Ingresa la dirección fiscal'),
        ubigeo: z.string().trim().length(6, 'El ubigeo tiene 6 dígitos'),
        distrito: textoOpcional,
        provincia: textoOpcional,
        departamento: textoOpcional,
        telefono: textoOpcional,
        email: textoOpcional,
        igvPorcentaje: numeroForm(18),
        regimen: z.string().trim().default('MYPE_TRIBUTARIO'),
        piePagina: textoOpcional,
      })
      .parse({
        ruc: formData.get('ruc'),
        razonSocial: formData.get('razonSocial'),
        nombreComercial: formData.get('nombreComercial'),
        direccion: formData.get('direccion'),
        ubigeo: formData.get('ubigeo'),
        distrito: formData.get('distrito'),
        provincia: formData.get('provincia'),
        departamento: formData.get('departamento'),
        telefono: formData.get('telefono'),
        email: formData.get('email'),
        igvPorcentaje: formData.get('igvPorcentaje'),
        regimen: formData.get('regimen') || 'MYPE_TRIBUTARIO',
        piePagina: formData.get('piePagina'),
      });

    if (!rucValido(datos.ruc)) {
      return falla('El RUC no pasa la validación del dígito verificador.', { ruc: 'RUC inválido' });
    }

    const existente = await db.empresa.findFirst();
    if (existente) {
      await db.empresa.update({ where: { id: existente.id }, data: datos });
    } else {
      await db.empresa.create({ data: { id: 1, ...datos } });
    }

    revalidatePath('/configuracion');
    return exito(undefined, 'Datos de la empresa guardados.');
  } catch (error) {
    return desdeError(error);
  }
}

export async function guardarSerie(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    await requerirRol(...ROLES_ADMIN);

    const id = Number(formData.get('id') ?? 0);
    const datos = z
      .object({
        tipoComprobante: z.enum(['FACTURA', 'BOLETA', 'NOTA_VENTA', 'NOTA_CREDITO', 'NOTA_DEBITO']),
        serie: z.string().trim().min(4, 'La serie tiene 4 caracteres').max(4),
        correlativo: enteroForm(0),
        predeterminada: booleanoForm.default(false),
        activa: booleanoForm.default(true),
      })
      .parse({
        tipoComprobante: formData.get('tipoComprobante'),
        serie: String(formData.get('serie') ?? '').toUpperCase(),
        correlativo: formData.get('correlativo'),
        predeterminada: formData.get('predeterminada'),
        activa: formData.get('activa'),
      });

    // Prefijo que espera SUNAT segun el tipo de documento.
    const prefijoEsperado: Record<string, string> = {
      FACTURA: 'F',
      BOLETA: 'B',
      NOTA_CREDITO: 'F',
      NOTA_DEBITO: 'F',
      NOTA_VENTA: 'N',
    };
    const prefijo = prefijoEsperado[datos.tipoComprobante];
    if (prefijo && !datos.serie.startsWith(prefijo)) {
      return falla(
        `La serie de ${datos.tipoComprobante.replace('_', ' ').toLowerCase()} debe empezar con "${prefijo}" (ej. ${prefijo}001).`,
        { serie: `Debe empezar con ${prefijo}` },
      );
    }

    if (datos.predeterminada) {
      await db.serieComprobante.updateMany({
        where: { tipoComprobante: datos.tipoComprobante },
        data: { predeterminada: false },
      });
    }

    if (id) {
      await db.serieComprobante.update({ where: { id }, data: datos });
    } else {
      await db.serieComprobante.create({ data: datos });
    }

    revalidatePath('/configuracion/series');
    return exito(undefined, 'Serie guardada.');
  } catch (error) {
    return desdeError(error);
  }
}

export async function guardarAlmacen(
  _estado: Resultado | null,
  formData: FormData,
): Promise<Resultado> {
  try {
    await requerirRol(...ROLES_ADMIN);

    const id = Number(formData.get('id') ?? 0);
    const datos = z
      .object({
        nombre: z.string().trim().min(2, 'Ingresa el nombre'),
        direccion: textoOpcional,
        esTaller: booleanoForm.default(false),
        predeterminado: booleanoForm.default(false),
        activo: booleanoForm.default(true),
      })
      .parse({
        nombre: formData.get('nombre'),
        direccion: formData.get('direccion'),
        esTaller: formData.get('esTaller'),
        predeterminado: formData.get('predeterminado'),
        activo: formData.get('activo'),
      });

    if (datos.predeterminado) {
      await db.almacen.updateMany({ data: { predeterminado: false } });
    }

    if (id) await db.almacen.update({ where: { id }, data: datos });
    else await db.almacen.create({ data: datos });

    revalidatePath('/configuracion/almacenes');
    return exito(undefined, 'Almacén guardado.');
  } catch (error) {
    return desdeError(error);
  }
}

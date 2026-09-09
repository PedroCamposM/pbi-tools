'use server';

import { revalidatePath } from 'next/cache';
import { requerirRol, ROLES_ADMIN } from '@/lib/auth';
import { crearRespaldo } from '@/lib/respaldos';
import { desdeError, exito, type Resultado } from '@/lib/resultado';

export async function respaldarAhora(_estado: Resultado | null): Promise<Resultado> {
  try {
    await requerirRol(...ROLES_ADMIN);

    const respaldo = await crearRespaldo('manual');
    revalidatePath('/configuracion/respaldos');

    const kb = Math.max(1, Math.round(respaldo.bytes / 1024));
    return exito(undefined, `Respaldo creado: ${respaldo.archivo} (${kb} KB).`);
  } catch (error) {
    return desdeError(error);
  }
}

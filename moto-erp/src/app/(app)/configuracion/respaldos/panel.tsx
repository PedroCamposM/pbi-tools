'use client';

import { useActionState } from 'react';
import { respaldarAhora } from '@/actions/respaldos';
import { Aviso, BotonEnvio } from '@/components/ui/basicos';
import type { Resultado } from '@/lib/resultado';

export function BotonRespaldar() {
  const [estado, accion] = useActionState<Resultado | null, FormData>(respaldarAhora, null);

  return (
    <form action={accion} className="space-y-3">
      <BotonEnvio>Respaldar ahora</BotonEnvio>
      <Aviso resultado={estado} />
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { iniciarSesion } from '@/actions/auth';
import { Aviso, BotonEnvio, Campo } from '@/components/ui/basicos';
import type { Resultado } from '@/lib/resultado';

export function FormularioLogin() {
  const [estado, accion] = useActionState<Resultado | null, FormData>(iniciarSesion, null);

  return (
    <form action={accion} className="space-y-4">
      <Campo etiqueta="Correo">
        <input
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="username"
          placeholder="usuario@empresa.pe"
          className="campo"
        />
      </Campo>

      <Campo etiqueta="Contraseña">
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="campo"
        />
      </Campo>

      <Aviso resultado={estado} />

      <BotonEnvio className="w-full">Ingresar</BotonEnvio>
    </form>
  );
}

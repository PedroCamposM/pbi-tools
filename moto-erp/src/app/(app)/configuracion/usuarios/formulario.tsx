'use client';

import { useActionState } from 'react';
import { guardarUsuario } from '@/actions/terceros';
import { Aviso, BotonEnvio, Campo } from '@/components/ui/basicos';
import type { Resultado } from '@/lib/resultado';

type UsuarioEditable = {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
};

export function FormularioUsuario({ usuario }: { usuario?: UsuarioEditable }) {
  const [estado, accion] = useActionState<Resultado | null, FormData>(guardarUsuario, null);

  return (
    <form action={accion} className="space-y-4">
      {usuario && <input type="hidden" name="id" value={usuario.id} />}

      <Campo etiqueta="Nombre">
        <input name="nombre" required defaultValue={usuario?.nombre} className="campo" />
      </Campo>

      <Campo etiqueta="Correo" ayuda="Con este correo inicia sesión">
        <input
          type="email"
          name="email"
          required
          defaultValue={usuario?.email}
          className="campo"
        />
      </Campo>

      <Campo
        etiqueta={usuario ? 'Nueva contraseña' : 'Contraseña'}
        ayuda={usuario ? 'Déjala en blanco para no cambiarla' : 'Mínimo 6 caracteres'}
      >
        <input
          type="password"
          name="password"
          required={!usuario}
          minLength={usuario ? 0 : 6}
          autoComplete="new-password"
          className="campo"
        />
      </Campo>

      <Campo etiqueta="Rol">
        <select name="rol" required defaultValue={usuario?.rol ?? 'VENDEDOR'} className="campo">
          <option value="ADMINISTRADOR">Administrador</option>
          <option value="VENDEDOR">Vendedor</option>
          <option value="ALMACENERO">Almacenero</option>
          <option value="CAJERO">Cajero</option>
        </select>
      </Campo>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={usuario?.activo ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        Usuario activo
      </label>

      <Aviso resultado={estado} />
      <BotonEnvio className="w-full">{usuario ? 'Guardar cambios' : 'Crear usuario'}</BotonEnvio>
    </form>
  );
}

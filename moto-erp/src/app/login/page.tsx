import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/auth';
import { sistemaConfigurado } from '@/lib/instalacion';
import { FormularioLogin } from './formulario';

export const dynamic = 'force-dynamic';

export default async function PaginaLogin() {
  // Instalación recién hecha: no hay con quién iniciar sesión todavía.
  if (!(await sistemaConfigurado())) redirect('/bienvenida');

  const usuario = await sesionActual();
  if (usuario) redirect('/');

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-800 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-3xl">🏍️</p>
          <h1 className="mt-2 text-2xl font-bold text-white">MotoERP</h1>
          <p className="mt-1 text-sm text-slate-400">
            Ventas, inventario, facturación y taller
          </p>
        </div>

        <div className="tarjeta p-6">
          <FormularioLogin />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Si olvidaste tu contraseña, pídele al administrador que la restablezca desde
          Configuración → Usuarios.
        </p>
      </div>
    </div>
  );
}

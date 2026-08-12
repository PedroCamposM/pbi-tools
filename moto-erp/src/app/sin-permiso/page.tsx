import Link from 'next/link';

export default function SinPermiso() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="tarjeta max-w-md p-8 text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="mt-3 text-lg font-bold text-slate-800">No tienes acceso a esta sección</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tu rol no incluye este permiso. Si necesitas entrar, pídele a un administrador que ajuste
          tu rol desde Configuración → Usuarios.
        </p>
        <Link href="/" className="boton-primario mt-6 inline-flex">
          Volver al tablero
        </Link>
      </div>
    </div>
  );
}

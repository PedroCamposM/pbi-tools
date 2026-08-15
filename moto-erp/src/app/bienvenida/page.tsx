import { redirect } from 'next/navigation';
import { sistemaConfigurado } from '@/lib/instalacion';
import { Asistente } from './asistente';

export const dynamic = 'force-dynamic';

export default async function PaginaBienvenida() {
  // Si alguien llega aquí con el sistema ya instalado, no debe poder rehacerlo.
  if (await sistemaConfigurado()) redirect('/login');

  return (
    <div className="min-h-screen bg-slate-800 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 text-center">
          <p className="text-4xl">🏍️</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Bienvenido a MotoERP</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">
            Vamos a configurar el sistema con los datos de tu negocio. Toma dos minutos y solo se
            hace una vez. Todo lo que pongas aquí se puede corregir después desde Configuración.
          </p>
        </header>

        <div className="tarjeta p-6">
          <Asistente />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Tus datos se guardan solo en esta computadora. No se envía nada a internet.
        </p>
      </div>
    </div>
  );
}

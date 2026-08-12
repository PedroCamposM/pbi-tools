'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  guardarCategoria,
  guardarMarca,
  guardarMarcaMoto,
  guardarModeloMoto,
} from '@/actions/catalogo';
import { Aviso, BotonEnvio, Campo } from '@/components/ui/basicos';
import type { Resultado } from '@/lib/resultado';
import type { OpcionSelect } from '@/lib/tipos-ui';

export function FormulariosCatalogo({ marcasMoto }: { marcasMoto: OpcionSelect[] }) {
  const router = useRouter();

  const [estadoCategoria, accionCategoria] = useActionState<Resultado | null, FormData>(
    guardarCategoria,
    null,
  );
  const [estadoMarca, accionMarca] = useActionState<Resultado | null, FormData>(guardarMarca, null);
  const [estadoMarcaMoto, accionMarcaMoto] = useActionState<Resultado | null, FormData>(
    guardarMarcaMoto,
    null,
  );
  const [estadoModelo, accionModelo] = useActionState<Resultado | null, FormData>(
    guardarModeloMoto,
    null,
  );

  useEffect(() => {
    if (
      estadoCategoria?.ok ||
      estadoMarca?.ok ||
      estadoMarcaMoto?.ok ||
      estadoModelo?.ok
    ) {
      router.refresh();
    }
  }, [estadoCategoria, estadoMarca, estadoMarcaMoto, estadoModelo, router]);

  return (
    <section className="tarjeta space-y-5 p-4">
      <h2 className="text-sm font-semibold text-slate-700">Agregar al catálogo</h2>

      <form action={accionCategoria} className="space-y-2 rounded-md border border-slate-200 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Línea de producto
        </p>
        <input name="nombre" required placeholder="Ej. Sistema de escape" className="campo" />
        <input name="detalle" placeholder="Descripción corta (opcional)" className="campo" />
        <Aviso resultado={estadoCategoria} />
        <BotonEnvio variante="secundario" className="w-full">
          Agregar línea
        </BotonEnvio>
      </form>

      <form action={accionMarca} className="space-y-2 rounded-md border border-slate-200 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Marca de repuesto
        </p>
        <input name="nombre" required placeholder="Ej. Denso" className="campo" />
        <Aviso resultado={estadoMarca} />
        <BotonEnvio variante="secundario" className="w-full">
          Agregar marca
        </BotonEnvio>
      </form>

      <form action={accionMarcaMoto} className="space-y-2 rounded-md border border-slate-200 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Marca de moto</p>
        <input name="nombre" required placeholder="Ej. Suzuki" className="campo" />
        <Aviso resultado={estadoMarcaMoto} />
        <BotonEnvio variante="secundario" className="w-full">
          Agregar marca de moto
        </BotonEnvio>
      </form>

      <form action={accionModelo} className="space-y-2 rounded-md border border-slate-200 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Modelo de moto</p>
        <Campo etiqueta="Marca">
          <select name="marcaMotoId" required className="campo">
            <option value="">Seleccionar…</option>
            {marcasMoto.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <div className="flex gap-2">
          <input name="nombre" required placeholder="Modelo" className="campo flex-1" />
          <input name="cilindrada" placeholder="150cc" className="campo w-28" />
        </div>
        <Aviso resultado={estadoModelo} />
        <BotonEnvio variante="secundario" className="w-full">
          Agregar modelo
        </BotonEnvio>
      </form>
    </section>
  );
}

'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearOrdenTrabajo } from '@/actions/taller';
import { guardarMoto } from '@/actions/terceros';
import { Aviso, BotonEnvio, Campo, Grupo } from '@/components/ui/basicos';
import type { Resultado } from '@/lib/resultado';
import type { OpcionSelect } from '@/lib/tipos-ui';

type MotoRegistrada = { id: number; clienteId: number | null; descripcion: string };

export function RecepcionMoto({
  clientes,
  tecnicos,
  almacenes,
  almacenPredeterminado,
  marcasMoto,
  modelosMoto,
  motos,
}: {
  clientes: OpcionSelect[];
  tecnicos: OpcionSelect[];
  almacenes: OpcionSelect[];
  almacenPredeterminado: number;
  marcasMoto: OpcionSelect[];
  modelosMoto: { id: number; nombre: string; marcaMotoId: number }[];
  motos: MotoRegistrada[];
}) {
  const router = useRouter();

  const [estadoOrden, accionOrden] = useActionState<
    Resultado<{ id: number; numero: string }> | null,
    FormData
  >(crearOrdenTrabajo, null);
  const [estadoMoto, accionMoto] = useActionState<Resultado<{ id: number }> | null, FormData>(
    guardarMoto,
    null,
  );

  const [clienteId, setClienteId] = useState('');
  const [registrandoMoto, setRegistrandoMoto] = useState(false);
  const [marcaMotoId, setMarcaMotoId] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');

  // Al crear la orden, saltamos directo a su ficha para cargar repuestos.
  useEffect(() => {
    if (estadoOrden?.ok && estadoOrden.datos) {
      router.push(`/taller/${estadoOrden.datos.id}`);
    }
  }, [estadoOrden, router]);

  useEffect(() => {
    if (estadoMoto?.ok) {
      setRegistrandoMoto(false);
      router.refresh();
    }
  }, [estadoMoto, router]);

  const clientesVisibles = filtroCliente
    ? clientes.filter((c) => c.nombre.toLowerCase().includes(filtroCliente.toLowerCase()))
    : clientes;

  const motosDelCliente = clienteId
    ? motos.filter((m) => m.clienteId === Number(clienteId))
    : motos;

  const modelosFiltrados = marcaMotoId
    ? modelosMoto.filter((m) => m.marcaMotoId === Number(marcaMotoId))
    : [];

  return (
    <div className="space-y-5">
      <form action={accionOrden} className="space-y-4">
        <Grupo etiqueta="Cliente">
          <input
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            placeholder="Filtrar clientes…"
            className="campo mb-2"
          />
          <select
            name="clienteId"
            required
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="campo"
          >
            <option value="">Seleccionar cliente…</option>
            {clientesVisibles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Grupo>

        <Grupo etiqueta="Moto">
          <select name="motoId" className="campo">
            <option value="">Sin registrar / no aplica</option>
            {motosDelCliente.map((m) => (
              <option key={m.id} value={m.id}>
                {m.descripcion}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setRegistrandoMoto((v) => !v)}
            className="mt-1 text-xs font-semibold text-marca-600 hover:underline"
          >
            {registrandoMoto ? 'Cancelar registro de moto' : '+ Registrar una moto nueva'}
          </button>
        </Grupo>

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Técnico asignado">
            <select name="tecnicoId" className="campo">
              <option value="">Asignar después</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Repuestos salen de">
            <select name="almacenId" defaultValue={almacenPredeterminado} className="campo">
              {almacenes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Kilometraje">
            <input type="number" min={0} name="kilometraje" className="campo text-right" />
          </Campo>
        </div>

        <Campo etiqueta="Motivo del ingreso">
          <textarea
            name="motivoIngreso"
            required
            rows={3}
            placeholder="Ej. La moto patina al acelerar en tercera y cuarta. Cliente reporta ruido en el embrague."
            className="campo"
          />
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Fecha prometida de entrega">
            <input type="date" name="fechaPrometida" className="campo" />
          </Campo>
          <Campo etiqueta="Observaciones">
            <input
              name="observacion"
              placeholder="Ej. Entra con espejo roto y sin gasolina"
              className="campo"
            />
          </Campo>
        </div>

        <Aviso resultado={estadoOrden} />
        <BotonEnvio className="w-full">Crear orden de trabajo</BotonEnvio>
      </form>

      {registrandoMoto && (
        <form
          action={accionMoto}
          className="space-y-3 rounded-md border border-marca-200 bg-marca-50/50 p-4"
        >
          <h3 className="text-sm font-semibold text-slate-800">Registrar moto</h3>
          <input type="hidden" name="clienteId" value={clienteId} />

          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Placa">
              <input name="placa" placeholder="M1B-234" className="campo font-mono uppercase" />
            </Campo>
            <Campo etiqueta="Marca">
              <select
                name="marcaMotoId"
                value={marcaMotoId}
                onChange={(e) => setMarcaMotoId(e.target.value)}
                className="campo"
              >
                <option value="">Seleccionar…</option>
                {marcasMoto.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Modelo">
              <select name="modeloMotoId" className="campo">
                <option value="">Seleccionar…</option>
                {modelosFiltrados.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Campo etiqueta="Año">
              <input type="number" name="anio" className="campo" />
            </Campo>
            <Campo etiqueta="Color">
              <input name="color" className="campo" />
            </Campo>
            <Campo etiqueta="N° de motor">
              <input name="numeroMotor" className="campo font-mono" />
            </Campo>
            <Campo etiqueta="N° de chasis">
              <input name="numeroChasis" className="campo font-mono" />
            </Campo>
          </div>

          <Aviso resultado={estadoMoto} />
          <BotonEnvio variante="secundario" className="w-full">
            Guardar moto
          </BotonEnvio>
          {!clienteId && (
            <p className="text-xs text-amber-700">
              Selecciona primero el cliente para asociarle la moto.
            </p>
          )}
        </form>
      )}
    </div>
  );
}

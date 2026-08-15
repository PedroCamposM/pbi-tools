'use client';

import { useActionState, useState } from 'react';
import { configurarSistema } from '@/actions/instalacion';
import { Aviso, BotonEnvio, Campo } from '@/components/ui/basicos';
import type { Resultado } from '@/lib/resultado';

const PASOS = ['Tu negocio', 'Comprobantes', 'Tu usuario'] as const;

export function Asistente() {
  const [estado, accion] = useActionState<Resultado | null, FormData>(configurarSistema, null);
  const [paso, setPaso] = useState(0);

  return (
    <form action={accion} className="space-y-5">
      {/* Indicador de pasos */}
      <ol className="flex items-center gap-2 text-xs">
        {PASOS.map((nombre, i) => (
          <li key={nombre} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold ${
                i === paso
                  ? 'bg-marca-600 text-white'
                  : i < paso
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
              }`}
            >
              {i < paso ? '✓' : i + 1}
            </span>
            <span className={i === paso ? 'font-semibold text-slate-800' : 'text-slate-500'}>
              {nombre}
            </span>
            {i < PASOS.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
          </li>
        ))}
      </ol>

      {/* ------------------------------------------------ Paso 1: el negocio */}
      <section className={paso === 0 ? 'space-y-4' : 'hidden'}>
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Estos datos salen impresos en cada boleta y factura, y son los que se declaran a SUNAT.
          Cópialos tal como figuran en tu ficha RUC.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="RUC">
            <input
              name="ruc"
              required
              maxLength={11}
              inputMode="numeric"
              placeholder="20512345678"
              className="campo font-mono"
            />
          </Campo>
          <Campo etiqueta="Razón social" className="sm:col-span-2">
            <input
              name="razonSocial"
              required
              placeholder="DISTRIBUIDORA DE REPUESTOS S.A.C."
              className="campo"
            />
          </Campo>
        </div>

        <Campo etiqueta="Nombre comercial" ayuda="El nombre con el que te conocen tus clientes">
          <input name="nombreComercial" placeholder="Repuestos El Veloz" className="campo" />
        </Campo>

        <Campo etiqueta="Dirección fiscal">
          <input name="direccion" required placeholder="Av. Aviación 1234" className="campo" />
        </Campo>

        <div className="grid gap-3 sm:grid-cols-4">
          <Campo etiqueta="Ubigeo" ayuda="6 dígitos">
            <input
              name="ubigeo"
              required
              maxLength={6}
              defaultValue="150101"
              className="campo font-mono"
            />
          </Campo>
          <Campo etiqueta="Distrito">
            <input name="distrito" className="campo" />
          </Campo>
          <Campo etiqueta="Provincia">
            <input name="provincia" defaultValue="Lima" className="campo" />
          </Campo>
          <Campo etiqueta="Departamento">
            <input name="departamento" defaultValue="Lima" className="campo" />
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Campo etiqueta="Teléfono">
            <input name="telefono" className="campo" />
          </Campo>
          <Campo etiqueta="Correo">
            <input name="email" className="campo" />
          </Campo>
          <Campo etiqueta="IGV %">
            <input
              type="number"
              step="0.01"
              name="igvPorcentaje"
              defaultValue={18}
              className="campo text-right"
            />
          </Campo>
          <Campo etiqueta="Régimen">
            <select name="regimen" defaultValue="MYPE_TRIBUTARIO" className="campo">
              <option value="NRUS">Nuevo RUS</option>
              <option value="RER">Régimen Especial</option>
              <option value="MYPE_TRIBUTARIO">MYPE Tributario</option>
              <option value="GENERAL">Régimen General</option>
            </select>
          </Campo>
        </div>
      </section>

      {/* --------------------------------------------- Paso 2: comprobantes */}
      <section className={paso === 1 ? 'space-y-4' : 'hidden'}>
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>Importante si ya venías facturando con otro sistema:</strong> pon el número del{' '}
          <strong>último comprobante que emitiste</strong>. El sistema continuará desde el
          siguiente, sin repetir ni saltar numeración. Si recién empiezas, déjalo en 0.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Serie de factura" ayuda="Empieza con F">
            <input
              name="serieFactura"
              required
              maxLength={4}
              defaultValue="F001"
              className="campo font-mono uppercase"
            />
          </Campo>
          <Campo etiqueta="Último número de factura emitido">
            <input
              type="number"
              min={0}
              name="correlativoFactura"
              defaultValue={0}
              className="campo text-right"
            />
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Serie de boleta" ayuda="Empieza con B">
            <input
              name="serieBoleta"
              required
              maxLength={4}
              defaultValue="B001"
              className="campo font-mono uppercase"
            />
          </Campo>
          <Campo etiqueta="Último número de boleta emitido">
            <input
              type="number"
              min={0}
              name="correlativoBoleta"
              defaultValue={0}
              className="campo text-right"
            />
          </Campo>
        </div>

        <fieldset className="space-y-2 rounded-md border border-slate-200 p-3">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Datos para arrancar
          </legend>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="cargarCatalogoBase"
              defaultChecked
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span>
              Cargar las líneas de producto y las marcas del rubro
              <span className="block text-xs text-slate-500">
                Motor, transmisión, frenos, lubricantes… más marcas de repuestos y el listado de
                motos que circulan en Perú, para la búsqueda por compatibilidad. Sin productos ni
                stock: eso lo cargas tú.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="cargarServicios"
              defaultChecked
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span>
              Cargar los servicios de taller más comunes
              <span className="block text-xs text-slate-500">
                Mantenimiento, cambio de embrague, limpieza de carburador… con precios de ejemplo
                que puedes ajustar. Los necesitas para cobrar mano de obra en las órdenes de
                trabajo.
              </span>
            </span>
          </label>
        </fieldset>
      </section>

      {/* --------------------------------------------- Paso 3: tu usuario */}
      <section className={paso === 2 ? 'space-y-4' : 'hidden'}>
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Esta será tu cuenta de administrador: la única que puede cambiar la configuración y crear
          usuarios para tu personal. Apunta la contraseña en un lugar seguro — no hay forma de
          recuperarla desde aquí.
        </p>

        <Campo etiqueta="Tu nombre">
          <input name="adminNombre" required placeholder="Pedro Campos" className="campo" />
        </Campo>

        <Campo etiqueta="Tu correo" ayuda="Con este correo vas a iniciar sesión">
          <input
            type="email"
            name="adminEmail"
            required
            placeholder="pedro@midistribuidora.pe"
            className="campo"
          />
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Contraseña" ayuda="Mínimo 8 caracteres">
            <input
              type="password"
              name="adminPassword"
              required
              minLength={8}
              autoComplete="new-password"
              className="campo"
            />
          </Campo>
          <Campo etiqueta="Repite la contraseña">
            <input
              type="password"
              name="adminPassword2"
              required
              minLength={8}
              autoComplete="new-password"
              className="campo"
            />
          </Campo>
        </div>
      </section>

      <Aviso resultado={estado} />

      {/* ------------------------------------------------------ Navegación */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setPaso((p) => Math.max(0, p - 1))}
          disabled={paso === 0}
          className="boton-secundario disabled:invisible"
        >
          ← Atrás
        </button>

        {paso < PASOS.length - 1 ? (
          <button
            type="button"
            onClick={() => setPaso((p) => p + 1)}
            className="boton-primario"
          >
            Continuar →
          </button>
        ) : (
          <BotonEnvio>Terminar e ingresar al sistema</BotonEnvio>
        )}
      </div>

      <p className="text-center text-xs text-slate-400">
        Paso {paso + 1} de {PASOS.length}
      </p>
    </form>
  );
}

import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirUsuario } from '@/lib/auth';
import { soles, num } from '@/lib/money';
import { etiqueta } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { PanelLateral } from '@/components/ui/panel-lateral';
import { FormularioCliente } from './formulario';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string }>;
}) {
  await requerirUsuario();
  const filtros = await searchParams;

  const where: Prisma.ClienteWhereInput = {
    ...(filtros.tipo ? { tipoCliente: filtros.tipo as never } : {}),
    ...(filtros.q
      ? {
          OR: [
            { nombre: { contains: filtros.q, mode: 'insensitive' } },
            { numeroDocumento: { contains: filtros.q } },
            { telefono: { contains: filtros.q } },
          ],
        }
      : {}),
  };

  const clientes = await db.cliente.findMany({
    where,
    include: {
      cuentas: { where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } } },
      _count: { select: { ventas: true, motos: true } },
    },
    orderBy: { nombre: 'asc' },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Clientes</h1>
          <p className="text-sm text-slate-500">{clientes.length} registros</p>
        </div>
        <PanelLateral titulo="Nuevo cliente" etiquetaBoton="Nuevo cliente">
          <FormularioCliente />
        </PanelLateral>
      </div>

      <form className="tarjeta grid gap-3 p-4 sm:grid-cols-3">
        <label className="sm:col-span-2">
          <span className="etiqueta-campo">Buscar</span>
          <input
            name="q"
            defaultValue={filtros.q ?? ''}
            placeholder="Nombre, documento o teléfono"
            className="campo"
          />
        </label>
        <label>
          <span className="etiqueta-campo">Tipo</span>
          <select name="tipo" defaultValue={filtros.tipo ?? ''} className="campo">
            <option value="">Todos</option>
            <option value="PUBLICO">Público</option>
            <option value="TECNICO">Técnico</option>
            <option value="MAYORISTA">Mayorista</option>
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-3">
          <button type="submit" className="boton-primario">
            Filtrar
          </button>
          <Link href="/clientes" className="boton-secundario">
            Limpiar
          </Link>
        </div>
      </form>

      <section className="tarjeta overflow-hidden">
        {clientes.length === 0 ? (
          <SinDatos mensaje="No hay clientes con esos filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Contacto</th>
                  <th>Tipo</th>
                  <th className="text-right">Línea crédito</th>
                  <th className="text-right">Deuda</th>
                  <th className="text-right">Ventas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => {
                  const deuda = c.cuentas.reduce((acc, cu) => acc + num(cu.saldo), 0);
                  return (
                    <tr key={c.id} className={c.activo ? undefined : 'opacity-60'}>
                      <td className="max-w-[260px]">
                        <p className="truncate text-sm font-medium text-slate-800">{c.nombre}</p>
                        {c.direccion && (
                          <p className="truncate text-[11px] text-slate-500">{c.direccion}</p>
                        )}
                      </td>
                      <td className="text-xs">
                        <span className="text-slate-500">{etiqueta(c.tipoDocumento)}</span>{' '}
                        <span className="font-mono">{c.numeroDocumento}</span>
                      </td>
                      <td className="text-xs text-slate-600">{c.telefono ?? '—'}</td>
                      <td>
                        <Insignia
                          color={
                            c.tipoCliente === 'TECNICO'
                              ? 'violeta'
                              : c.tipoCliente === 'MAYORISTA'
                                ? 'azul'
                                : 'gris'
                          }
                        >
                          {etiqueta(c.tipoCliente)}
                        </Insignia>
                      </td>
                      <td className="text-right text-xs text-slate-600">
                        {num(c.lineaCredito) > 0 ? soles(c.lineaCredito) : '—'}
                      </td>
                      <td className="text-right">
                        {deuda > 0 ? (
                          <span className="font-semibold text-amber-700">{soles(deuda)}</span>
                        ) : (
                          <span className="text-xs text-slate-400">al día</span>
                        )}
                      </td>
                      <td className="text-right text-xs text-slate-600">{c._count.ventas}</td>
                      <td className="text-right">
                        <PanelLateral
                          titulo={`Editar ${c.nombre}`}
                          etiquetaBoton="Editar"
                          varianteBoton="secundario"
                        >
                          <FormularioCliente
                            cliente={{
                              id: c.id,
                              tipoDocumento: c.tipoDocumento,
                              numeroDocumento: c.numeroDocumento,
                              nombre: c.nombre,
                              direccion: c.direccion,
                              telefono: c.telefono,
                              email: c.email,
                              tipoCliente: c.tipoCliente,
                              lineaCredito: num(c.lineaCredito),
                              diasCredito: c.diasCredito,
                              activo: c.activo,
                            }}
                          />
                        </PanelLateral>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirRol, ROLES_ADMIN } from '@/lib/auth';
import { fecha as fmtFecha, etiqueta } from '@/lib/format';
import { Insignia, SinDatos } from '@/components/ui/basicos';
import { PanelLateral } from '@/components/ui/panel-lateral';
import { FormularioUsuario } from './formulario';

export const dynamic = 'force-dynamic';

const PERMISOS: { rol: string; puede: string }[] = [
  {
    rol: 'ADMINISTRADOR',
    puede: 'Todo: configuración, usuarios, precios, anulaciones y reportes.',
  },
  { rol: 'VENDEDOR', puede: 'Vender, atender el taller, registrar clientes y cobrar.' },
  { rol: 'ALMACENERO', puede: 'Productos, compras, ajustes de stock y transferencias.' },
  { rol: 'CAJERO', puede: 'Vender, cobrar, manejar caja y cuentas por cobrar.' },
];

export default async function PaginaUsuarios() {
  await requerirRol(...ROLES_ADMIN);

  const usuarios = await db.usuario.findMany({
    include: { _count: { select: { ventas: true, sesionesCaja: true } } },
    orderBy: { nombre: 'asc' },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/configuracion"
            className="text-xs font-semibold text-marca-600 hover:underline"
          >
            ← Configuración
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-800">Usuarios</h1>
        </div>
        <PanelLateral titulo="Nuevo usuario" etiquetaBoton="Nuevo usuario">
          <FormularioUsuario />
        </PanelLateral>
      </div>

      <section className="tarjeta overflow-hidden">
        {usuarios.length === 0 ? (
          <SinDatos />
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th className="text-right">Ventas</th>
                <th className="text-right">Cajas</th>
                <th>Alta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={u.activo ? undefined : 'opacity-60'}>
                  <td className="text-sm font-medium">{u.nombre}</td>
                  <td className="text-xs text-slate-600">{u.email}</td>
                  <td>
                    <Insignia color={u.rol === 'ADMINISTRADOR' ? 'azul' : 'gris'}>
                      {etiqueta(u.rol)}
                    </Insignia>
                  </td>
                  <td className="text-right text-xs">{u._count.ventas}</td>
                  <td className="text-right text-xs">{u._count.sesionesCaja}</td>
                  <td className="text-xs text-slate-500">{fmtFecha(u.creadoEn)}</td>
                  <td className="text-right">
                    <PanelLateral
                      titulo={`Editar ${u.nombre}`}
                      etiquetaBoton="Editar"
                      varianteBoton="secundario"
                    >
                      <FormularioUsuario
                        usuario={{
                          id: u.id,
                          nombre: u.nombre,
                          email: u.email,
                          rol: u.rol,
                          activo: u.activo,
                        }}
                      />
                    </PanelLateral>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="tarjeta p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Qué puede hacer cada rol</h2>
        <ul className="space-y-1 text-sm text-slate-600">
          {PERMISOS.map((p) => (
            <li key={p.rol}>
              <span className="font-semibold text-slate-800">{etiqueta(p.rol)}:</span> {p.puede}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

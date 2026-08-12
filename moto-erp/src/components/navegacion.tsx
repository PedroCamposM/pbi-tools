'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import type { RolUsuario } from '@prisma/client';

type Enlace = {
  href: string;
  etiqueta: string;
  icono: string;
  roles?: RolUsuario[];
};

type Grupo = {
  titulo: string;
  enlaces: Enlace[];
};

const MENU: Grupo[] = [
  {
    titulo: 'Operación diaria',
    enlaces: [
      { href: '/', etiqueta: 'Tablero', icono: '◧' },
      { href: '/pos', etiqueta: 'Punto de venta', icono: '🛒' },
      { href: '/taller', etiqueta: 'Taller', icono: '🔧' },
      { href: '/caja', etiqueta: 'Caja', icono: '💵' },
    ],
  },
  {
    titulo: 'Documentos',
    enlaces: [
      { href: '/ventas', etiqueta: 'Ventas', icono: '🧾' },
      { href: '/compras', etiqueta: 'Compras', icono: '📦' },
      { href: '/cobranzas', etiqueta: 'Cuentas corrientes', icono: '📅' },
    ],
  },
  {
    titulo: 'Catálogo y stock',
    enlaces: [
      { href: '/productos', etiqueta: 'Productos', icono: '⚙️' },
      { href: '/inventario', etiqueta: 'Inventario', icono: '🏷️' },
    ],
  },
  {
    titulo: 'Personas',
    enlaces: [
      { href: '/clientes', etiqueta: 'Clientes', icono: '👤' },
      { href: '/tecnicos', etiqueta: 'Técnicos', icono: '🧰' },
      { href: '/proveedores', etiqueta: 'Proveedores', icono: '🚚' },
    ],
  },
  {
    titulo: 'Análisis',
    enlaces: [{ href: '/reportes', etiqueta: 'Reportes', icono: '📊' }],
  },
  {
    titulo: 'Sistema',
    enlaces: [
      { href: '/configuracion', etiqueta: 'Configuración', icono: '🛠️', roles: ['ADMINISTRADOR'] },
    ],
  },
];

function estaActivo(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navegacion({ rol, nombre }: { rol: string; nombre: string }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  const contenido = (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-4">
      {MENU.map((grupo) => {
        const visibles = grupo.enlaces.filter(
          (e) => !e.roles || e.roles.includes(rol as RolUsuario),
        );
        if (visibles.length === 0) return null;

        return (
          <div key={grupo.titulo}>
            <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {grupo.titulo}
            </p>
            <ul className="space-y-0.5">
              {visibles.map((enlace) => (
                <li key={enlace.href}>
                  <Link
                    href={enlace.href}
                    onClick={() => setAbierto(false)}
                    className={clsx(
                      'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition',
                      estaActivo(pathname, enlace.href)
                        ? 'bg-marca-600 font-semibold text-white'
                        : 'text-slate-300 hover:bg-slate-700/60 hover:text-white',
                    )}
                  >
                    <span aria-hidden className="w-5 text-center text-base leading-none">
                      {enlace.icono}
                    </span>
                    {enlace.etiqueta}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Barra superior solo en móvil */}
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3 text-white lg:hidden">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="rounded p-1.5 hover:bg-slate-700"
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <span className="text-sm font-semibold">MotoERP</span>
        <span className="text-xs text-slate-400">{nombre}</span>
      </div>

      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setAbierto(false)} />
          <aside className="relative h-full w-64 bg-slate-800">{contenido}</aside>
        </div>
      )}

      <aside className="hidden w-60 shrink-0 bg-slate-800 lg:block">{contenido}</aside>
    </>
  );
}

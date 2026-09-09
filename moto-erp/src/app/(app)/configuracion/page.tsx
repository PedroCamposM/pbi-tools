import Link from 'next/link';
import { db } from '@/lib/db';
import { requerirRol, ROLES_ADMIN } from '@/lib/auth';
import { num } from '@/lib/money';
import { FormularioEmpresa } from './formulario-empresa';

export const dynamic = 'force-dynamic';

const SECCIONES = [
  {
    href: '/configuracion/series',
    titulo: 'Series y correlativos',
    detalle: 'F001, B001… numeración de cada tipo de comprobante.',
  },
  {
    href: '/configuracion/almacenes',
    titulo: 'Almacenes',
    detalle: 'Tienda, taller y cualquier otro punto de stock.',
  },
  {
    href: '/configuracion/usuarios',
    titulo: 'Usuarios y accesos',
    detalle: 'Quién entra al sistema y con qué permisos.',
  },
  {
    href: '/productos/catalogos',
    titulo: 'Categorías, marcas y modelos',
    detalle: 'Las listas que alimentan el catálogo de repuestos.',
  },
  {
    href: '/configuracion/respaldos',
    titulo: 'Respaldos',
    detalle: 'Copias de seguridad diarias. Descarga una a un USB de vez en cuando.',
  },
];

export default async function PaginaConfiguracion() {
  await requerirRol(...ROLES_ADMIN);

  const empresa = await db.empresa.findFirst();
  const proveedorFe = process.env.PROVEEDOR_FE ?? 'mock';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Configuración</h1>
        <p className="text-sm text-slate-500">Datos del negocio y parámetros del sistema</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SECCIONES.map((s) => (
          <Link key={s.href} href={s.href} className="tarjeta p-4 transition hover:border-marca-400">
            <p className="text-sm font-semibold text-slate-800">{s.titulo}</p>
            <p className="mt-1 text-xs text-slate-500">{s.detalle}</p>
          </Link>
        ))}
      </div>

      <section className="tarjeta p-5">
        <h2 className="mb-1 text-base font-semibold text-slate-800">Datos de la empresa</h2>
        <p className="mb-4 text-sm text-slate-500">
          Estos datos aparecen en todos los comprobantes y se envían a SUNAT.
        </p>

        <FormularioEmpresa
          empresa={
            empresa
              ? {
                  ruc: empresa.ruc,
                  razonSocial: empresa.razonSocial,
                  nombreComercial: empresa.nombreComercial,
                  direccion: empresa.direccion,
                  ubigeo: empresa.ubigeo,
                  distrito: empresa.distrito,
                  provincia: empresa.provincia,
                  departamento: empresa.departamento,
                  telefono: empresa.telefono,
                  email: empresa.email,
                  igvPorcentaje: num(empresa.igvPorcentaje),
                  regimen: empresa.regimen,
                  piePagina: empresa.piePagina,
                }
              : undefined
          }
        />
      </section>

      <section className="tarjeta p-5">
        <h2 className="mb-1 text-base font-semibold text-slate-800">Facturación electrónica</h2>
        <p className="mb-3 text-sm text-slate-500">
          Proveedor activo:{' '}
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold">
            {proveedorFe}
          </span>
        </p>

        {proveedorFe === 'mock' ? (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Estás en modo simulación.</p>
            <p>
              El sistema genera el XML UBL 2.1 real de cada comprobante y lo guarda, pero no lo
              envía a SUNAT. Sirve para operar mientras tramitas el certificado digital.
            </p>
            <p>
              Para pasar a producción: contrata un OSE/PSE (Nubefact, Efact, Bizlinks…), pon sus
              credenciales en el archivo <code className="font-mono">.env</code> y cambia{' '}
              <code className="font-mono">PROVEEDOR_FE</code>. No hay que rehacer nada más: las
              ventas ya guardan todo lo que exige la norma.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">Envío real activado.</p>
            <p>Los comprobantes se envían al proveedor configurado apenas se emite la venta.</p>
          </div>
        )}
      </section>
    </div>
  );
}

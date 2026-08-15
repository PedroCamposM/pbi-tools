/**
 * Datos iniciales del sistema.
 *
 * Deja el negocio listo para operar: empresa, usuarios, almacenes, series de
 * comprobantes, catalogo de repuestos con stock, clientes, tecnicos y
 * proveedores. Es idempotente: se puede volver a correr sin duplicar nada.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

const D = (v: number | string) => new Prisma.Decimal(v);

async function main() {
  console.log('Sembrando datos iniciales...');

  // -------------------------------------------------------------------------
  // Empresa
  // -------------------------------------------------------------------------
  await db.empresa.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      ruc: '20512345671',
      razonSocial: 'DISTRIBUIDORA DE REPUESTOS EL VELOZ E.I.R.L.',
      nombreComercial: 'Repuestos El Veloz',
      direccion: 'Av. Aviación 1234, Int. 05',
      ubigeo: '150141',
      distrito: 'San Borja',
      provincia: 'Lima',
      departamento: 'Lima',
      telefono: '987654321',
      email: 'ventas@elveloz.pe',
      igvPorcentaje: D(18),
      moneda: 'PEN',
      regimen: 'MYPE_TRIBUTARIO',
      piePagina: 'Gracias por su compra. Repuestos garantizados para su moto.',
    },
  });

  // -------------------------------------------------------------------------
  // Usuarios
  // -------------------------------------------------------------------------
  const usuarios = [
    { nombre: 'Administrador', email: 'admin@elveloz.pe', password: 'admin123', rol: 'ADMINISTRADOR' as const },
    { nombre: 'Rosa Quispe', email: 'ventas@elveloz.pe', password: 'ventas123', rol: 'VENDEDOR' as const },
    { nombre: 'Luis Mendoza', email: 'almacen@elveloz.pe', password: 'almacen123', rol: 'ALMACENERO' as const },
    { nombre: 'Carmen Flores', email: 'caja@elveloz.pe', password: 'caja123', rol: 'CAJERO' as const },
  ];

  for (const u of usuarios) {
    await db.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: {
        nombre: u.nombre,
        email: u.email,
        passwordHash: await bcrypt.hash(u.password, 10),
        rol: u.rol,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Almacenes
  // -------------------------------------------------------------------------
  const tienda = await db.almacen.upsert({
    where: { nombre: 'Tienda principal' },
    update: {},
    create: {
      nombre: 'Tienda principal',
      direccion: 'Av. Aviación 1234',
      predeterminado: true,
    },
  });

  const taller = await db.almacen.upsert({
    where: { nombre: 'Taller' },
    update: {},
    create: { nombre: 'Taller', direccion: 'Av. Aviación 1234 - Fondo', esTaller: true },
  });

  // -------------------------------------------------------------------------
  // Series de comprobantes
  // -------------------------------------------------------------------------
  const series = [
    { tipoComprobante: 'FACTURA' as const, serie: 'F001', predeterminada: true },
    { tipoComprobante: 'BOLETA' as const, serie: 'B001', predeterminada: true },
    { tipoComprobante: 'NOTA_VENTA' as const, serie: 'N001', predeterminada: true },
    { tipoComprobante: 'NOTA_CREDITO' as const, serie: 'F001', predeterminada: true },
    { tipoComprobante: 'NOTA_DEBITO' as const, serie: 'F001', predeterminada: true },
  ];

  for (const s of series) {
    await db.serieComprobante.upsert({
      where: { tipoComprobante_serie: { tipoComprobante: s.tipoComprobante, serie: s.serie } },
      update: {},
      create: { ...s, almacenId: tienda.id },
    });
  }

  // -------------------------------------------------------------------------
  // Categorias del rubro
  // -------------------------------------------------------------------------
  const categorias = [
    ['Motor', 'Pistones, anillos, empaquetaduras, válvulas'],
    ['Transmisión', 'Embragues, cadenas, piñones, catalinas'],
    ['Sistema eléctrico', 'Alternadores, bobinas, CDI, baterías, faros'],
    ['Alimentación', 'Carburadores, inyectores, filtros de aire, bombas'],
    ['Frenos', 'Pastillas, discos, zapatas, bombines'],
    ['Suspensión y dirección', 'Amortiguadores, barras, rodajes de dirección'],
    ['Lubricantes', 'Aceites de motor, de transmisión, grasas'],
    ['Líquidos y aditivos', 'Líquido de frenos, refrigerante, limpia carburador'],
    ['Llantas y cámaras', 'Neumáticos, cámaras, parches'],
    ['Accesorios', 'Espejos, cascos, mangos, protectores'],
    ['Servicios de taller', 'Mano de obra del servicio técnico'],
  ];

  const catId: Record<string, number> = {};
  for (const [nombre, detalle] of categorias) {
    const c = await db.categoria.upsert({
      where: { nombre },
      update: {},
      create: { nombre, detalle },
    });
    catId[nombre] = c.id;
  }

  // -------------------------------------------------------------------------
  // Marcas de repuestos
  // -------------------------------------------------------------------------
  const marcas = [
    'Honda', 'Bajaj', 'Yamaha', 'Italika', 'NGK', 'Bosch', 'Motul', 'Castrol',
    'Vistony', 'Shell', 'Wabro', 'Genérico', 'Faru', 'DID', 'Yuasa',
  ];
  const marcaId: Record<string, number> = {};
  for (const nombre of marcas) {
    const m = await db.marca.upsert({ where: { nombre }, update: {}, create: { nombre } });
    marcaId[nombre] = m.id;
  }

  // -------------------------------------------------------------------------
  // Marcas y modelos de motos (para compatibilidad)
  // -------------------------------------------------------------------------
  const motos: Record<string, [string, string][]> = {
    Honda: [['CG 125', '125cc'], ['CB 125', '125cc'], ['XR 150', '150cc'], ['Wave 110', '110cc'], ['Navi 110', '110cc']],
    Bajaj: [['Pulsar NS 200', '200cc'], ['Pulsar 180', '180cc'], ['Boxer CT 100', '100cc'], ['Discover 125', '125cc'], ['Rouser 135', '135cc']],
    Yamaha: [['YBR 125', '125cc'], ['FZ 150', '150cc'], ['Crypton 110', '110cc']],
    Italika: [['FT 150', '150cc'], ['DT 125', '125cc']],
    Wanxin: [['WX 150', '150cc']],
    Zongshen: [['ZS 150', '150cc']],
  };

  const marcaMotoId: Record<string, number> = {};
  const modeloMotoId: Record<string, number> = {};

  for (const [marca, modelos] of Object.entries(motos)) {
    const mm = await db.marcaMoto.upsert({
      where: { nombre: marca },
      update: {},
      create: { nombre: marca },
    });
    marcaMotoId[marca] = mm.id;

    for (const [modelo, cilindrada] of modelos) {
      const mo = await db.modeloMoto.upsert({
        where: { marcaMotoId_nombre: { marcaMotoId: mm.id, nombre: modelo } },
        update: {},
        create: { marcaMotoId: mm.id, nombre: modelo, cilindrada },
      });
      modeloMotoId[`${marca}|${modelo}`] = mo.id;
    }
  }

  // -------------------------------------------------------------------------
  // Catalogo de productos
  //
  // precioVenta / precioTecnico / precioMayorista se guardan CON IGV incluido,
  // que es como se cotiza en mostrador.
  // -------------------------------------------------------------------------
  type SemillaProducto = {
    sku: string;
    nombre: string;
    categoria: string;
    marca?: string;
    unidad?: string;
    costo: number;
    publico: number;
    tecnico: number;
    mayorista: number;
    stock: number;
    minimo: number;
    ubicacion?: string;
    servicio?: boolean;
    afectacion?: 'GRAVADO' | 'EXONERADO' | 'INAFECTO';
    codigos?: [string, 'OEM' | 'PROVEEDOR' | 'BARRAS' | 'EQUIVALENTE'][];
    aplica?: [string, string?][];
  };

  const productos: SemillaProducto[] = [
    // --- Transmisión ---
    {
      sku: 'EMB-CG125-01', nombre: 'Kit de embrague completo CG 125 (5 discos)',
      categoria: 'Transmisión', marca: 'Honda', costo: 62, publico: 115, tecnico: 95, mayorista: 88,
      stock: 14, minimo: 4, ubicacion: 'A-01',
      codigos: [['22201-KRM-840', 'OEM'], ['7501234567890', 'BARRAS']],
      aplica: [['Honda', 'CG 125'], ['Honda', 'CB 125']],
    },
    {
      sku: 'EMB-PULS180-01', nombre: 'Kit de embrague Pulsar 180 / 200',
      categoria: 'Transmisión', marca: 'Bajaj', costo: 78, publico: 145, tecnico: 122, mayorista: 112,
      stock: 9, minimo: 3, ubicacion: 'A-02',
      codigos: [['JC-18-CLT', 'PROVEEDOR']],
      aplica: [['Bajaj', 'Pulsar 180'], ['Bajaj', 'Pulsar NS 200']],
    },
    {
      sku: 'DIS-EMB-UNIV', nombre: 'Disco de embrague universal 110cc (juego x4)',
      categoria: 'Transmisión', marca: 'Genérico', unidad: 'SET', costo: 22, publico: 45, tecnico: 36, mayorista: 33,
      stock: 26, minimo: 8, ubicacion: 'A-03',
      aplica: [['Honda', 'Wave 110'], ['Yamaha', 'Crypton 110'], ['Bajaj', 'Boxer CT 100']],
    },
    {
      sku: 'CAD-428H-120', nombre: 'Cadena de transmisión 428H x 120 eslabones',
      categoria: 'Transmisión', marca: 'DID', costo: 38, publico: 72, tecnico: 60, mayorista: 55,
      stock: 22, minimo: 6, ubicacion: 'A-05',
      aplica: [['Honda', 'CG 125'], ['Bajaj', 'Discover 125'], ['Yamaha', 'YBR 125']],
    },
    {
      sku: 'KIT-ARR-CG125', nombre: 'Kit de arrastre CG 125 (piñón + catalina + cadena)',
      categoria: 'Transmisión', marca: 'Faru', unidad: 'SET', costo: 68, publico: 128, tecnico: 108, mayorista: 98,
      stock: 11, minimo: 3, ubicacion: 'A-06',
      aplica: [['Honda', 'CG 125']],
    },

    // --- Alimentación ---
    {
      sku: 'CARB-CG125-01', nombre: 'Carburador completo CG 125 / CB 125',
      categoria: 'Alimentación', marca: 'Genérico', costo: 85, publico: 165, tecnico: 138, mayorista: 125,
      stock: 8, minimo: 2, ubicacion: 'B-01',
      codigos: [['16100-KRM-841', 'OEM']],
      aplica: [['Honda', 'CG 125'], ['Honda', 'CB 125']],
    },
    {
      sku: 'CARB-PULS180', nombre: 'Carburador Pulsar 180 UG4',
      categoria: 'Alimentación', marca: 'Bajaj', costo: 132, publico: 245, tecnico: 205, mayorista: 188,
      stock: 5, minimo: 2, ubicacion: 'B-02',
      aplica: [['Bajaj', 'Pulsar 180']],
    },
    {
      sku: 'REP-CARB-125', nombre: 'Kit de reparación de carburador 125cc',
      categoria: 'Alimentación', marca: 'Genérico', unidad: 'SET', costo: 14, publico: 32, tecnico: 25, mayorista: 22,
      stock: 30, minimo: 10, ubicacion: 'B-03',
    },
    {
      sku: 'FIL-AIRE-CG125', nombre: 'Filtro de aire CG 125',
      categoria: 'Alimentación', marca: 'Genérico', costo: 9, publico: 22, tecnico: 17, mayorista: 15,
      stock: 42, minimo: 12, ubicacion: 'B-05',
      aplica: [['Honda', 'CG 125']],
    },

    // --- Sistema eléctrico ---
    {
      sku: 'ALT-CG125-12V', nombre: 'Alternador (estator) CG 125 12V 6 bobinas',
      categoria: 'Sistema eléctrico', marca: 'Genérico', costo: 72, publico: 138, tecnico: 115, mayorista: 105,
      stock: 7, minimo: 2, ubicacion: 'C-01',
      codigos: [['31120-KRM-671', 'OEM']],
      aplica: [['Honda', 'CG 125']],
    },
    {
      sku: 'ALT-PULS-NS200', nombre: 'Alternador Pulsar NS 200',
      categoria: 'Sistema eléctrico', marca: 'Bajaj', costo: 118, publico: 225, tecnico: 188, mayorista: 172,
      stock: 4, minimo: 2, ubicacion: 'C-02',
      aplica: [['Bajaj', 'Pulsar NS 200']],
    },
    {
      sku: 'CDI-CG125', nombre: 'CDI CG 125 6 pines',
      categoria: 'Sistema eléctrico', marca: 'Genérico', costo: 28, publico: 58, tecnico: 47, mayorista: 42,
      stock: 16, minimo: 5, ubicacion: 'C-03',
      aplica: [['Honda', 'CG 125'], ['Honda', 'CB 125']],
    },
    {
      sku: 'BUJ-NGK-C7HSA', nombre: 'Bujía NGK C7HSA',
      categoria: 'Sistema eléctrico', marca: 'NGK', costo: 6.5, publico: 15, tecnico: 12, mayorista: 10.5,
      stock: 120, minimo: 30, ubicacion: 'C-05',
      codigos: [['C7HSA', 'OEM'], ['7501111222333', 'BARRAS']],
      aplica: [['Honda', 'CG 125'], ['Yamaha', 'YBR 125'], ['Bajaj', 'Boxer CT 100']],
    },
    {
      sku: 'BAT-YTX5L-BS', nombre: 'Batería Yuasa YTX5L-BS 12V 5Ah',
      categoria: 'Sistema eléctrico', marca: 'Yuasa', costo: 78, publico: 145, tecnico: 125, mayorista: 115,
      stock: 12, minimo: 4, ubicacion: 'C-07',
      aplica: [['Honda', 'CG 125'], ['Bajaj', 'Discover 125'], ['Italika', 'FT 150']],
    },

    // --- Frenos ---
    {
      sku: 'PAS-FRE-PULS', nombre: 'Pastillas de freno delantero Pulsar (juego)',
      categoria: 'Frenos', marca: 'Genérico', unidad: 'SET', costo: 18, publico: 42, tecnico: 34, mayorista: 30,
      stock: 34, minimo: 10, ubicacion: 'D-01',
      aplica: [['Bajaj', 'Pulsar 180'], ['Bajaj', 'Pulsar NS 200']],
    },
    {
      sku: 'ZAP-FRE-CG125', nombre: 'Zapatas de freno posterior CG 125 (juego)',
      categoria: 'Frenos', marca: 'Genérico', unidad: 'SET', costo: 12, publico: 28, tecnico: 22, mayorista: 20,
      stock: 40, minimo: 12, ubicacion: 'D-02',
      aplica: [['Honda', 'CG 125'], ['Honda', 'CB 125']],
    },
    {
      sku: 'LIQ-FRE-DOT4', nombre: 'Líquido de frenos DOT 4 x 500ml',
      categoria: 'Líquidos y aditivos', marca: 'Bosch', unidad: 'MLT', costo: 16, publico: 32, tecnico: 26, mayorista: 23,
      stock: 28, minimo: 8, ubicacion: 'E-01',
      codigos: [['DOT4-500', 'PROVEEDOR']],
    },
    {
      sku: 'LIQ-FRE-DOT3', nombre: 'Líquido de frenos DOT 3 x 300ml',
      categoria: 'Líquidos y aditivos', marca: 'Wabro', unidad: 'MLT', costo: 9, publico: 20, tecnico: 16, mayorista: 14,
      stock: 35, minimo: 10, ubicacion: 'E-02',
    },

    // --- Lubricantes ---
    {
      sku: 'ACE-MOT-20W50', nombre: 'Aceite de motor 4T 20W-50 mineral x 1L',
      categoria: 'Lubricantes', marca: 'Vistony', unidad: 'LTR', costo: 17, publico: 32, tecnico: 26, mayorista: 24,
      stock: 96, minimo: 24, ubicacion: 'E-05',
    },
    {
      sku: 'ACE-MOT-10W40-S', nombre: 'Aceite de motor 4T 10W-40 semisintético x 1L',
      categoria: 'Lubricantes', marca: 'Motul', unidad: 'LTR', costo: 34, publico: 62, tecnico: 52, mayorista: 47,
      stock: 48, minimo: 12, ubicacion: 'E-06',
    },
    {
      sku: 'ACE-TRANS-80W90', nombre: 'Aceite de transmisión 80W-90 x 1L',
      categoria: 'Lubricantes', marca: 'Castrol', unidad: 'LTR', costo: 22, publico: 42, tecnico: 34, mayorista: 31,
      stock: 30, minimo: 8, ubicacion: 'E-07',
    },
    {
      sku: 'GRA-MULTI-500', nombre: 'Grasa multipropósito x 500g',
      categoria: 'Lubricantes', marca: 'Shell', costo: 11, publico: 24, tecnico: 19, mayorista: 17,
      stock: 25, minimo: 6, ubicacion: 'E-08',
    },
    {
      sku: 'LIM-CARB-400', nombre: 'Limpia carburador en aerosol x 400ml',
      categoria: 'Líquidos y aditivos', marca: 'Genérico', costo: 12, publico: 25, tecnico: 20, mayorista: 18,
      stock: 44, minimo: 12, ubicacion: 'E-09',
    },

    // --- Motor ---
    {
      sku: 'EMP-MOT-CG125', nombre: 'Juego de empaquetaduras de motor CG 125',
      categoria: 'Motor', marca: 'Genérico', unidad: 'SET', costo: 24, publico: 52, tecnico: 42, mayorista: 38,
      stock: 15, minimo: 5, ubicacion: 'F-01',
      aplica: [['Honda', 'CG 125']],
    },
    {
      sku: 'PIS-CG125-STD', nombre: 'Kit de pistón CG 125 STD (56.5mm)',
      categoria: 'Motor', marca: 'Genérico', unidad: 'SET', costo: 48, publico: 95, tecnico: 78, mayorista: 71,
      stock: 10, minimo: 3, ubicacion: 'F-02',
      aplica: [['Honda', 'CG 125']],
    },

    // --- Suspensión / llantas ---
    {
      sku: 'AMO-POST-CG125', nombre: 'Amortiguador posterior CG 125 (par)',
      categoria: 'Suspensión y dirección', marca: 'Genérico', unidad: 'PR', costo: 58, publico: 115, tecnico: 95, mayorista: 86,
      stock: 8, minimo: 2, ubicacion: 'G-01',
      aplica: [['Honda', 'CG 125']],
    },
    {
      sku: 'LLA-275-18', nombre: 'Llanta 2.75-18 con cámara',
      categoria: 'Llantas y cámaras', marca: 'Genérico', costo: 62, publico: 118, tecnico: 98, mayorista: 90,
      stock: 18, minimo: 6, ubicacion: 'H-01',
      aplica: [['Honda', 'CG 125'], ['Yamaha', 'YBR 125']],
    },
    {
      sku: 'CAM-275-18', nombre: 'Cámara de llanta 2.75-18',
      categoria: 'Llantas y cámaras', marca: 'Genérico', costo: 11, publico: 24, tecnico: 19, mayorista: 17,
      stock: 40, minimo: 12, ubicacion: 'H-02',
    },

    // --- Accesorios ---
    {
      sku: 'ESP-UNIV-PAR', nombre: 'Espejos universales cromados (par)',
      categoria: 'Accesorios', marca: 'Genérico', unidad: 'PR', costo: 15, publico: 35, tecnico: 28, mayorista: 25,
      stock: 22, minimo: 6, ubicacion: 'I-01',
    },

    // --- Servicios de taller (mano de obra) ---
    {
      sku: 'SRV-MANT-BAS', nombre: 'Mantenimiento preventivo básico (cambio de aceite y revisión)',
      categoria: 'Servicios de taller', unidad: 'ZZ', costo: 0, publico: 45, tecnico: 45, mayorista: 45,
      stock: 0, minimo: 0, servicio: true,
    },
    {
      sku: 'SRV-CAMB-EMB', nombre: 'Mano de obra: cambio de embrague',
      categoria: 'Servicios de taller', unidad: 'ZZ', costo: 0, publico: 80, tecnico: 80, mayorista: 80,
      stock: 0, minimo: 0, servicio: true,
    },
    {
      sku: 'SRV-CARB-LIM', nombre: 'Mano de obra: limpieza y calibración de carburador',
      categoria: 'Servicios de taller', unidad: 'ZZ', costo: 0, publico: 60, tecnico: 60, mayorista: 60,
      stock: 0, minimo: 0, servicio: true,
    },
    {
      sku: 'SRV-ELEC-DIAG', nombre: 'Mano de obra: diagnóstico del sistema eléctrico',
      categoria: 'Servicios de taller', unidad: 'ZZ', costo: 0, publico: 50, tecnico: 50, mayorista: 50,
      stock: 0, minimo: 0, servicio: true,
    },
    {
      sku: 'SRV-FRE-CAL', nombre: 'Mano de obra: calibración de frenos y purgado',
      categoria: 'Servicios de taller', unidad: 'ZZ', costo: 0, publico: 40, tecnico: 40, mayorista: 40,
      stock: 0, minimo: 0, servicio: true,
    },
  ];

  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@elveloz.pe' } });

  for (const p of productos) {
    const existente = await db.producto.findUnique({ where: { sku: p.sku } });
    if (existente) continue;

    const creado = await db.producto.create({
      data: {
        sku: p.sku,
        nombre: p.nombre,
        categoriaId: catId[p.categoria],
        marcaId: p.marca ? marcaId[p.marca] : null,
        unidadMedida: p.unidad ?? (p.servicio ? 'ZZ' : 'NIU'),
        afectacionIgv: p.afectacion ?? 'GRAVADO',
        esServicio: p.servicio ?? false,
        costoPromedio: D(p.costo),
        ultimoCosto: D(p.costo),
        precioVenta: D(p.publico),
        precioTecnico: D(p.tecnico),
        precioMayorista: D(p.mayorista),
        stockMinimo: D(p.minimo),
        stockMaximo: D(p.minimo * 5),
        ubicacion: p.ubicacion ?? null,
      },
    });

    for (const [codigo, tipo] of p.codigos ?? []) {
      await db.codigoAlterno.create({
        data: { productoId: creado.id, codigo, tipo },
      });
    }

    for (const [marca, modelo] of p.aplica ?? []) {
      await db.aplicacionMoto.create({
        data: {
          productoId: creado.id,
          marcaMotoId: marcaMotoId[marca],
          modeloMotoId: modelo ? (modeloMotoId[`${marca}|${modelo}`] ?? null) : null,
        },
      });
    }

    // Carga inicial de inventario valorizada.
    if (!p.servicio && p.stock > 0) {
      await db.stock.create({
        data: {
          productoId: creado.id,
          almacenId: tienda.id,
          cantidad: D(p.stock),
          costoPromedio: D(p.costo),
        },
      });

      await db.movimientoInventario.create({
        data: {
          productoId: creado.id,
          almacenId: tienda.id,
          tipo: 'INVENTARIO_INICIAL',
          cantidad: D(p.stock),
          costoUnitario: D(p.costo),
          saldoCantidad: D(p.stock),
          saldoCosto: D(p.costo),
          referencia: 'Carga inicial del sistema',
          usuarioId: admin.id,
        },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Stock de mostrador en el taller
  //
  // Los consumibles que el mecánico usa a diario se dejan cargados en el
  // almacén del taller para que las órdenes de trabajo puedan descontarlos sin
  // pedir una transferencia por cada servicio.
  // -------------------------------------------------------------------------
  const stockTaller: [string, number][] = [
    ['ACE-MOT-20W50', 12],
    ['ACE-MOT-10W40-S', 6],
    ['BUJ-NGK-C7HSA', 20],
    ['LIQ-FRE-DOT4', 6],
    ['LIQ-FRE-DOT3', 6],
    ['ZAP-FRE-CG125', 6],
    ['PAS-FRE-PULS', 6],
    ['DIS-EMB-UNIV', 4],
    ['FIL-AIRE-CG125', 8],
    ['LIM-CARB-400', 6],
    ['GRA-MULTI-500', 4],
  ];

  for (const [sku, cantidad] of stockTaller) {
    const producto = await db.producto.findUnique({ where: { sku } });
    if (!producto) continue;

    const yaTiene = await db.stock.findUnique({
      where: { productoId_almacenId: { productoId: producto.id, almacenId: taller.id } },
    });
    if (yaTiene) continue;

    await db.stock.create({
      data: {
        productoId: producto.id,
        almacenId: taller.id,
        cantidad: D(cantidad),
        costoPromedio: producto.costoPromedio,
      },
    });

    await db.movimientoInventario.create({
      data: {
        productoId: producto.id,
        almacenId: taller.id,
        tipo: 'INVENTARIO_INICIAL',
        cantidad: D(cantidad),
        costoUnitario: producto.costoPromedio,
        saldoCantidad: D(cantidad),
        saldoCosto: producto.costoPromedio,
        referencia: 'Carga inicial del taller',
        usuarioId: admin.id,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Proveedores
  // -------------------------------------------------------------------------
  const proveedores = [
    { numeroDocumento: '20601234567', razonSocial: 'IMPORTACIONES MOTOPARTES DEL PERU S.A.C.', contacto: 'Jorge Ríos', telefono: '014567890', diasCredito: 30, direccion: 'Jr. Paruro 850, Lima' },
    { numeroDocumento: '20509876543', razonSocial: 'LUBRICANTES Y FILTROS ANDINOS E.I.R.L.', contacto: 'Ana Salazar', telefono: '987112233', diasCredito: 15, direccion: 'Av. Argentina 2200, Callao' },
    { numeroDocumento: '20456789012', razonSocial: 'REPUESTOS ORIENTALES IMPORT S.A.C.', contacto: 'Wei Chen', telefono: '956443322', diasCredito: 0, direccion: 'Jr. Andahuaylas 500, Lima' },
  ];

  for (const p of proveedores) {
    await db.proveedor.upsert({
      where: { tipoDocumento_numeroDocumento: { tipoDocumento: 'RUC', numeroDocumento: p.numeroDocumento } },
      update: {},
      create: { tipoDocumento: 'RUC', ...p },
    });
  }

  // -------------------------------------------------------------------------
  // Clientes
  // -------------------------------------------------------------------------
  const clientes = [
    { tipoDocumento: 'SIN_DOCUMENTO' as const, numeroDocumento: '00000000', nombre: 'CLIENTE VARIOS', tipoCliente: 'PUBLICO' as const },
    { tipoDocumento: 'DNI' as const, numeroDocumento: '45678912', nombre: 'PEDRO HUAMÁN CCOPA', telefono: '966554433', direccion: 'Av. Los Héroes 450, San Juan de Miraflores', tipoCliente: 'PUBLICO' as const },
    { tipoDocumento: 'DNI' as const, numeroDocumento: '41235698', nombre: 'MARÍA CONDORI APAZA', telefono: '977889900', direccion: 'Jr. Ayacucho 120, Villa El Salvador', tipoCliente: 'PUBLICO' as const },
    { tipoDocumento: 'RUC' as const, numeroDocumento: '20605123456', nombre: 'MOTO SERVICIOS SAN MARTÍN S.A.C.', telefono: '013456789', direccion: 'Av. San Martín 780, Ate', tipoCliente: 'MAYORISTA' as const, lineaCredito: 5000, diasCredito: 30 },
  ];

  for (const c of clientes) {
    await db.cliente.upsert({
      where: { tipoDocumento_numeroDocumento: { tipoDocumento: c.tipoDocumento, numeroDocumento: c.numeroDocumento } },
      update: {},
      create: { ...c, lineaCredito: D(c.lineaCredito ?? 0) },
    });
  }

  // -------------------------------------------------------------------------
  // Tecnicos con su ficha de cliente (compran al credito con precio tecnico)
  // -------------------------------------------------------------------------
  const tecnicos = [
    { nombre: 'Julio Ramírez Vega', documento: '42589631', telefono: '958741236', taller: 'Taller Julio - Chorrillos', ventaPct: 6, servicioPct: 40, lineaCredito: 1500 },
    { nombre: 'Marcos Ticona Puma', documento: '43871259', telefono: '941258963', taller: 'Moto Fix Marcos - SJM', ventaPct: 5, servicioPct: 35, lineaCredito: 1000 },
    { nombre: 'Elmer Cárdenas Rojas', documento: '46125879', telefono: '932145678', taller: 'Servicio propio (interno)', ventaPct: 0, servicioPct: 45, lineaCredito: 0 },
  ];

  for (const t of tecnicos) {
    const existente = await db.tecnico.findFirst({ where: { documento: t.documento } });
    if (existente) continue;

    let clienteId: number | null = null;
    if (t.lineaCredito > 0) {
      const cliente = await db.cliente.upsert({
        where: { tipoDocumento_numeroDocumento: { tipoDocumento: 'DNI', numeroDocumento: t.documento } },
        update: {},
        create: {
          tipoDocumento: 'DNI',
          numeroDocumento: t.documento,
          nombre: t.nombre.toUpperCase(),
          telefono: t.telefono,
          tipoCliente: 'TECNICO',
          lineaCredito: D(t.lineaCredito),
          diasCredito: 15,
        },
      });
      clienteId = cliente.id;
    }

    await db.tecnico.create({
      data: {
        nombre: t.nombre,
        documento: t.documento,
        telefono: t.telefono,
        taller: t.taller,
        comisionVentaPct: D(t.ventaPct),
        comisionServicioPct: D(t.servicioPct),
        clienteId,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Motos de clientes (historial del taller)
  // -------------------------------------------------------------------------
  const pedro = await db.cliente.findUnique({
    where: { tipoDocumento_numeroDocumento: { tipoDocumento: 'DNI', numeroDocumento: '45678912' } },
  });

  if (pedro) {
    const yaTiene = await db.moto.findFirst({ where: { clienteId: pedro.id } });
    if (!yaTiene) {
      await db.moto.create({
        data: {
          placa: 'M1B-234',
          clienteId: pedro.id,
          marcaMotoId: marcaMotoId['Honda'],
          modeloMotoId: modeloMotoId['Honda|CG 125'],
          anio: 2021,
          color: 'Rojo',
          numeroMotor: 'KRM1234567',
        },
      });
    }
  }

  console.log(`
Datos sembrados correctamente.

  Almacenes:  ${tienda.nombre} (principal), ${taller.nombre}
  Productos:  ${await db.producto.count()}
  Clientes:   ${await db.cliente.count()}
  Técnicos:   ${await db.tecnico.count()}

Usuarios de acceso:
  admin@elveloz.pe    / admin123    (Administrador)
  ventas@elveloz.pe   / ventas123   (Vendedor)
  almacen@elveloz.pe  / almacen123  (Almacenero)
  caja@elveloz.pe     / caja123     (Cajero)
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

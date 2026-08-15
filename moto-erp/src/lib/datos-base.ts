/**
 * Listas base del rubro de repuestos de moto.
 *
 * Son datos genéricos y útiles para cualquier distribuidora: las líneas de
 * producto, las marcas más comunes y el parque de motos que circula en Perú.
 * No incluye productos, clientes ni técnicos: eso lo carga cada negocio.
 *
 * Lo usan el asistente de primer uso y el sembrado de demostración.
 */

export const CATEGORIAS_BASE: [nombre: string, detalle: string][] = [
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

export const MARCAS_BASE: string[] = [
  'Honda',
  'Bajaj',
  'Yamaha',
  'Italika',
  'NGK',
  'Bosch',
  'Motul',
  'Castrol',
  'Vistony',
  'Shell',
  'Wabro',
  'Genérico',
  'Faru',
  'DID',
  'Yuasa',
];

/** Marca de moto → modelos con su cilindrada. */
export const MOTOS_BASE: Record<string, [modelo: string, cilindrada: string][]> = {
  Honda: [
    ['CG 125', '125cc'],
    ['CB 125', '125cc'],
    ['XR 150', '150cc'],
    ['Wave 110', '110cc'],
    ['Navi 110', '110cc'],
  ],
  Bajaj: [
    ['Pulsar NS 200', '200cc'],
    ['Pulsar 180', '180cc'],
    ['Boxer CT 100', '100cc'],
    ['Discover 125', '125cc'],
    ['Rouser 135', '135cc'],
  ],
  Yamaha: [
    ['YBR 125', '125cc'],
    ['FZ 150', '150cc'],
    ['Crypton 110', '110cc'],
  ],
  Italika: [
    ['FT 150', '150cc'],
    ['DT 125', '125cc'],
  ],
  Wanxin: [['WX 150', '150cc']],
  Zongshen: [['ZS 150', '150cc']],
};

/**
 * Servicios de taller que casi toda distribuidora con servicio técnico cobra.
 * Se crean como productos de tipo servicio (no manejan stock) para que puedan
 * cargarse en una orden de trabajo y facturarse.
 */
export const SERVICIOS_BASE: [sku: string, nombre: string, precio: number][] = [
  ['SRV-MANT-BAS', 'Mantenimiento preventivo básico (cambio de aceite y revisión)', 45],
  ['SRV-CAMB-EMB', 'Mano de obra: cambio de embrague', 80],
  ['SRV-CARB-LIM', 'Mano de obra: limpieza y calibración de carburador', 60],
  ['SRV-ELEC-DIAG', 'Mano de obra: diagnóstico del sistema eléctrico', 50],
  ['SRV-FRE-CAL', 'Mano de obra: calibración de frenos y purgado', 40],
];

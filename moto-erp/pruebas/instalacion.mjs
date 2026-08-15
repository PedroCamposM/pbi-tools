/**
 * Prueba del asistente de primer uso.
 *
 * Simula lo que verá quien reciba el instalador: una base recién creada,
 * completamente vacía. Verifica que el asistente deje el sistema operativo y
 * que se pueda vender de inmediato.
 */
import { chromium } from 'playwright';

const BASE = process.env.URL_BASE ?? 'http://localhost:3000';
const paso = (t) => console.log(`\n▶ ${t}`);
const ok = (t) => console.log(`  ✓ ${t}`);
const fallo = (t) => {
  console.error(`  ✗ ${t}`);
  process.exitCode = 1;
};

const navegador = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const pagina = await (await navegador.newContext({ locale: 'es-PE' })).newPage();
pagina.on('pageerror', (e) => fallo(`pageerror: ${e.message}`));

try {
  paso('Sistema recién instalado');
  await pagina.goto(`${BASE}/`);
  await pagina.waitForURL(/\/bienvenida$/, { timeout: 15000 });
  ok('la aplicación lleva sola al asistente, sin pedir usuario');

  paso('Paso 1 — datos del negocio');
  await pagina.fill('input[name=ruc]', '20512345671');
  await pagina.fill('input[name=razonSocial]', 'REPUESTOS DEL SUR S.A.C.');
  await pagina.fill('input[name=nombreComercial]', 'Moto Sur');
  await pagina.fill('input[name=direccion]', 'Av. Los Mecánicos 456');
  await pagina.fill('input[name=distrito]', 'Villa El Salvador');
  await pagina.fill('input[name=telefono]', '987111222');
  await pagina.click('button:has-text("Continuar")');
  ok('datos cargados');

  paso('Paso 2 — comprobantes');
  // Simula una migración desde otro sistema: ya emitió 245 facturas.
  await pagina.fill('input[name=correlativoFactura]', '245');
  await pagina.fill('input[name=correlativoBoleta]', '1320');
  await pagina.click('button:has-text("Continuar")');
  ok('series y correlativos de arranque definidos');

  paso('Paso 3 — usuario administrador');
  await pagina.fill('input[name=adminNombre]', 'Carlos Ramírez');
  await pagina.fill('input[name=adminEmail]', 'carlos@motosur.pe');
  await pagina.fill('input[name=adminPassword]', 'clavesegura2026');
  await pagina.fill('input[name=adminPassword2]', 'clavesegura2026');
  await pagina.click('button:has-text("Terminar e ingresar")');

  await pagina.waitForURL(`${BASE}/`, { timeout: 25000 });
  ok('sistema configurado y sesión iniciada automáticamente');

  paso('El sistema quedó operativo');
  const tablero = await pagina.locator('body').innerText();
  if (/Moto Sur/.test(tablero)) ok('el encabezado muestra el negocio del usuario');
  else fallo('no aparece el nombre del negocio');
  if (/20512345671/.test(tablero)) ok('muestra su RUC');
  if (/El Veloz|elveloz/.test(tablero)) fallo('quedaron datos de demostración');
  else ok('sin rastros de los datos de demostración');

  // Series: debe continuar desde donde venía, no desde cero.
  await pagina.goto(`${BASE}/configuracion/series`);
  const series = await pagina.locator('body').innerText();
  if (/F001-00000246/.test(series)) ok('la próxima factura será la F001-00000246');
  else fallo('la numeración de facturas no continúa desde el último emitido');
  if (/B001-00001321/.test(series)) ok('la próxima boleta será la B001-00001321');
  else fallo('la numeración de boletas no continúa');

  // Catálogo base
  await pagina.goto(`${BASE}/productos/catalogos`);
  const catalogos = await pagina.locator('body').innerText();
  if (/Transmisión/.test(catalogos) && /Frenos/.test(catalogos)) ok('líneas de producto cargadas');
  else fallo('faltan las líneas de producto');
  if (/Pulsar/.test(catalogos)) ok('modelos de moto cargados para la búsqueda por compatibilidad');
  else fallo('faltan los modelos de moto');

  // Servicios de taller facturables
  await pagina.goto(`${BASE}/productos`);
  const productos = await pagina.locator('body').innerText();
  if (/Mantenimiento preventivo/.test(productos)) ok('servicios de taller listos para cobrar');
  else fallo('faltan los servicios de taller');

  paso('Se puede vender desde el primer minuto');
  await pagina.goto(`${BASE}/caja`);
  await pagina.fill('input[name=montoApertura]', '100');
  await pagina.click('button:has-text("Abrir caja")');
  await pagina.waitForSelector('h1:has-text("Caja abierta")', { timeout: 15000 });
  ok('caja abierta');

  await pagina.goto(`${BASE}/pos`);
  await pagina.fill('input[placeholder*="Buscar por código"]', 'Mantenimiento');
  await pagina.waitForSelector('ul li button', { timeout: 15000 });
  await pagina.locator('ul li button').first().click();

  await pagina.fill('input[placeholder="Nombre o documento…"]', 'VARIOS');
  await pagina.waitForSelector('ul li button:has-text("VARIOS")', { timeout: 15000 });
  await pagina.locator('ul li button:has-text("VARIOS")').first().click();
  ok('cliente genérico de mostrador disponible');

  await pagina.click('button:has-text("Importe exacto")');
  await pagina.click('button:has-text("Cobrar")');
  await pagina.waitForSelector('text=/Venta .* registrada/', { timeout: 25000 });
  const aviso = await pagina.locator('text=/Venta .* registrada/').innerText();
  ok(aviso.trim());
  if (/B001-00001321/.test(aviso)) ok('el comprobante salió con la numeración correcta');
  else fallo(`numeración inesperada: ${aviso}`);

  paso('El asistente no se puede volver a correr');
  await pagina.goto(`${BASE}/bienvenida`);
  await pagina.waitForURL(/\/(login)?$/, { timeout: 15000 });
  ok('con el sistema ya configurado, /bienvenida ya no permite reconfigurar');
} catch (e) {
  fallo(`excepción: ${e.message}`);
  await pagina.screenshot({ path: 'fallo-instalacion.png', fullPage: true });
} finally {
  await navegador.close();
}

console.log(process.exitCode ? '\n=== HAY FALLAS ===' : '\n=== TODO OK ===');

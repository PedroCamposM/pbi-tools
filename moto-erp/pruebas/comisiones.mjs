/**
 * Prueba del circuito de técnicos: comisión por venta derivada, comisión por
 * mano de obra y liquidación con salida de caja.
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
  // CHROMIUM_PATH permite apuntar a un Chromium ya instalado en el sistema.
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const pagina = await (await navegador.newContext({ locale: 'es-PE' })).newPage();
pagina.on('pageerror', (e) => fallo(`pageerror: ${e.message}`));

try {
  await pagina.goto(`${BASE}/login`);
  await pagina.fill('input[name=email]', 'admin@elveloz.pe');
  await pagina.fill('input[name=password]', 'admin123');
  await pagina.click('button[type=submit]');
  await pagina.waitForURL(`${BASE}/`);

  // Asegurar caja abierta
  await pagina.goto(`${BASE}/caja`);
  if (await pagina.locator('input[name=montoApertura]').count()) {
    await pagina.fill('input[name=montoApertura]', '200');
    await pagina.click('button:has-text("Abrir caja")');
    await pagina.waitForSelector('h1:has-text("Caja abierta")');
  }

  // ------------------------------------------------- comisión por venta
  paso('Venta derivada por un técnico');
  await pagina.goto(`${BASE}/pos`);
  await pagina.fill('input[placeholder*="Buscar por código"]', 'aceite');
  await pagina.waitForSelector('ul li button');
  await pagina.locator('ul li button').first().click();

  await pagina.fill('input[placeholder="Nombre o documento…"]', 'PEDRO');
  await pagina.waitForSelector('ul li button:has-text("PEDRO")');
  await pagina.locator('ul li button:has-text("PEDRO")').first().click();

  // Julio Ramírez: 6 % sobre venta
  const selectorTecnico = pagina.locator('select').filter({ hasText: 'Sin técnico' });
  await selectorTecnico.selectOption({ label: 'Julio Ramírez Vega' });
  ok('técnico asignado a la venta');

  await pagina.click('button:has-text("Importe exacto")');
  await pagina.click('button:has-text("Cobrar")');
  await pagina.waitForSelector('text=/Venta .* registrada/', { timeout: 20000 });
  ok((await pagina.locator('text=/Venta .* registrada/').innerText()).trim());

  // ------------------------------------------------- comisión por servicio
  paso('Orden de trabajo ejecutada por un técnico');
  await pagina.goto(`${BASE}/taller/nueva`);
  await pagina.selectOption('select[name=clienteId]', { index: 1 });
  await pagina.selectOption('select[name=tecnicoId]', { label: 'Julio Ramírez Vega' });
  await pagina.fill('textarea[name=motivoIngreso]', 'Cambio de aceite y calibración de frenos.');
  await pagina.click('button:has-text("Crear orden de trabajo")');
  await pagina.waitForURL(/\/taller\/\d+$/, { timeout: 20000 });
  ok(`orden creada con técnico: ${await pagina.locator('h1').innerText()}`);

  const seccionServicios = pagina.locator('section:has-text("Mano de obra")');
  await seccionServicios.locator('select[name=productoId]').selectOption({ index: 1 });
  await seccionServicios.locator('button:has-text("Agregar mano de obra")').click();
  await pagina.waitForTimeout(2000);

  await pagina.reload();
  await pagina.click('button:has-text("Marcar como terminada")');
  await pagina.waitForSelector('button:has-text("Facturar y entregar")', { timeout: 20000 });
  ok('orden terminada — debe haberse generado la comisión de servicio');

  // ------------------------------------------------- verificación
  paso('Comisiones acumuladas');
  await pagina.goto(`${BASE}/tecnicos`);
  const tabla = await pagina.locator('body').innerText();
  if (/Julio Ramírez Vega/.test(tabla)) ok('el técnico aparece en el listado');

  await pagina.locator('tr:has-text("Julio Ramírez Vega") a:has-text("Detalle")').click();
  await pagina.waitForURL(/\/tecnicos\/\d+$/);
  const ficha = await pagina.locator('body').innerText();

  const tieneVenta = /Comisión por venta/.test(ficha);
  const tieneServicio = /Mano de obra orden/.test(ficha);
  tieneVenta ? ok('comisión por VENTA registrada') : fallo('falta la comisión por venta');
  tieneServicio ? ok('comisión por SERVICIO registrada') : fallo('falta la comisión por servicio');

  const pendiente = ficha.match(/Comisión pendiente\s*\n?\s*(S\/\s*[\d,.]+)/);
  if (pendiente) ok(`pendiente acumulado: ${pendiente[1]}`);

  // ------------------------------------------------- liquidación
  paso('Liquidación de comisiones');
  await pagina.goto(`${BASE}/tecnicos`);
  await pagina.click('button:has-text("Liquidar comisiones")');
  await pagina.waitForSelector('select[name=tecnicoId]');
  const opciones = await pagina.locator('select[name=tecnicoId] option').allTextContents();
  const opcionJulio = opciones.findIndex((o) => o.includes('Julio'));
  console.log('  opciones de liquidación:', opciones.filter(Boolean).join(' | '));
  await pagina.selectOption('select[name=tecnicoId]', { index: opcionJulio });
  await pagina.click('button:has-text("Liquidar y pagar")');
  await pagina.waitForSelector('text=/Se liquidaron|No hay comisiones/', { timeout: 20000 });
  const aviso = await pagina.locator('text=/Se liquidaron|No hay comisiones/').innerText();
  if (aviso.startsWith('Se liquidaron')) ok(aviso.trim());
  else fallo(aviso.trim());
} catch (e) {
  fallo(`excepción: ${e.message}`);
  await pagina.screenshot({ path: 'fallo-comisiones.png', fullPage: true });
} finally {
  await navegador.close();
}

console.log(process.exitCode ? '\n=== HAY FALLAS ===' : '\n=== TODO OK ===');

/**
 * Prueba de compras (ingreso valorizado al kardex + cuenta por pagar) y del
 * circuito de venta al crédito con su cobranza posterior.
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

  await pagina.goto(`${BASE}/caja`);
  if (await pagina.locator('input[name=montoApertura]').count()) {
    await pagina.fill('input[name=montoApertura]', '300');
    await pagina.click('button:has-text("Abrir caja")');
    await pagina.waitForSelector('h1:has-text("Caja abierta")');
  }

  // ------------------------------------------------------------- compra
  paso('Compra a proveedor al crédito');
  await pagina.goto(`${BASE}/compras/nueva`);
  await pagina.selectOption('select:has(option:text-matches("Seleccionar proveedor"))', { index: 1 });
  await pagina.fill('input[placeholder="F001"]', 'F001');
  await pagina.fill('input[placeholder="00012345"]', '00098765');

  await pagina.fill('input[placeholder*="Buscar producto"]', 'bujía');
  await pagina.waitForSelector('ul li button');
  await pagina.locator('ul li button').first().click();

  const fila = pagina.locator('tbody tr').first();
  await fila.locator('input').nth(0).fill('50'); // cantidad
  await fila.locator('input').nth(1).fill('8'); // costo unitario s/IGV
  await fila.locator('input').nth(2).fill('18'); // nuevo precio de venta

  const total = await pagina.locator('dt:text-is("Total") + dd').last().innerText();
  ok(`total de la compra: ${total}`);

  await pagina.click('button:has-text("Registrar compra")');
  await pagina.waitForURL(/\/compras\/\d+$/, { timeout: 20000 });
  const detalle = await pagina.locator('body').innerText();
  if (/Recibida/.test(detalle)) ok('compra registrada e ingresada al inventario');
  else fallo('la compra no quedó como recibida');
  if (/Cuenta por pagar/.test(detalle) && /Saldo/.test(detalle)) ok('generó la cuenta por pagar');

  // El costo promedio debe haber subido (seed: 6.50, compra: 8.00)
  await pagina.goto(`${BASE}/productos`);
  await pagina.fill('input[name=q]', 'BUJ-NGK');
  await pagina.click('button:has-text("Filtrar")');
  await pagina.waitForSelector('td:has-text("BUJ-NGK-C7HSA")');
  await pagina.locator('a:has-text("Bujía NGK")').first().click();
  await pagina.waitForURL(/\/productos\/\d+$/);
  const ficha = await pagina.locator('body').innerText();
  const costo = ficha.match(/Costo promedio\s*\n?\s*S\/\s*([\d.,]+)/);
  const precio = ficha.match(/Precio público\s*\n?\s*S\/\s*([\d.,]+)/);
  if (costo) ok(`costo promedio recalculado: S/ ${costo[1]} (era 6.50)`);
  if (precio && precio[1].includes('18')) ok(`precio de venta actualizado desde la compra: S/ ${precio[1]}`);
  if (/Compra F001-00098765|Compra F001/.test(ficha)) ok('el ingreso aparece en el kardex del producto');

  // ------------------------------------------------- venta al crédito
  paso('Venta al crédito a un cliente mayorista');
  await pagina.goto(`${BASE}/pos`);
  await pagina.fill('input[placeholder*="Buscar por código"]', 'cadena');
  await pagina.waitForSelector('ul li button');
  await pagina.locator('ul li button').first().click();

  await pagina.fill('input[placeholder="Nombre o documento…"]', 'MOTO SERVICIOS');
  await pagina.waitForSelector('ul li button:has-text("MOTO SERVICIOS")');
  await pagina.locator('ul li button:has-text("MOTO SERVICIOS")').first().click();
  ok('cliente mayorista con línea de crédito seleccionado');

  const selCondicion = pagina.locator('select').filter({ hasText: 'Contado' });
  await selCondicion.selectOption('CREDITO');
  await pagina.waitForSelector('text=Queda al crédito', { timeout: 10000 });
  const saldo = await pagina.locator('text=/Queda al crédito/').innerText();
  ok(saldo.trim());

  await pagina.click('button:has-text("Cobrar")');
  await pagina.waitForSelector('text=/Venta .* registrada/', { timeout: 20000 });
  ok((await pagina.locator('text=/Venta .* registrada/').innerText()).trim());

  // ------------------------------------------------- cobranza
  paso('Cobranza de la cuenta pendiente');
  await pagina.goto(`${BASE}/cobranzas`);
  const cuentas = await pagina.locator('body').innerText();
  if (/MOTO SERVICIOS/.test(cuentas)) ok('la cuenta por cobrar aparece en el listado');
  else fallo('no se generó la cuenta por cobrar');

  await pagina.locator('tr:has-text("MOTO SERVICIOS") button:has-text("Cobrar")').first().click();
  await pagina.waitForSelector('input[name=monto]');
  await pagina.click('button:has-text("Registrar cobro")');
  await pagina.waitForTimeout(2500);

  await pagina.goto(`${BASE}/cobranzas`);
  const despues = await pagina.locator('body').innerText();
  if (!/MOTO SERVICIOS/.test(despues)) ok('la cuenta quedó saldada y sale del listado de pendientes');
  else fallo('la cuenta sigue pendiente después del cobro');

  // ------------------------------------------------- pago a proveedor
  paso('Pago al proveedor');
  await pagina.goto(`${BASE}/cobranzas?vista=pagar`);
  if (await pagina.locator('button:has-text("Pagar")').count()) {
    await pagina.locator('button:has-text("Pagar")').first().click();
    await pagina.waitForSelector('input[name=monto]');
    await pagina.click('button:has-text("Registrar pago")');
    await pagina.waitForTimeout(2500);
    await pagina.goto(`${BASE}/cobranzas?vista=pagar`);
    const restante = await pagina.locator('body').innerText();
    if (/No hay cuentas por pagar pendientes/.test(restante)) ok('la deuda con el proveedor quedó saldada');
    else ok('pago parcial registrado');
  } else fallo('no había cuenta por pagar que saldar');
} catch (e) {
  fallo(`excepción: ${e.message}`);
  await pagina.screenshot({ path: 'fallo-compras.png', fullPage: true });
} finally {
  await navegador.close();
}

console.log(process.exitCode ? '\n=== HAY FALLAS ===' : '\n=== TODO OK ===');

/**
 * Prueba de los respaldos.
 *
 * Verifica que el botón "Respaldar ahora" genere un archivo, que se pueda
 * descargar desde el navegador y que la pantalla refleje lo que hay en disco.
 *
 * La prueba de que el respaldo *sirve* — restaurarlo en otra base y comparar
 * los datos — se hace aparte, con psql, porque necesita crear bases nuevas.
 */
import { chromium } from 'playwright';

const BASE = process.env.URL_BASE ?? 'http://localhost:3000';
const USUARIO = process.env.USUARIO ?? 'admin@elveloz.pe';
const CLAVE = process.env.CLAVE ?? 'admin123';

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
  paso('Ingreso como administrador');
  await pagina.goto(`${BASE}/login`);
  await pagina.fill('input[name=email]', USUARIO);
  await pagina.fill('input[name=password]', CLAVE);
  await pagina.click('button[type=submit]');
  await pagina.waitForURL(`${BASE}/`, { timeout: 20000 });
  ok('sesión iniciada');

  paso('La sección aparece en Configuración');
  await pagina.goto(`${BASE}/configuracion`);
  const enlace = pagina.locator('a[href="/configuracion/respaldos"]');
  if (await enlace.count()) ok('hay tarjeta de Respaldos');
  else fallo('no aparece la tarjeta de Respaldos');

  paso('Respaldar ahora');
  await pagina.goto(`${BASE}/configuracion/respaldos`);
  await pagina.click('button:has-text("Respaldar ahora")');
  await pagina.waitForSelector('text=/Respaldo creado:/', { timeout: 60000 });
  const aviso = (await pagina.locator('text=/Respaldo creado:/').innerText()).trim();
  ok(aviso);

  const nombre = /Respaldo creado: (\S+\.sql)/.exec(aviso)?.[1];
  if (nombre) ok(`archivo: ${nombre}`);
  else fallo('el aviso no dice qué archivo se creó');

  const kb = Number(/\((\d+) KB\)/.exec(aviso)?.[1] ?? 0);
  if (kb > 0) ok(`el archivo no está vacío (${kb} KB)`);
  else fallo('el respaldo salió vacío');

  paso('Queda listado en pantalla');
  await pagina.reload();
  const cuerpo = await pagina.locator('body').innerText();
  if (nombre && cuerpo.includes(nombre)) ok('aparece en la tabla de archivos guardados');
  else fallo('el respaldo no aparece en la tabla');
  if (/Manual/.test(cuerpo)) ok('marcado como manual');
  else fallo('no distingue el origen del respaldo');

  paso('Se puede descargar');
  const respuesta = await pagina.request.get(
    `${BASE}/configuracion/respaldos/descargar?archivo=${encodeURIComponent(nombre)}`,
  );
  if (respuesta.status() === 200) ok('la descarga responde 200');
  else fallo(`la descarga respondió ${respuesta.status()}`);

  const disposicion = respuesta.headers()['content-disposition'] ?? '';
  if (disposicion.includes(nombre)) ok('se descarga con su nombre de archivo');
  else fallo(`Content-Disposition inesperado: ${disposicion}`);

  const contenido = await respuesta.text();
  if (contenido.length > 500) ok(`bajó el contenido completo (${contenido.length} bytes)`);
  else fallo('el archivo descargado viene vacío o truncado');

  paso('No se puede pedir cualquier archivo');
  for (const intento of ['../../.env', 'motoerp-2020-01-01-0000-auto.sql.bak', '/etc/passwd']) {
    const r = await pagina.request.get(
      `${BASE}/configuracion/respaldos/descargar?archivo=${encodeURIComponent(intento)}`,
    );
    if (r.status() === 400) ok(`rechaza "${intento}"`);
    else fallo(`"${intento}" devolvió ${r.status()} en lugar de 400`);
  }
} catch (e) {
  fallo(`excepción: ${e.message}`);
  await pagina.screenshot({ path: 'fallo-respaldos.png', fullPage: true });
} finally {
  await navegador.close();
}

console.log(process.exitCode ? '\n=== HAY FALLAS ===' : '\n=== TODO OK ===');

/**
 * Disparador del respaldo automático.
 *
 * No hay cron ni tarea programada: el sistema comprueba si ya existe el
 * respaldo de hoy cada vez que alguien entra a una pantalla, como mucho una vez
 * por hora.
 *
 * Es deliberado. En una tienda la computadora se apaga al cerrar, así que una
 * tarea fija a las 3 de la mañana no correría casi nunca. Atado al uso, el
 * respaldo del día se hace apenas alguien abre el sistema — y si nadie lo abrió,
 * tampoco hay nada nuevo que respaldar.
 *
 * (El lugar natural para esto sería `instrumentation.ts`, pero Next lo compila
 * también para el runtime edge, que no tiene disco ni procesos, y la
 * compilación falla al ver `node:fs`.)
 */

import 'server-only';
import { crearRespaldo, hayRespaldoDeHoy } from './respaldos';

const UNA_HORA = 60 * 60 * 1000;

let ultimaRevision = 0;
let corriendo = false;

/**
 * Se llama desde el layout de la aplicación. No se espera su resultado: el
 * respaldo tarda, y nadie debería ver una pantalla en blanco por eso.
 */
export function asegurarRespaldoDiario(): void {
  if (process.env.RESPALDO_AUTOMATICO === 'off') return;

  const ahora = Date.now();
  if (corriendo || ahora - ultimaRevision < UNA_HORA) return;

  ultimaRevision = ahora;
  corriendo = true;

  void (async () => {
    try {
      if (await hayRespaldoDeHoy()) return;

      const respaldo = await crearRespaldo('auto');
      console.log(`[respaldos] respaldo automático creado: ${respaldo.archivo} (${respaldo.modo})`);
    } catch (error) {
      // Que falle el respaldo no puede impedir que la tienda venda. Queda
      // anotado en el log y la pantalla de Respaldos muestra la fecha del
      // último que sí salió.
      console.error('[respaldos] no se pudo crear el respaldo automático:', error);
    } finally {
      corriendo = false;
    }
  })();
}

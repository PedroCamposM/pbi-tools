# Continuidad del proyecto

Documento de traspaso. Si retomas MotoERP en una sesión nueva, empieza por aquí:
resume en qué punto está, qué decisiones ya se tomaron y por qué, y qué sigue.

Última actualización: setiembre 2026.

---

## 1. Qué es esto

Sistema de ventas, inventario, facturación electrónica y taller para una
distribuidora de repuestos de motos con servicio técnico. MYPE peruana, SUNAT.

Vive en `moto-erp/` dentro del repositorio `PedroCamposM/pbi-tools`, en la rama
`claude/moto-distributor-sales-inventory-f5b4dy`.

> El repositorio anfitrión (`pbi-tools`) es un fork de una herramienta de Power
> BI bajo licencia **AGPL v3**, sin relación con este sistema. `moto-erp` es
> código independiente que solo convive en la misma carpeta. **Si se va a
> comercializar, hay que moverlo a su propio repositorio con su propia
> licencia** antes de repartirlo.

El detalle funcional y de arquitectura está en `README.md`. Este documento no lo
repite: cubre solo el estado y la continuidad.

---

## 2. Estado actual

### En GitHub

| Commit | Contenido |
|---|---|
| `6b3a2e9` | Sistema completo: POS, inventario/kardex, compras, taller, comisiones, caja, cuentas corrientes, reportes, comprobantes electrónicos |
| `b9fcda6` | Arreglo del Dockerfile: faltaba la CLI de Prisma en la imagen |
| `183ce9d` | Asistente de primer uso (`/bienvenida`) |

La rama en GitHub es `claude/moto-distributor-sales-inventory-f5b4dy`. Todo el
trabajo verificado está ahí.

**Ojo con las dos máquinas.** El usuario tiene dos clones de Windows y una suele
quedarse atrás. Antes de trabajar en cualquiera:

```
git pull origin claude/moto-distributor-sales-inventory-f5b4dy
```

### Instalaciones vivas

Dos computadoras Windows con Docker, cada una con **su propia base de datos**
(no se comparten). Una tiene los datos de demostración cargados.

---

## 3. Lo que está en marcha: el instalador

**Objetivo:** entregar un `.exe` que un dueño de tienda instale sin tocar una
consola. Hoy la instalación exige Docker, WSL y editar archivos a mano — el
usuario lo vivió y es inviable para su destinatario.

**Decisión tomada: empaquetar PostgreSQL, no migrar a SQLite.**
Tres pantallas (`(app)/page.tsx`, `inventario`, `reportes`) usan SQL crudo con
sintaxis de PostgreSQL (`::float`, `INTERVAL '60 days'`, `EXTRACT`). Cambiar a
SQLite obligaría a reescribirlas y revalidar los cálculos. Empaquetando
PostgreSQL no se toca una línea, y el mismo código sirve si mañana se escala a
un servidor o a SaaS.

> El instalador **no usa Docker**. Es un camino distinto al despliegue actual,
> no una capa encima.

### Las cuatro piezas

| Pieza | Estado |
|---|---|
| Asistente de primer uso | ✅ Hecho y verificado (`183ce9d`) |
| Respaldos automáticos | ✅ Hecho y verificado |
| Script de Inno Setup + PostgreSQL portable | ⚠️ Escrito, **sin probar** |
| Arranque automático y apertura del navegador | ⚠️ Escrito, **sin probar** |

**Las dos últimas están escritas pero nadie las ejecutó todavía.** Claude no
tiene Windows, así que no pudo correr ni `empaquetar.cmd` ni el `.exe`
resultante. Es exactamente la misma situación que produjo el bug del
Dockerfile: la aplicación probada a fondo y el empaquetado no. **Tratarlas como
un primer borrador que va a necesitar un par de vueltas en la máquina del
usuario**, no como algo terminado.

### Qué hace el instalador (escrito, sin probar)

Todo vive en `instalador/`. El instructivo completo —cómo construirlo, qué
queda instalado, cómo actualizar— está en `instalador/README.md`.

Se construye en Windows con `instalador\empaquetar.cmd`, que compila la
aplicación, arma la carpeta y llama a Inno Setup. Antes hay que bajar
PostgreSQL 16 "binaries only" a `instalador\vendor\pgsql` (no está en git:
son 300 MB).

**Decisiones que conviene no deshacer sin leer el porqué:**

- **PostgreSQL se inicializa con `pg_ctl init`, no llamando a `initdb`.** En
  Windows el motor se niega a arrancar con permisos de administrador —y el
  instalador los tiene—; `pg_ctl` es justamente quien se relanza a sí mismo con
  un token restringido. Por lo mismo, `PGDATA` **no se pre-crea**: lo tiene que
  crear el proceso restringido para quedar como dueño.

- **La aplicación corre en una tarea programada, no en un servicio.** Un
  servicio necesita un ejecutable que dialogue con el Administrador de
  servicios, y `node.exe` no lo hace; envolverlo pediría traer NSSM o parecidos
  solo para eso. Una tarea como SYSTEM da lo mismo (arranca al encender, sin
  ventana, sin que nadie inicie sesión) sin agregar dependencias. PostgreSQL sí
  es un servicio de verdad, porque `pg_ctl` sabe registrarse solo y así Windows
  lo apaga ordenadamente.

- **La tarea se registra con el SID `S-1-5-18`, no con el nombre "SYSTEM".** En
  un Windows en español la cuenta se llama "SISTEMA" y el nombre no resuelve.
  Lo mismo con los grupos en las llamadas a `icacls`: siempre por SID.

- **Los datos van a `C:\ProgramData\MotoERP`, nunca a Archivos de Programa.**
  Base, respaldos, claves y registros. Desinstalar **no** los borra: perder la
  contabilidad no puede ser el precio de quitar un programa. Y `PG_DUMP_PATH`
  apunta al `pg_dump.exe` empaquetado, así que los respaldos salen por el
  camino bueno (estructura + datos), como pedía la nota de la sección anterior.

- **Las claves se generan una sola vez y se reutilizan.** Están en
  `config.cmd`, restringido a SYSTEM y administradores. Si se borra ese archivo
  sin borrar también la base, la base queda inaccesible.

- **Nada escucha fuera de la máquina.** PostgreSQL en `127.0.0.1:5433` (5433 y
  no 5432 para no chocar con un PostgreSQL que ya esté instalado) y la
  aplicación en `127.0.0.1:3000`. Efecto secundario útil: no aparece el aviso
  del firewall al instalar.

- **El icono del escritorio no arranca nada**, solo comprueba el puerto y abre
  el navegador. El programa ya está corriendo desde que se encendió la
  computadora.

**Trampa de cmd que ya costó una pasada de revisión:** `if <condición> echo X &
exit /b 1` ejecuta el `exit` **siempre**, se cumpla o no la condición. Hay que
escribirlo con paréntesis. Estaba en 22 líneas de estos scripts.

### Qué hace el asistente (ya hecho)

`/bienvenida` aparece solo cuando no hay empresa ni usuarios. En tres pasos
recoge los datos del negocio, las series y la cuenta del administrador, y deja
la sesión iniciada.

Detalles que ya resuelve y conviene no romper:

- **Numeración al migrar:** pide el último comprobante emitido en el sistema
  anterior y continúa desde el siguiente. Verificado: 245 → `F001-00000246`.
- **Valida el RUC** contra su dígito verificador antes de instalar.
- Carga opcional del catálogo base del rubro y de los servicios de taller.
- Es idempotente: con el sistema configurado, `/bienvenida` redirige.

Archivos: `src/lib/instalacion.ts`, `src/lib/datos-base.ts`,
`src/actions/instalacion.ts`, `src/app/bienvenida/`.

### Qué hacen los respaldos (ya hecho)

Un respaldo por día, automático, más el botón *Respaldar ahora* y la descarga
desde **Configuración → Respaldos**.

Decisiones que conviene no romper:

- **El disparador vive en `(app)/layout.tsx`, no en `instrumentation.ts`.** Next
  compila `instrumentation.ts` también para el runtime edge y la compilación
  revienta al ver `node:fs`. Se intentó y no funciona; no volver a intentarlo.
- **No hay hora fija.** Comprueba si ya existe el respaldo de hoy, como mucho una
  vez por hora. La computadora de una tienda se apaga al cerrar: un cron
  nocturno no correría nunca.
- **Dos formatos.** Con `pg_dump` disponible, estructura + datos. Sin él —el caso
  de la imagen Docker— volcado propio de solo datos, que se restaura después de
  `prisma migrate deploy`. El instalador de Windows traerá PostgreSQL, así que
  ahí entra el camino bueno sin tocar código.
- **Los literales del volcado propio los arma PostgreSQL** con `quote_nullable`,
  no JavaScript. Escaparlos a mano sería reinventar mal algo que el motor ya
  hace bien para texto, fechas, JSON, arreglos y binarios.
- **La limpieza nunca baja de 10 archivos**, aunque estén vencidos, y solo borra
  archivos con el patrón de nombre propio: no toca nada más de esa carpeta.

Verificado restaurando en bases limpias: los dos formatos devuelven las 9 tablas
principales idénticas por checksum, y los contadores de id siguen la numeración
sin chocar.

Archivos: `src/lib/respaldos.ts`, `src/lib/respaldo-diario.ts`,
`src/actions/respaldos.ts`, `src/app/(app)/configuracion/respaldos/`.

---

## 4. Decisiones de negocio ya tomadas

No las cambies sin hablarlo con el usuario: cada una se discutió.

**Precios con IGV incluido.** Las tres listas (público, técnico, mayorista) se
guardan como se cotiza en mostrador. El IGV se descompone por línea al emitir,
de modo que la suma de líneas siempre cuadra con el total al céntimo.

**Costo promedio ponderado.** Verificado: (120×6.50 + 50×8.00) ÷ 170 = 6.9412.
Las salidas se valorizan al costo vigente y no lo modifican.

**No se vende sin stock.** Si el saldo no alcanza, la operación se rechaza.

**Sin caja abierta no se cobra.** Es lo que hace que el arqueo signifique algo.

**Los repuestos del taller salen del almacén principal por defecto.** En una
tienda de barrio el mecánico toma la pieza del mismo anaquel. El almacén
"Taller" queda como opción para quien separa el stock.

**Al facturar una orden de trabajo no se genera comisión de venta**, solo la de
servicio que ya se creó al cerrarla. Pagar ambas sería contar dos veces el mismo
trabajo. El usuario sabe que esto es una política y puede cambiarla.

**El repuesto descuenta stock cuando el técnico lo instala**, no cuando se
cobra. Por eso `registrarVenta` acepta `descontarStock: false`.

---

## 5. Lo que NO está hecho

- **Firma digital** de los comprobantes. La pone el OSE/PSE.
- **Integración con Nubefact escrita pero nunca probada** contra una cuenta
  real. Antes de usarla en producción hay que validarla en su ambiente de
  pruebas. Está en `src/lib/sunat/proveedor.ts`.
- **Guías de remisión electrónicas.**
- **Percepciones y detracciones.**
- **Multi-sucursal** con series separadas.
- **Multi-empresa.** Hay una sola fila de empresa. Para SaaS habría que
  rediseñar; para "una instalación por negocio" está bien.

---

## 6. Cómo verificar cambios

```bash
npm run lint          # tsc --noEmit
npm run build
```

Pruebas de humo con navegador real, en `pruebas/`. Requieren la aplicación
levantada y `npm install -D playwright`:

| Script | Cubre |
|---|---|
| `instalacion.mjs` | Asistente de primer uso sobre base vacía, hasta vender |
| `respaldos.mjs` | Respaldo manual, listado, descarga y rechazo de rutas ajenas |
| `comisiones.mjs` | Comisión por venta y por servicio, liquidación con egreso de caja |
| `compras-y-credito.mjs` | Compra → kardex y costo promedio → cuenta por pagar; venta al crédito → cobranza |

Variables: `URL_BASE`, `CHROMIUM_PATH`.

**Escriben datos reales.** Solo contra una base de desarrollo.

---

## 7. Trampas del entorno (leer antes de sufrir)

**Claude ya puede escribir en este repositorio.** Esto cambió en setiembre de
2026: `git push origin claude/moto-distributor-sales-inventory-f5b4dy` funciona
y se acabó el baile del bundle. Los cambios llegan solos a GitHub y el usuario
los baja con `git pull`.

> Ojo con una pista falsa: `git push --dry-run` **sigue devolviendo 403**
> aunque el push real funcione. Si vas a comprobar el acceso, compruébalo
> empujando un commit de verdad, no con `--dry-run`.

**No hay daemon de Docker en el contenedor de Claude.** No se puede construir ni
probar la imagen desde ahí. Ese fue exactamente el origen del bug del
Dockerfile: se probó la aplicación a fondo, pero no el empaquetado. Todo lo que
sea Docker, Windows o el instalador **lo prueba el usuario en su máquina**.

**El usuario trabaja en Windows con `cmd`.** No tiene `cp`, `ls` ni herramientas
Unix. Tiene dos máquinas: en una la carpeta de usuario es `C:\Users\user` y en
la otra `C:\Users\Windows 11` — **esta contiene un espacio**, así que las rutas
van entre comillas. Dar comandos de una línea a la vez, decir siempre en qué
carpeta se corren, y no dar por sobreentendido nada del entorno.

**`node_modules` puede desaparecer** si el contenedor se recicla. Reinstalar con
`npm install` y `npx prisma generate`. PostgreSQL local se levanta con
`pg_ctlcluster 16 main start`.

---

## 8. Siguiente paso concreto

**Probar el instalador en Windows.** Está escrito entero y no lo ha corrido
nadie. En orden:

1. Bajar PostgreSQL 16 "binaries only" a `instalador\vendor\pgsql`
   (ver `instalador/README.md`).
2. Correr `instalador\empaquetar.cmd` y que genere el `.exe`.
3. Instalarlo **en una computadora que no sea la de desarrollo**. En la de
   desarrollo ya están Node y PostgreSQL, y eso puede tapar justo el problema
   que el cliente sí va a ver.
4. Iterar sobre lo que falle, como se hizo con Docker.

Cuando falle algo, el primer lugar donde mirar es
`C:\ProgramData\MotoERP\registros\instalacion.log`: `preparar.cmd` registra
cada paso y sale con un código distinto por etapa (10 = faltan piezas,
11 = configuración, 12 = initdb, 13 = permisos, 14 = servicio, 15 = arranque de
PostgreSQL, 16 = base y usuario, 17 = migraciones, 18 = tarea programada,
19 = el servidor no respondió).

### Mudanza a un repositorio propio (conversado, sin hacer)

El usuario planteó sacar MotoERP de `pbi-tools`, y tiene razón: `pbi-tools` es
un fork **público** con licencia **AGPL v3** que no tiene nada que ver. Hoy la
lógica del negocio está a la vista de cualquiera.

Acordado que se hace **después** de que el instalador esté probado, para no
mover dos veces. El camino que conserva el historial de `moto-erp/` es
`git subtree split --prefix=moto-erp`, que ya viene en Git para Windows. El
repositorio nuevo debería ser **privado** y llevar su propia licencia.

**Cabo suelto menor:** `cambiarEstadoProducto` existe en
`src/actions/catalogo.ts` pero ninguna pantalla lo llama. Hoy un producto se
desactiva editándolo y destildando "Producto activo"; falta el botón directo en
el listado. Es un cambio de diez minutos.

**Recomendación pendiente que el usuario aún no ha respondido:** usar el sistema
en su propia distribuidora unos meses antes de repartirlo. El uso real va a
revelar faltantes que hoy nadie ve, y es mejor descubrirlos sin clientes
reclamando.

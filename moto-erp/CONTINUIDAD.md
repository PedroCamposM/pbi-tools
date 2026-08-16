# Continuidad del proyecto

Documento de traspaso. Si retomas MotoERP en una sesión nueva, empieza por aquí:
resume en qué punto está, qué decisiones ya se tomaron y por qué, y qué sigue.

Última actualización: agosto 2026.

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
| Respaldos automáticos | ⏳ Sin empezar |
| Script de Inno Setup + PostgreSQL portable | ⏳ Sin empezar |
| Arranque automático y apertura del navegador | ⏳ Sin empezar |

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
| `comisiones.mjs` | Comisión por venta y por servicio, liquidación con egreso de caja |
| `compras-y-credito.mjs` | Compra → kardex y costo promedio → cuenta por pagar; venta al crédito → cobranza |

Variables: `URL_BASE`, `CHROMIUM_PATH`.

**Escriben datos reales.** Solo contra una base de desarrollo.

---

## 7. Trampas del entorno (leer antes de sufrir)

**Claude no puede escribir en este repositorio.** Ni `git push` (403) ni las
herramientas MCP de GitHub (`create_or_update_file` → "Resource not accessible
by integration"). Se probó en dos sesiones distintas. Única vía que funciona:
entregar el trabajo como bundle de git (`git bundle create ... --not
<commit-base>`) y que el usuario lo aplique con `git fetch <bundle> <rama>` +
`git merge FETCH_HEAD` + `git push`. Avísale de esto al empezar, para que no
espere que los cambios aparezcan solos en GitHub.

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

1. Respaldos automáticos: volcado diario a una carpeta + botón "Respaldar ahora"
   en Configuración. Sin esto, entregar el instalador es irresponsable.
2. Scripts del instalador: Inno Setup, PostgreSQL portable, servicio de Windows,
   apertura del navegador en `localhost:3000`.
3. Probar el instalador en la máquina del usuario, iterando como se hizo con
   Docker.

**Cabo suelto menor:** `cambiarEstadoProducto` existe en
`src/actions/catalogo.ts` pero ninguna pantalla lo llama. Hoy un producto se
desactiva editándolo y destildando "Producto activo"; falta el botón directo en
el listado. Es un cambio de diez minutos.

**Recomendación pendiente que el usuario aún no ha respondido:** usar el sistema
en su propia distribuidora unos meses antes de repartirlo. El uso real va a
revelar faltantes que hoy nadie ve, y es mejor descubrirlos sin clientes
reclamando.

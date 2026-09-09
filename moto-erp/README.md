# MotoERP

Sistema de gestión para una distribuidora de repuestos de motos que además
presta servicio técnico. Pensado para una MYPE peruana: mostrador, almacén,
taller, caja y SUNAT en un solo lugar.

---

## Qué resuelve

**En el mostrador.** El cliente llega y dice "necesito el embrague de una
Pulsar 180" o trae un código impreso en la caja vieja. El buscador del punto de
venta responde a las cuatro formas de preguntar: código propio, nombre, **código
equivalente** (OEM, del proveedor o de barras) y **modelo de moto compatible**.
Muestra el precio, el stock y en qué anaquel está.

**Con los técnicos.** Los mecánicos son el canal que mueve el producto. El
sistema los trata como lo que son:

- compran con **precio de técnico** y línea de crédito propia;
- **derivan ventas** al mostrador y ganan un porcentaje sobre el valor de venta;
- **ejecutan servicios** en el taller y ganan un porcentaje sobre la mano de obra;
- se les **liquida** por período, y el pago sale de la caja del día.

**En el taller.** Cada moto que entra abre una orden de trabajo con placa,
kilometraje y motivo. Los repuestos que instala el mecánico **descuentan stock
en ese momento**, no cuando se cobra. Al terminar, la orden se convierte en
comprobante con un clic, sin volver a descontar el inventario ni pagar dos veces
la comisión.

**En la caja.** Apertura, cobros por efectivo/Yape/Plin/tarjeta/transferencia,
gastos, y cierre con arqueo que dice cuánto debería haber y cuánto falta o sobra.

**Ante SUNAT.** Boletas, facturas y notas de crédito con series y correlativos
propios, XML UBL 2.1 completo y monto en letras. El envío al fisco pasa por una
capa de proveedor intercambiable (ver [Facturación electrónica](#facturación-electrónica)).

---

## Puesta en marcha

### Opción A — Docker (recomendada para el negocio)

```bash
cp .env.example .env
# Genera un secreto y ponlo en SESSION_SECRET:
openssl rand -base64 48

docker compose up -d --build

# Carga los datos iniciales (una sola vez)
docker compose exec aplicacion npx tsx prisma/seed.ts
```

La aplicación queda en `http://localhost:3000`.

### Opción B — Desarrollo local

Necesitas Node.js 22+ y PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # ajusta DATABASE_URL y SESSION_SECRET
npm run db:migrate            # crea las tablas
npm run db:seed               # datos iniciales
npm run dev                   # http://localhost:3000
```

### Usuarios que crea el seed

| Correo | Contraseña | Rol |
|---|---|---|
| `admin@elveloz.pe` | `admin123` | Administrador |
| `ventas@elveloz.pe` | `ventas123` | Vendedor |
| `almacen@elveloz.pe` | `almacen123` | Almacenero |
| `caja@elveloz.pe` | `caja123` | Cajero |

> **Cámbialas antes de usar el sistema con datos reales**, desde
> Configuración → Usuarios.

El seed también carga 34 productos del rubro (embragues, carburadores,
alternadores, CDI, bujías, baterías, pastillas y zapatas, aceites, líquido de
frenos, llantas y servicios de taller) con códigos OEM, compatibilidades por
modelo de moto, stock valorizado, proveedores, clientes y tres técnicos.

---

## Primeros pasos con tus propios datos

1. **Configuración → Datos de la empresa**: RUC, razón social, dirección fiscal
   y ubigeo. Esto sale impreso en cada comprobante y viaja a SUNAT.
2. **Configuración → Series**: registra tus series reales (F001, B001…). Si
   vienes de otro sistema, escribe el **último correlativo emitido**; el sistema
   sigue desde el siguiente.
3. **Configuración → Almacenes**: por defecto vienen *Tienda principal* y
   *Taller*. Si tu negocio no separa el stock, desactiva el almacén Taller y
   trabaja solo con la tienda.
4. **Configuración → Usuarios**: crea las cuentas de tu gente y borra las de
   ejemplo.
5. **Productos**: carga tu catálogo. Al crear cada producto puedes ingresar el
   stock y el costo inicial de una vez.
6. **Técnicos**: registra a tus mecánicos con sus porcentajes de comisión.

---

## Cómo trabaja el sistema por dentro

### Inventario: costo promedio ponderado

Todo movimiento pasa por el kardex (`movimiento_inventario`) y actualiza el
saldo del almacén en la misma transacción de base de datos. El costo se calcula
por **promedio ponderado**:

```
Antes:   120 bujías a S/ 6.50   =  S/ 780.00
Compra:   50 bujías a S/ 8.00   =  S/ 400.00
                                    ─────────
Después: 170 bujías             =  S/ 1 180.00  →  S/ 6.9412 c/u
```

Las salidas se valorizan al costo vigente y no lo modifican. Por eso cada venta
sabe exactamente cuánto costó lo que vendió, y la utilidad de un comprobante o
de una línea de producto es real, no estimada.

El sistema **no permite vender lo que no hay**: si el saldo no alcanza, la
operación se rechaza con el disponible y lo solicitado. Los ajustes por conteo
físico se registran aparte, con motivo y responsable.

### Precios

Los precios de venta se guardan **con IGV incluido**, que es como se cotiza en
mostrador. Hay tres listas: público, técnico y mayorista; el punto de venta
aplica la que corresponda según el tipo de cliente.

El IGV se descompone por línea al emitir: `valor de venta = total ÷ 1.18`, y el
IGV es la diferencia exacta, de modo que la suma de las líneas siempre cuadra
con el total del comprobante al céntimo.

### Taller y comisiones

```
Recepción de la moto
      ↓
Diagnóstico  →  se cargan repuestos (descuentan stock al instante)
      ↓          y mano de obra (con el técnico que la ejecuta)
Terminada    →  se genera la comisión de SERVICIO sobre la mano de obra
      ↓
Facturada    →  comprobante electrónico, sin volver a tocar el stock
```

La comisión de **venta** se genera cuando un técnico deriva una venta de
mostrador. La de **servicio**, cuando se cierra una orden de trabajo. Al
facturar una orden **no** se genera comisión de venta: pagarla sería contar dos
veces el mismo trabajo.

### Caja

Todo cobro y todo pago genera un movimiento de caja: ventas, cobranzas, pagos a
proveedores, gastos, liquidación de comisiones y devoluciones por anulación. El
cierre compara el efectivo contado con el esperado y guarda la diferencia. Los
cobros con Yape, tarjeta o transferencia se informan por separado porque no
están físicamente en el cajón.

Sin caja abierta no se puede cobrar. Es a propósito: es lo que hace que el
arqueo del día signifique algo.

### Anulaciones

- **Nota de venta** (documento interno): se anula y el stock vuelve al almacén.
- **Boleta o factura**: se emite automáticamente una **nota de crédito** que la
  deja sin efecto, el stock vuelve, la cuenta por cobrar se cancela, las
  comisiones pendientes se anulan y, si hubo cobro, se registra el egreso en la
  caja abierta.

---

## Facturación electrónica

El sistema arma el comprobante completo y genera su **XML UBL 2.1** con todo lo
que exige SUNAT: catálogos 01/03/06/07/09/10, tipo de operación, leyenda del
monto en letras, tributos por línea y bloque de referencia para las notas.

El envío está detrás de una interfaz (`src/lib/sunat/proveedor.ts`) con dos
implementaciones:

| `PROVEEDOR_FE` | Comportamiento |
|---|---|
| `mock` (por defecto) | Genera el XML real y simula la aceptación. Permite operar el negocio mientras se tramita el certificado digital. |
| `nubefact` | Envía el comprobante a la API de Nubefact con `NUBEFACT_URL` y `NUBEFACT_TOKEN`. |

**Para pasar a producción** basta con contratar un OSE/PSE, poner sus
credenciales en el `.env` y cambiar `PROVEEDOR_FE`. No hay que rehacer ventas ni
migrar datos: los comprobantes ya guardan todo lo que la norma pide, y el XML
que se generó en modo simulación es el mismo que se enviará.

Si quieres otro proveedor (Efact, Bizlinks, SUNAT directo), implementa la
interfaz `ProveedorFacturacion` —dos métodos, `enviar` y `anular`— y regístralo
en `obtenerProveedorFe()`. Nada más del sistema cambia.

> **Lo que falta para emitir de verdad:** la firma digital con el certificado de
> la empresa. El XML deja el bloque `ext:ExtensionContent` preparado para
> recibirla. Los OSE/PSE firman por ti; si vas directo contra SUNAT tendrás que
> firmar antes de enviar.

Cada comprobante guarda su XML, el estado ante SUNAT y la respuesta recibida. Se
descarga desde la ficha de la venta y se puede reenviar si el envío falló.

---

## Estructura del proyecto

```
prisma/
  schema.prisma          Modelo de datos completo, comentado
  seed.ts                Datos iniciales del rubro
src/
  actions/               Server actions: todo lo que escribe en la base
    ventas.ts              punto de venta, anulación, notas de crédito
    compras.ts             ingreso de mercadería
    taller.ts              órdenes de trabajo y su facturación
    caja.ts                apertura, movimientos y arqueo
    cobranzas.ts           cuentas por cobrar y por pagar
    comisiones.ts          liquidación a técnicos
    catalogo.ts            productos, equivalencias, ajustes de stock
    terceros.ts            clientes, proveedores, técnicos, usuarios
  lib/
    inventario.ts          kardex valorizado (el corazón del costeo)
    comprobantes.ts        arma el CPE desde una venta
    correlativos.ts        series y numeración atómica
    money.ts               aritmética decimal, sin errores de coma flotante
    sunat/                 catálogos, XML UBL 2.1, monto en letras, proveedor
  app/                   Pantallas (Next.js App Router)
  components/            Piezas de interfaz compartidas
pruebas/                 Pruebas de humo de los circuitos críticos
```

---

## Comandos

| Comando | Para qué |
|---|---|
| `npm run dev` | Desarrollo con recarga en caliente |
| `npm run build` | Compila para producción |
| `npm start` | Levanta la versión compilada |
| `npm run lint` | Revisa los tipos (`tsc --noEmit`) |
| `npm run db:migrate` | Crea o actualiza las tablas |
| `npm run db:deploy` | Aplica migraciones en producción |
| `npm run db:seed` | Carga los datos iniciales |

---

## Respaldos

**Son automáticos.** El sistema hace un respaldo por día sin que nadie tenga que
acordarse, y los deja en la carpeta `respaldos/`. Se administran desde
**Configuración → Respaldos**, donde además está el botón *Respaldar ahora* y la
descarga de cada archivo.

No hay tarea programada a una hora fija: el sistema comprueba si ya existe el
respaldo del día cada vez que alguien abre una pantalla, como mucho una vez por
hora. En una tienda la computadora se apaga al cerrar, así que un cron a las 3 de
la mañana no correría casi nunca; atado al uso, el respaldo se hace apenas
alguien enciende el equipo.

Se conservan 30 días y nunca se borran los últimos 10, aunque sean más viejos.

| Variable | Para qué |
|---|---|
| `RESPALDOS_DIR` | Carpeta donde se guardan. Por defecto `respaldos/` |
| `RESPALDOS_DIAS` | Días de retención. Por defecto 30 |
| `PG_DUMP_PATH` | Ruta a `pg_dump` si no está en el PATH |
| `RESPALDO_AUTOMATICO` | `off` desactiva el respaldo diario |

### Dos formatos según el equipo

Si `pg_dump` está disponible, el respaldo incluye **estructura y datos**: se
restaura solo, sobre una base vacía. Si no lo está —como en la imagen Docker de
la aplicación, que no trae las herramientas de PostgreSQL— el sistema genera un
volcado **solo de datos**, y hay que crear la estructura antes de cargarlo. La
pantalla de Respaldos avisa cuál de los dos estás obteniendo.

### Restaurar

Restaurar reemplaza toda la información actual por la del respaldo. Desde la
carpeta `moto-erp`:

```bash
# Respaldo completo (con estructura)
docker compose exec -T base-de-datos psql -U motoerp -d motoerp < respaldos/ARCHIVO.sql

# Respaldo de solo datos: primero la estructura
docker compose exec aplicacion node node_modules/prisma/build/index.js migrate deploy
docker compose exec -T base-de-datos psql -U motoerp -d motoerp < respaldos/ARCHIVO.sql
```

**Bájate una copia a un USB o a la nube de vez en cuando.** Un respaldo guardado
en el mismo disco que la base no sirve el día en que ese disco falla.

---

## Lo que todavía no hace

Es honesto decirlo por adelantado:

- **Firma digital propia.** Depende del OSE/PSE (ver arriba).
- **Guías de remisión electrónicas** (GRE). El modelo tiene el tipo de documento
  previsto, pero no hay pantalla ni envío.
- **Percepciones y detracciones.** No aplican al giro típico de repuestos al
  público, pero si vendes a empresas designadas como agentes, habría que
  agregarlas.
- **Multi-sucursal real.** Hay varios almacenes, pero no separación de series ni
  reportes por sucursal.
- **App móvil.** La interfaz es responsive y se usa bien desde el celular, pero
  no hay aplicación nativa ni lector de código de barras por cámara.

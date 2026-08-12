# Pruebas de humo

Scripts que manejan la aplicación como lo haría una persona (navegador real) y
verifican los circuitos que no pueden fallar en producción.

## Qué cubren

| Script | Circuito |
|---|---|
| `comisiones.mjs` | Venta derivada por un técnico → comisión por venta · orden de trabajo ejecutada → comisión por mano de obra · liquidación con egreso de caja |
| `compras-y-credito.mjs` | Compra al crédito → ingreso valorizado al kardex, recálculo del costo promedio y actualización de precios · cuenta por pagar · venta al crédito → cuenta por cobrar → cobranza · pago al proveedor |

## Cómo correrlas

Requieren la base sembrada (`npm run db:seed`) y la aplicación levantada.

```bash
# 1. Instalar el navegador de pruebas (no viene en las dependencias del sistema)
npm install -D playwright
npx playwright install chromium

# 2. Levantar la aplicación en otra terminal
npm run build && npm start

# 3. Correr las pruebas
node pruebas/comisiones.mjs
node pruebas/compras-y-credito.mjs
```

Variables opcionales:

- `URL_BASE` — dirección de la aplicación (por defecto `http://localhost:3000`).
- `CHROMIUM_PATH` — ruta a un Chromium ya instalado, si no quieres descargarlo.

## Advertencia

Las pruebas **escriben datos reales**: emiten comprobantes, mueven stock y
registran movimientos de caja. Córrelas solo contra una base de desarrollo,
nunca contra la base del negocio.

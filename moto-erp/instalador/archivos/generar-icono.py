"""
Genera `motoerp.ico` a partir de nada: no hace falta ninguna biblioteca.

El icono es un cuadrado redondeado del azul de la marca (#1f44eb, `marca-600`
de Tailwind) con una "M" blanca. Se dibuja a 768x768 y se reduce por promedio a
cada tamaño, que es lo que le da los bordes suaves.

Solo hay que volver a correrlo si se cambia el diseño:

    python instalador/archivos/generar-icono.py

Sale en `instalador/archivos/motoerp.ico`.
"""

import math
import os
import struct
import zlib

MAESTRO = 768
FONDO = (0x1F, 0x44, 0xEB)  # marca-600
TRAZO = (0xFF, 0xFF, 0xFF)
TAMANOS = [256, 128, 64, 48, 32, 16]


def distancia_a_segmento(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    largo = vx * vx + vy * vy
    if largo == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / largo))
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy))


def dibujar_maestro():
    """Devuelve una imagen RGBA de MAESTRO x MAESTRO como lista de filas."""
    n = MAESTRO
    radio_esquina = n * 0.22
    borde = n * 0.06  # margen transparente alrededor del cuadrado

    # La "M": dos verticales y dos diagonales que se juntan en el centro.
    izq, der = n * 0.30, n * 0.70
    arriba, abajo = n * 0.31, n * 0.69
    medio_x, medio_y = n * 0.50, n * 0.55
    grosor = n * 0.075
    trazos = [
        (izq, abajo, izq, arriba),
        (izq, arriba, medio_x, medio_y),
        (medio_x, medio_y, der, arriba),
        (der, arriba, der, abajo),
    ]

    filas = []
    for y in range(n):
        fila = bytearray()
        py = y + 0.5
        for x in range(n):
            px = x + 0.5

            # Cuadrado redondeado: distancia al rectángulo interior.
            rx = min(max(px, borde + radio_esquina), n - borde - radio_esquina)
            ry = min(max(py, borde + radio_esquina), n - borde - radio_esquina)
            dentro = math.hypot(px - rx, py - ry) <= radio_esquina

            if not dentro:
                fila += b'\x00\x00\x00\x00'
                continue

            en_letra = any(
                distancia_a_segmento(px, py, *t) <= grosor / 2 for t in trazos
            )
            color = TRAZO if en_letra else FONDO
            fila += bytes((color[0], color[1], color[2], 0xFF))
        filas.append(bytes(fila))
    return filas


def reducir(filas, destino):
    """Promedia bloques cuadrados para bajar de MAESTRO a `destino`."""
    factor = MAESTRO // destino
    salida = []
    for y in range(destino):
        fila = bytearray()
        for x in range(destino):
            r = g = b = a = 0
            for dy in range(factor):
                origen = filas[y * factor + dy]
                base = (x * factor) * 4
                for dx in range(factor):
                    i = base + dx * 4
                    alfa = origen[i + 3]
                    r += origen[i] * alfa
                    g += origen[i + 1] * alfa
                    b += origen[i + 2] * alfa
                    a += alfa
            if a == 0:
                fila += b'\x00\x00\x00\x00'
            else:
                fila += bytes((r // a, g // a, b // a, a // (factor * factor)))
        salida.append(bytes(fila))
    return salida


def como_png(filas, lado):
    cruda = b''.join(b'\x00' + f for f in filas)

    def trozo(tipo, datos):
        return (
            struct.pack('>I', len(datos))
            + tipo
            + datos
            + struct.pack('>I', zlib.crc32(tipo + datos) & 0xFFFFFFFF)
        )

    return (
        b'\x89PNG\r\n\x1a\n'
        + trozo(b'IHDR', struct.pack('>IIBBBBB', lado, lado, 8, 6, 0, 0, 0))
        + trozo(b'IDAT', zlib.compress(cruda, 9))
        + trozo(b'IEND', b'')
    )


def como_bmp(filas, lado):
    """DIB de 32 bits, de abajo hacia arriba y en orden BGRA, como pide el ICO."""
    pixeles = bytearray()
    for fila in reversed(filas):
        for x in range(lado):
            i = x * 4
            pixeles += bytes((fila[i + 2], fila[i + 1], fila[i], fila[i + 3]))

    # Máscara AND: obligatoria aunque el alfa ya diga todo. Filas alineadas a 4.
    bytes_por_fila = ((lado + 31) // 32) * 4
    mascara = b'\x00' * (bytes_por_fila * lado)

    cabecera = struct.pack(
        '<IiiHHIIiiII', 40, lado, lado * 2, 1, 32, 0, len(pixeles), 0, 0, 0, 0
    )
    return cabecera + bytes(pixeles) + mascara


def main():
    maestro = dibujar_maestro()
    imagenes = []
    for lado in TAMANOS:
        filas = reducir(maestro, lado)
        # PNG solo en el tamaño grande, donde el ahorro vale la pena; en los
        # chicos, BMP, que lo entiende cualquier versión de Windows.
        datos = como_png(filas, lado) if lado >= 256 else como_bmp(filas, lado)
        imagenes.append((lado, datos))

    cabecera = struct.pack('<HHH', 0, 1, len(imagenes))
    desplazamiento = 6 + 16 * len(imagenes)
    entradas, cuerpo = b'', b''
    for lado, datos in imagenes:
        entradas += struct.pack(
            '<BBBBHHII',
            0 if lado >= 256 else lado,
            0 if lado >= 256 else lado,
            0,
            0,
            1,
            32,
            len(datos),
            desplazamiento,
        )
        cuerpo += datos
        desplazamiento += len(datos)

    destino = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'motoerp.ico')
    with open(destino, 'wb') as f:
        f.write(cabecera + entradas + cuerpo)
    print(f'{destino}  ({len(cabecera + entradas + cuerpo)} bytes)')


if __name__ == '__main__':
    main()

# Instalador de MotoERP para Windows

Genera un `.exe` que instala MotoERP completo —base de datos incluida— en una
computadora con Windows, sin Docker, sin WSL y sin que nadie abra una consola.
Quien lo recibe hace doble clic, dice "Siguiente" tres veces y termina con el
navegador abierto en el asistente de primer uso.

> Este es el camino del instalador. El despliegue con Docker que está en el
> `README.md` del proyecto sigue existiendo y es independiente: no se apoya uno
> en el otro.

---

## Qué se instala en la máquina del cliente

| Dónde | Qué |
|---|---|
| `C:\Program Files\MotoERP\app` | La aplicación ya compilada |
| `C:\Program Files\MotoERP\node` | `node.exe` — no hace falta instalar Node |
| `C:\Program Files\MotoERP\pgsql` | PostgreSQL 16 portable |
| `C:\Program Files\MotoERP\scripts` | Los `.cmd` que hacen que arranque solo |
| `C:\ProgramData\MotoERP\datos` | **La base de datos** |
| `C:\ProgramData\MotoERP\respaldos` | **Los respaldos diarios** |
| `C:\ProgramData\MotoERP\config.cmd` | **Las claves generadas al instalar** |
| `C:\ProgramData\MotoERP\registros` | Los registros, para cuando algo falle |

Lo de `ProgramData` está fuera de Archivos de Programa a propósito: **una
desinstalación no borra la información del negocio**. Si se reinstala, el
sistema se reencuentra con sus datos tal como estaban.

Y se registran dos cosas en Windows:

- El servicio **`MotoERP-Postgres`**, que arranca la base al encender y —esto
  es lo que aporta ser un servicio de verdad— la apaga ordenadamente.
- La tarea programada **`MotoERP servidor`**, que levanta la aplicación en cada
  arranque, como SYSTEM: sin ventana y sin que nadie inicie sesión.

Nada escucha fuera de la computadora: PostgreSQL en `127.0.0.1:5433` y la
aplicación en `127.0.0.1:3000`. Por eso tampoco aparece el aviso del firewall
de Windows al instalar.

---

## Construir el instalador

### Una sola vez: las tres herramientas

**1. Node.js 22 LTS** — <https://nodejs.org>. Probablemente ya lo tienes.

**2. Inno Setup 6.3 o superior** — <https://jrsoftware.org/isdl.php>.
Instalación normal, siguiente-siguiente.

**3. PostgreSQL 16 portable.** Este es el único paso que tiene truco: hace
falta la versión **"binaries only"**, no el instalador con asistente.

Está en <https://www.enterprisedb.com/download-postgresql-binaries>. Se busca la
fila de **PostgreSQL 16**, columna **Win x86-64**. Baja un `.zip` que adentro
trae una carpeta `pgsql`. Esa carpeta va copiada a `instalador\vendor\pgsql`,
de modo que exista:

```
instalador\vendor\pgsql\bin\postgres.exe
```

`vendor\` no está en git a propósito: son 300 MB que no tienen por qué vivir en
el repositorio.

### Cada vez

Desde la carpeta del proyecto:

```
instalador\empaquetar.cmd
```

Compila la aplicación, arma la carpeta a empaquetar, comprueba que estén las
piezas que suelen faltar y llama a Inno Setup. El resultado sale en
`instalador\salida\MotoERP-1.0.0-instalador.exe`, alrededor de 150 MB.

Tarda unos minutos la primera vez.

### Se construye en Windows, no en otro sistema

Prisma trae motores compilados para cada sistema operativo, y los que se
empaquetan son los que quedan en `node_modules` al instalar las dependencias.
Armado desde Linux o Mac, el instalador se genera **igual de bien** y falla al
abrir la primera pantalla en la máquina del cliente.

`empaquetar.cmd` lo comprueba antes de empaquetar y se detiene si no encuentra
el motor de Windows, para que el error salte aquí y no en la tienda del cliente.

---

## Instalarlo en la máquina del cliente

Se le pasa un archivo, el `.exe`, y nada más.

1. Doble clic.
2. **Windows va a mostrar una pantalla azul que dice "Windows protegió su PC".**
   Es porque el instalador no está firmado digitalmente, no porque haya algo
   malo. Se hace clic en **"Más información"** y después en **"Ejecutar de todas
   formas"**. Conviene avisarlo antes, porque asusta.
3. Aceptar el aviso de permisos de administrador.
4. Siguiente, Instalar, y esperar. Al final se queda un rato en "Preparando la
   base de datos": está inicializando PostgreSQL, que es lo más lento.
5. Termina con la casilla **"Abrir MotoERP ahora"** marcada. Se abre el
   navegador en el asistente de primer uso, que pide los datos del negocio.

Desde ahí en adelante, MotoERP arranca solo con la computadora. El icono del
escritorio no lo arranca: solo abre el navegador en `http://localhost:3000`.

### Si algo sale mal

**Menú Inicio → "Reparar MotoERP"** → clic derecho → **Ejecutar como
administrador**. Vuelve a correr toda la preparación. Es seguro: no toca una
base de datos que ya existe, así que no se pierde nada.

Si tampoco, el detalle está en `C:\ProgramData\MotoERP\registros\`:

| Archivo | Qué cuenta |
|---|---|
| `instalacion.log` | Todo lo que hizo la preparación, paso por paso |
| `servidor.log` | Cada arranque de la aplicación y cada caída |
| `postgres.log` | La base de datos |

---

## Actualizar a una versión nueva

Se construye el instalador nuevo y se ejecuta encima. Detiene el servidor antes
de copiar (si no, Windows no deja reemplazar `node.exe`), reemplaza el programa,
reutiliza las claves que ya existían y aplica las migraciones de base que hagan
falta. **Los datos no se tocan.**

Conviene subir el número de versión en `motoerp.iss` (`#define Version`) para
poder distinguirlas en "Agregar o quitar programas".

---

## Cambiar la configuración de una instalación

Todo vive en `C:\ProgramData\MotoERP\config.cmd`, que es un archivo de texto con
una línea `set` por variable. Para cambiar algo:

1. Abrir el Bloc de notas **como administrador** (menú Inicio, escribir "Bloc de
   notas", clic derecho, *Ejecutar como administrador*). El archivo está
   restringido a propósito: contiene la clave de la base de datos.
2. Abrir desde ahí `C:\ProgramData\MotoERP\config.cmd` y editar la línea.
3. Reiniciar la computadora, que es la forma más simple de que el servidor
   vuelva a leerlo.

Lo que se suele querer tocar:

| Variable | Para qué |
|---|---|
| `PROVEEDOR_FE` | `mock` o `nubefact` |
| `NUBEFACT_URL`, `NUBEFACT_TOKEN` | Credenciales del proveedor |
| `RESPALDOS_DIAS` | Días que se conservan los respaldos |
| `SESSION_HORAS` | Cuánto dura la sesión de un usuario |

### Que lo vean otras computadoras de la tienda

Por defecto solo responde en la propia máquina. Para abrirlo a la red local hay
que editar `HOSTNAME=127.0.0.1` en `scripts\servidor.cmd` y ponerlo en
`0.0.0.0`, y después abrir el puerto 3000 en el firewall de Windows. Es un
cambio deliberadamente manual: expone el sistema a toda la red, y quien lo haga
debería saber que lo está haciendo.

---

## Cómo está armado

| Archivo | Qué hace |
|---|---|
| `empaquetar.cmd` | Compila y arma el instalador. Se corre en el equipo de desarrollo |
| `motoerp.iss` | El script de Inno Setup |
| `scripts\preparar.cmd` | Todo lo que pasa después de copiar los archivos |
| `scripts\servidor.cmd` | Lo que arranca en cada encendido |
| `scripts\tarea.ps1` | Registra la tarea programada |
| `scripts\abrir.cmd` | Detrás del icono del escritorio |
| `scripts\reparar.cmd` | Vuelve a correr la preparación, pidiendo permisos |
| `scripts\detener.cmd` | Baja el servidor antes de una actualización |
| `scripts\desinstalar.cmd` | Quita servicio y tarea, **sin tocar los datos** |
| `scripts\responde.cmd` | Pregunta si algo escucha en un puerto |
| `archivos\generar-icono.py` | Genera el icono. Solo si se cambia el diseño |

### Dos decisiones que conviene no deshacer

**PostgreSQL se inicializa con `pg_ctl init`, no llamando a `initdb`
directamente.** En Windows el motor se niega a correr con permisos de
administrador —y el instalador es administrador—; `pg_ctl` es justamente quien
se relanza a sí mismo con un token restringido para evitarlo.

**La aplicación corre en una tarea programada y no en un servicio de Windows.**
Un servicio necesita un ejecutable que dialogue con el Administrador de
servicios, cosa que `node.exe` no hace; envolverlo pediría traer una herramienta
de terceros solo para eso. Una tarea como SYSTEM da lo mismo que se busca y no
agrega dependencias. PostgreSQL sí es un servicio porque `pg_ctl` sabe
registrarse solo.

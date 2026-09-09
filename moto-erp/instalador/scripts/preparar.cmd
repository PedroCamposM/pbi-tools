@echo off
rem ===========================================================================
rem  MotoERP - preparacion del equipo
rem
rem  Lo ejecuta el instalador con permisos de administrador, una vez copiados
rem  los archivos. Tambien se puede volver a ejecutar a mano (ver reparar.cmd):
rem  todos los pasos son idempotentes, no rompen nada si ya estaban hechos.
rem
rem  Deja el equipo asi:
rem    - PostgreSQL inicializado en %ProgramData%\MotoERP\datos y registrado
rem      como servicio de Windows que arranca solo.
rem    - La base "motoerp" creada, con su usuario y las migraciones aplicadas.
rem    - Una tarea programada que levanta el servidor en cada arranque.
rem
rem  Todo queda registrado en %ProgramData%\MotoERP\registros\instalacion.log
rem ===========================================================================

setlocal EnableExtensions DisableDelayedExpansion

for %%I in ("%~dp0..") do set "BASE=%%~fI"
set "PGBIN=%BASE%\pgsql\bin"
set "APP=%BASE%\app"
set "NODE=%BASE%\node\node.exe"

set "DATOS=%ProgramData%\MotoERP"
set "PGDATA=%DATOS%\datos"
set "REGISTROS=%DATOS%\registros"
set "RESPALDOS=%DATOS%\respaldos"
set "CONFIG=%DATOS%\config.cmd"
set "SERVICIO=MotoERP-Postgres"
set "TAREA=MotoERP servidor"

if not exist "%DATOS%\." mkdir "%DATOS%"
if not exist "%REGISTROS%\." mkdir "%REGISTROS%"
if not exist "%RESPALDOS%\." mkdir "%RESPALDOS%"

set "LOG=%REGISTROS%\instalacion.log"

call :principal >>"%LOG%" 2>&1
set "SALIDA=%ERRORLEVEL%"
endlocal & exit /b %SALIDA%


:principal
echo.
echo ===========================================================================
echo  %DATE% %TIME%   Preparando MotoERP
echo  Programa:  %BASE%
echo  Datos:     %DATOS%
echo ===========================================================================

call :verificar_piezas          || exit /b 10
call :cargar_o_crear_config     || exit /b 11
call :inicializar_postgres      || exit /b 12
call :dar_permisos              || exit /b 13
call :registrar_servicio        || exit /b 14
call :arrancar_postgres         || exit /b 15
call :crear_base                || exit /b 16
call :aplicar_migraciones       || exit /b 17
call :registrar_tarea           || exit /b 18
call :arrancar_servidor         || exit /b 19

echo.
echo  LISTO. MotoERP responde en http://localhost:%PUERTO_APP%
exit /b 0


rem ---------------------------------------------------------------------------
rem  Que todas las piezas hayan llegado. Si falta una, es un error de armado
rem  del instalador y conviene decirlo con nombre y apellido.
rem ---------------------------------------------------------------------------
:verificar_piezas
if not exist "%PGBIN%\postgres.exe" (
  echo ERROR: falta "%PGBIN%\postgres.exe"
  exit /b 1
)
if not exist "%PGBIN%\pg_ctl.exe" (
  echo ERROR: falta "%PGBIN%\pg_ctl.exe"
  exit /b 1
)
if not exist "%NODE%" (
  echo ERROR: falta "%NODE%"
  exit /b 1
)
if not exist "%APP%\server.js" (
  echo ERROR: falta "%APP%\server.js"
  exit /b 1
)
if not exist "%APP%\prisma\schema.prisma" (
  echo ERROR: falta el esquema de Prisma
  exit /b 1
)
if not exist "%APP%\node_modules\prisma\build\index.js" (
  echo ERROR: falta la CLI de Prisma
  exit /b 1
)

rem initdb recibe la ruta del archivo de claves dentro de -o, donde ya no hay
rem forma limpia de volver a entrecomillarla. Con "C:\ProgramData" nunca pasa,
rem pero si alguien mueve ProgramData a una ruta con espacios, mejor decirlo.
echo %DATOS%| find " " >nul && (
  echo ERROR: la ruta de datos "%DATOS%" tiene espacios y PostgreSQL no la va a aceptar.
  exit /b 1
)
echo  Piezas completas.
exit /b 0


rem ---------------------------------------------------------------------------
rem  Claves y rutas. Se generan una sola vez y sobreviven a desinstalar y
rem  volver a instalar: si se perdieran, la base quedaria inaccesible.
rem ---------------------------------------------------------------------------
:cargar_o_crear_config
if exist "%CONFIG%" (
  echo  Reutilizando la configuracion de "%CONFIG%".
  call "%CONFIG%"
  exit /b 0
)

echo  Generando claves nuevas...
for /f "usebackq delims=" %%S in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$b=New-Object byte[] 48;[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b);[Convert]::ToBase64String($b)"`) do set "SECRETO=%%S"
for /f "usebackq delims=" %%S in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$b=New-Object byte[] 24;[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b);[BitConverter]::ToString($b).Replace('-','').ToLower()"`) do set "CLAVE_APP=%%S"
for /f "usebackq delims=" %%S in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$b=New-Object byte[] 24;[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b);[BitConverter]::ToString($b).Replace('-','').ToLower()"`) do set "CLAVE_SUPER=%%S"

if not defined SECRETO (
  echo ERROR: PowerShell no genero la clave de sesion.
  exit /b 1
)
if not defined CLAVE_APP (
  echo ERROR: PowerShell no genero la clave de la base.
  exit /b 1
)
if not defined CLAVE_SUPER (
  echo ERROR: PowerShell no genero la clave del superusuario.
  exit /b 1
)

rem Las claves son hexadecimales a proposito: entran en una URL de conexion sin
rem necesitar escapes, y no traen caracteres que cmd interprete.
> "%CONFIG%" echo rem Configuracion de MotoERP generada por el instalador.
>>"%CONFIG%" echo rem NO BORRAR: aqui viven las claves de la base de datos. Sin ellas
>>"%CONFIG%" echo rem no se puede volver a abrir la informacion del negocio.
>>"%CONFIG%" echo set "PUERTO_APP=3000"
>>"%CONFIG%" echo set "PGPUERTO=5433"
>>"%CONFIG%" echo set "CLAVE_SUPER=%CLAVE_SUPER%"
>>"%CONFIG%" echo set "CLAVE_APP=%CLAVE_APP%"
>>"%CONFIG%" echo set "DATABASE_URL=postgresql://motoerp:%CLAVE_APP%@127.0.0.1:5433/motoerp?schema=public"
>>"%CONFIG%" echo set "SESSION_SECRET=%SECRETO%"
>>"%CONFIG%" echo set "SESSION_HORAS=12"
>>"%CONFIG%" echo set "PROVEEDOR_FE=mock"
>>"%CONFIG%" echo set "NUBEFACT_URL="
>>"%CONFIG%" echo set "NUBEFACT_TOKEN="
>>"%CONFIG%" echo set "RESPALDOS_DIR=%RESPALDOS%"
>>"%CONFIG%" echo set "RESPALDOS_DIAS=30"

rem Solo SYSTEM y los administradores. Un usuario comun de la tienda no tiene
rem por que poder leer la clave de la base.
icacls "%CONFIG%" /inheritance:r /grant "*S-1-5-18:(F)" /grant "*S-1-5-32-544:(F)" >nul 2>&1

call "%CONFIG%"
echo  Configuracion escrita en "%CONFIG%".
exit /b 0


rem ---------------------------------------------------------------------------
rem  initdb, a traves de pg_ctl: en Windows PostgreSQL se niega a correr con
rem  permisos de administrador, y `pg_ctl init` es justamente quien se relanza
rem  con un token restringido para evitarlo.
rem ---------------------------------------------------------------------------
:inicializar_postgres
if exist "%PGDATA%\PG_VERSION" (
  echo  La base ya estaba inicializada en "%PGDATA%".
  exit /b 0
)

set "CLAVES=%DATOS%\clave.tmp"
> "%CLAVES%" echo %CLAVE_SUPER%

echo  Inicializando PostgreSQL en "%PGDATA%"...
"%PGBIN%\pg_ctl.exe" init -D "%PGDATA%" -o "-U postgres --pwfile=%CLAVES% -A scram-sha-256 -E UTF8 --locale=Spanish_Peru.1252"
if not exist "%PGDATA%\PG_VERSION" (
  echo  La configuracion regional peruana no fue aceptada. Reintentando con la neutra.
  if exist "%PGDATA%\." rd /s /q "%PGDATA%"
  "%PGBIN%\pg_ctl.exe" init -D "%PGDATA%" -o "-U postgres --pwfile=%CLAVES% -A scram-sha-256 -E UTF8 --locale=C"
)

del /f /q "%CLAVES%" >nul 2>&1

if not exist "%PGDATA%\PG_VERSION" (
  echo ERROR: initdb no pudo crear la base.
  exit /b 1
)

rem El servicio corre como NETWORK SERVICE, que no hereda nada util de
rem ProgramData ni de Archivos de Programa.
icacls "%PGDATA%" /grant "*S-1-5-20:(OI)(CI)F" /T /C /Q >nul 2>&1
echo  PostgreSQL inicializado.
exit /b 0


rem ---------------------------------------------------------------------------
rem  Permisos para NETWORK SERVICE, que es la cuenta con la que corre el
rem  servicio de PostgreSQL. No hereda nada util ni de Archivos de Programa ni
rem  de ProgramData, y esto hay que rehacerlo en cada instalacion porque la
rem  carpeta del programa se reemplaza entera.
rem ---------------------------------------------------------------------------
:dar_permisos
echo  Ajustando permisos...
icacls "%BASE%\pgsql" /grant "*S-1-5-20:(OI)(CI)RX" /T /C /Q >nul 2>&1
icacls "%REGISTROS%" /grant "*S-1-5-20:(OI)(CI)M" /T /C /Q >nul 2>&1
exit /b 0


rem ---------------------------------------------------------------------------
rem  Servicio de Windows. Da dos cosas: arranca solo al encender la computadora
rem  y, al apagarla, Windows lo detiene ordenadamente en vez de cortarle la luz.
rem ---------------------------------------------------------------------------
:registrar_servicio
sc query "%SERVICIO%" >nul 2>&1
if not errorlevel 1 (
  echo  El servicio "%SERVICIO%" ya estaba registrado.
  exit /b 0
)

echo  Registrando el servicio "%SERVICIO%" en el puerto %PGPUERTO%...
"%PGBIN%\pg_ctl.exe" register -N "%SERVICIO%" -D "%PGDATA%" -S auto -l "%REGISTROS%\postgres.log" -o "-p %PGPUERTO% -c listen_addresses=127.0.0.1"
sc query "%SERVICIO%" >nul 2>&1
if errorlevel 1 (
  echo ERROR: el servicio no quedo registrado.
  exit /b 1
)

sc description "%SERVICIO%" "Base de datos de MotoERP." >nul 2>&1
echo  Servicio registrado.
exit /b 0


:arrancar_postgres
echo  Arrancando PostgreSQL...
sc start "%SERVICIO%" >nul 2>&1

for /l %%I in (1,1,60) do (
  "%PGBIN%\pg_isready.exe" -h 127.0.0.1 -p %PGPUERTO% -q && goto :postgres_listo
  ping -n 2 127.0.0.1 >nul
)
echo ERROR: PostgreSQL no respondio en el puerto %PGPUERTO% despues de 60 intentos.
echo        Revisa "%REGISTROS%\postgres.log" y el visor de eventos de Windows.
exit /b 1

:postgres_listo
echo  PostgreSQL responde en 127.0.0.1:%PGPUERTO%.
exit /b 0


rem ---------------------------------------------------------------------------
rem  Usuario y base de la aplicacion. Se hace con el superusuario y despues se
rem  comprueba entrando como el usuario de la aplicacion, que es la prueba real.
rem ---------------------------------------------------------------------------
:crear_base
set "PGPASSWORD=%CLAVE_SUPER%"

echo  Creando el usuario "motoerp" si hiciera falta...
"%PGBIN%\psql.exe" -h 127.0.0.1 -p %PGPUERTO% -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motoerp') THEN CREATE ROLE motoerp LOGIN PASSWORD '%CLAVE_APP%'; END IF; END $$;"
if errorlevel 1 (
  echo ERROR: no se pudo crear el usuario de la base.
  exit /b 1
)

rem Si la base ya existe, createdb protesta y no pasa nada: lo que vale es la
rem comprobacion de abajo. Es dueno de su propia base, asi que puede crear
rem tablas en el esquema public sin permisos extra (PostgreSQL 15 en adelante).
echo  Creando la base "motoerp" si hiciera falta...
"%PGBIN%\createdb.exe" -h 127.0.0.1 -p %PGPUERTO% -U postgres -O motoerp motoerp 2>nul

set "PGPASSWORD=%CLAVE_APP%"
"%PGBIN%\psql.exe" -h 127.0.0.1 -p %PGPUERTO% -U motoerp -d motoerp -tAc "SELECT 1" >nul
if errorlevel 1 (
  echo ERROR: el usuario "motoerp" no pudo entrar a su base.
  echo        Si reinstalaste sobre datos viejos con claves distintas, borra
  echo        "%CONFIG%" solo si tambien vas a borrar "%PGDATA%".
  set "PGPASSWORD="
  exit /b 1
)
set "PGPASSWORD="
echo  Base "motoerp" lista.
exit /b 0


:aplicar_migraciones
echo  Aplicando migraciones de Prisma...
set "CHECKPOINT_DISABLE=1"
set "PRISMA_HIDE_UPDATE_MESSAGE=1"
"%NODE%" "%APP%\node_modules\prisma\build\index.js" migrate deploy --schema "%APP%\prisma\schema.prisma"
if errorlevel 1 (
  echo ERROR: fallaron las migraciones.
  exit /b 1
)
echo  Migraciones al dia.
exit /b 0


rem ---------------------------------------------------------------------------
rem  La tarea programada hace de servicio para la aplicacion: corre como SYSTEM
rem  (sin ventana, sin necesidad de que alguien inicie sesion) y se levanta en
rem  cada arranque. Ver tarea.ps1 para el detalle de por que no es un servicio.
rem ---------------------------------------------------------------------------
:registrar_tarea
echo  Registrando la tarea "%TAREA%"...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tarea.ps1" -Servidor "%~dp0servidor.cmd" -Nombre "%TAREA%"
if errorlevel 1 (
  echo ERROR: no se pudo registrar la tarea programada.
  exit /b 1
)
echo  Tarea registrada.
exit /b 0


:arrancar_servidor
echo  Arrancando el servidor...
schtasks /run /tn "%TAREA%" >nul 2>&1

for /l %%I in (1,1,45) do (
  call "%~dp0responde.cmd" %PUERTO_APP% && goto :servidor_listo
  ping -n 2 127.0.0.1 >nul
)
echo ERROR: el servidor no respondio en el puerto %PUERTO_APP%.
echo        Revisa "%REGISTROS%\servidor.log".
exit /b 1

:servidor_listo
echo  El servidor responde en http://localhost:%PUERTO_APP%
exit /b 0

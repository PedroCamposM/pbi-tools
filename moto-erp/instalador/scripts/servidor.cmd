@echo off
rem ===========================================================================
rem  MotoERP - el servidor
rem
rem  Lo arranca la tarea programada "MotoERP servidor" en cada encendido,
rem  como SYSTEM: sin ventana y sin necesidad de que nadie inicie sesion.
rem  Nadie deberia ejecutarlo a mano.
rem
rem  Registro en %ProgramData%\MotoERP\registros\servidor.log
rem ===========================================================================

setlocal EnableExtensions DisableDelayedExpansion

for %%I in ("%~dp0..") do set "BASE=%%~fI"
set "PGBIN=%BASE%\pgsql\bin"
set "APP=%BASE%\app"
set "NODE=%BASE%\node\node.exe"

set "DATOS=%ProgramData%\MotoERP"
set "REGISTROS=%DATOS%\registros"
set "CONFIG=%DATOS%\config.cmd"
set "LOG=%REGISTROS%\servidor.log"

if not exist "%CONFIG%" exit /b 1
call "%CONFIG%"

if not exist "%REGISTROS%\." mkdir "%REGISTROS%"

rem Este registro se escribe para siempre: sin esto, en un par de anos se come
rem el disco de la tienda.
for %%A in ("%LOG%") do if %%~zA GTR 5000000 move /y "%LOG%" "%LOG%.anterior" >nul 2>&1

call :principal >>"%LOG%" 2>&1
exit /b


:principal
echo.
echo ---------------------------------------------------------------------------
echo  %DATE% %TIME%   Arrancando MotoERP
echo ---------------------------------------------------------------------------

rem La tarea y el servicio de PostgreSQL arrancan a la vez al encender la
rem computadora, asi que casi siempre hay que esperar un momento a la base.
call :esperar_postgres

rem Variables de la aplicacion. RESPALDOS_DIR y las claves vienen de config.cmd;
rem lo de aca depende de donde quedo instalado el programa.
set "PG_DUMP_PATH=%PGBIN%\pg_dump.exe"
set "NODE_ENV=production"
set "PORT=%PUERTO_APP%"
set "HOSTNAME=127.0.0.1"
set "NEXT_TELEMETRY_DISABLED=1"
set "CHECKPOINT_DISABLE=1"
set "PRISMA_HIDE_UPDATE_MESSAGE=1"

rem Al dia con las migraciones antes de levantar. Aqui es donde se aplica sola
rem una actualizacion del programa que traiga cambios de base.
echo  Revisando migraciones...
"%NODE%" "%APP%\node_modules\prisma\build\index.js" migrate deploy --schema "%APP%\prisma\schema.prisma"

cd /d "%APP%"

rem Si el servidor se cae, vuelve a levantarlo. La tarea programada tambien
rem reintenta, pero solo tres veces: esto es lo que hace que una tienda que
rem nunca apaga la computadora siga funcionando el mes que viene.
:bucle
echo.
echo  [%DATE% %TIME%] node server.js
"%NODE%" "%APP%\server.js"
echo  [%DATE% %TIME%] el servidor termino (codigo %ERRORLEVEL%). Reintentando en 10 segundos.
ping -n 11 127.0.0.1 >nul
goto :bucle


:esperar_postgres
for /l %%I in (1,1,90) do (
  "%PGBIN%\pg_isready.exe" -h 127.0.0.1 -p %PGPUERTO% -q && goto :hay_postgres
  ping -n 2 127.0.0.1 >nul
)
echo  AVISO: PostgreSQL no respondio en 3 minutos. Se intenta arrancar igual.
exit /b 0

:hay_postgres
echo  PostgreSQL responde en 127.0.0.1:%PGPUERTO%.
exit /b 0

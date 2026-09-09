@echo off
rem ===========================================================================
rem  MotoERP - construir el instalador
rem
rem  Esto se corre EN WINDOWS, y no es un capricho: Prisma trae motores
rem  compilados para cada sistema operativo, y los que se empaquetan son los
rem  que quedan en node_modules al instalar. Armado desde Linux o Mac, el
rem  instalador se genera igual y falla al arrancar en la maquina del cliente.
rem
rem  Antes de correrlo, una sola vez:
rem
rem    1. Node.js 22 LTS instalado (https://nodejs.org).
rem    2. Inno Setup 6.3 o superior (https://jrsoftware.org/isdl.php).
rem    3. PostgreSQL 16 portable, la version "binaries only" de:
rem       https://www.enterprisedb.com/download-postgresql-binaries
rem       Se descomprime y adentro hay una carpeta "pgsql". Esa carpeta va en:
rem       instalador\vendor\pgsql
rem       (o sea que tiene que existir instalador\vendor\pgsql\bin\postgres.exe)
rem
rem  Despues, cada vez que quieras generar un instalador nuevo, basta con:
rem
rem    instalador\empaquetar.cmd
rem
rem  El .exe sale en instalador\salida\
rem ===========================================================================

setlocal EnableExtensions DisableDelayedExpansion

set "INST=%~dp0"
if "%INST:~-1%"=="\" set "INST=%INST:~0,-1%"
for %%I in ("%INST%\..") do set "RAIZ=%%~fI"
set "ETAPA=%INST%\build"

echo.
echo ===========================================================================
echo  Construyendo el instalador de MotoERP
echo  Proyecto: %RAIZ%
echo ===========================================================================
echo.

call :verificar_requisitos || exit /b 1
call :compilar_aplicacion  || exit /b 1
call :armar_carpeta        || exit /b 1
call :compilar_instalador  || exit /b 1

echo.
echo ===========================================================================
echo  LISTO
echo.
for %%F in ("%INST%\salida\*.exe") do echo   %%~fF   (%%~zF bytes)
echo.
echo  Pruebalo en una computadora que no sea esta: aqui ya tienes Node y
echo  PostgreSQL instalados y eso puede tapar un problema que el cliente si
echo  va a ver.
echo ===========================================================================
echo.
exit /b 0


:verificar_requisitos
echo [1/4] Revisando que este todo...

where node >nul 2>&1
if errorlevel 1 (
  echo   ERROR: no encuentro node. Instala Node.js 22 LTS desde https://nodejs.org
  exit /b 1
)
for /f "usebackq delims=" %%V in (`node --version`) do echo   node %%V

where npm >nul 2>&1
if errorlevel 1 (
  echo   ERROR: no encuentro npm.
  exit /b 1
)

if not exist "%INST%\vendor\pgsql\bin\postgres.exe" (
  echo.
  echo   ERROR: falta PostgreSQL portable.
  echo.
  echo   Descarga la version "binaries only" de PostgreSQL 16 desde:
  echo     https://www.enterprisedb.com/download-postgresql-binaries
  echo.
  echo   Descomprimela y copia la carpeta "pgsql" que hay adentro a:
  echo     %INST%\vendor\pgsql
  echo.
  echo   Tiene que quedar este archivo:
  echo     %INST%\vendor\pgsql\bin\postgres.exe
  echo.
  exit /b 1
)
echo   PostgreSQL portable encontrado.

call :buscar_iscc || exit /b 1
echo   Inno Setup: %ISCC%
exit /b 0


:buscar_iscc
set "ISCC="
if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not defined ISCC if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if not defined ISCC for /f "usebackq delims=" %%I in (`where ISCC 2^>nul`) do set "ISCC=%%I"
if not defined ISCC (
  echo   ERROR: no encuentro ISCC.exe (el compilador de Inno Setup).
  echo   Instalalo desde https://jrsoftware.org/isdl.php
  exit /b 1
)
exit /b 0


:compilar_aplicacion
echo.
echo [2/4] Compilando la aplicacion...
pushd "%RAIZ%"

rem npm install y no npm ci: ci borra node_modules entero y vuelve a bajarlo
rem todo, incluidos los navegadores de Playwright. En una conexion normal eso
rem son varios minutos cada vez, para nada.
call npm install
if errorlevel 1 (
  popd
  echo   ERROR: fallo npm install.
  exit /b 1
)

rem Prisma solo necesita que la variable exista para generar el cliente; a esta
rem base no se conecta nadie. Es lo mismo que hace el Dockerfile.
set "DATABASE_URL=postgresql://build:build@localhost:5432/build"
set "NEXT_TELEMETRY_DISABLED=1"

call npm run build
if errorlevel 1 (
  popd
  echo   ERROR: fallo la compilacion.
  exit /b 1
)

popd
if not exist "%RAIZ%\.next\standalone\server.js" (
  echo   ERROR: no se genero .next\standalone. Revisa que next.config.mjs
  echo          siga teniendo output: 'standalone'.
  exit /b 1
)
echo   Aplicacion compilada.
exit /b 0


:armar_carpeta
echo.
echo [3/4] Armando la carpeta a empaquetar...

if exist "%ETAPA%\." rd /s /q "%ETAPA%"
mkdir "%ETAPA%\app"
mkdir "%ETAPA%\node"

rem El modo standalone de Next deja un node_modules recortado con lo justo, y
rem los archivos estaticos hay que ponerlos al lado a mano.
xcopy "%RAIZ%\.next\standalone" "%ETAPA%\app"                 /E /I /Q /Y >nul
xcopy "%RAIZ%\.next\static"     "%ETAPA%\app\.next\static"    /E /I /Q /Y >nul
if exist "%RAIZ%\public" xcopy "%RAIZ%\public" "%ETAPA%\app\public" /E /I /Q /Y >nul

rem El esquema y las migraciones: sin esto no hay migrate deploy en el cliente.
xcopy "%RAIZ%\prisma" "%ETAPA%\app\prisma" /E /I /Q /Y >nul

rem Prisma aparte. El rastreo de Next no siempre se lleva el motor de consultas
rem (es un .node binario, no un require normal), y la CLI de migraciones es una
rem dependencia de desarrollo que directamente no mira. Este fue exactamente el
rem bug del Dockerfile: la aplicacion probada a fondo y el empaquetado no.
xcopy "%RAIZ%\node_modules\.prisma"  "%ETAPA%\app\node_modules\.prisma"  /E /I /Q /Y >nul
xcopy "%RAIZ%\node_modules\@prisma"  "%ETAPA%\app\node_modules\@prisma"  /E /I /Q /Y >nul
xcopy "%RAIZ%\node_modules\prisma"   "%ETAPA%\app\node_modules\prisma"   /E /I /Q /Y >nul

rem node.exe, el mismo con el que se acaba de compilar. Asi el cliente no
rem necesita instalar Node ni nos importa que version tenga.
for /f "usebackq delims=" %%I in (`where node`) do set "NODEEXE=%%I" & goto :tengo_node
:tengo_node
copy /y "%NODEEXE%" "%ETAPA%\node\node.exe" >nul
if errorlevel 1 (
  echo   ERROR: no pude copiar node.exe desde "%NODEEXE%".
  exit /b 1
)

if not exist "%ETAPA%\app\server.js" (
  echo   ERROR: falta server.js en la carpeta armada.
  exit /b 1
)
if not exist "%ETAPA%\app\node_modules\prisma\build\index.js" (
  echo   ERROR: falta la CLI de Prisma.
  exit /b 1
)
if not exist "%ETAPA%\node\node.exe" (
  echo   ERROR: falta node.exe.
  exit /b 1
)

rem El motor de consultas de Windows tiene que estar: si falta, la aplicacion
rem instala bien y revienta al abrir la primera pantalla.
dir /b /s "%ETAPA%\app\node_modules\.prisma\client\query_engine-windows*.node" >nul 2>&1
if errorlevel 1 (
  echo.
  echo   ERROR: no encuentro el motor de Prisma para Windows.
  echo          Esto pasa cuando node_modules se armo en Linux o Mac.
  echo          Borra node_modules, corre "npm install" en Windows y reintenta.
  echo.
  exit /b 1
)
echo   Carpeta armada en %ETAPA%
exit /b 0


:compilar_instalador
echo.
echo [4/4] Compilando el instalador con Inno Setup...
if not exist "%INST%\salida\." mkdir "%INST%\salida"
"%ISCC%" /Q "%INST%\motoerp.iss"
if errorlevel 1 (
  echo   ERROR: Inno Setup no pudo compilar.
  exit /b 1
)
exit /b 0

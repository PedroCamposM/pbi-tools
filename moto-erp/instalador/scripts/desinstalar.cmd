@echo off
rem ===========================================================================
rem  MotoERP - limpieza al desinstalar
rem
rem  Quita lo que el instalador registro en Windows: la tarea programada y el
rem  servicio de PostgreSQL.
rem
rem  NO BORRA LA INFORMACION DEL NEGOCIO. La base de datos, los respaldos y las
rem  claves siguen en %ProgramData%\MotoERP. Es a proposito: desinstalar el
rem  programa no puede significar perder la contabilidad. Si se vuelve a
rem  instalar, el sistema se reencuentra con sus datos tal como estaban.
rem
rem  Para borrarlo todo de verdad hay que eliminar esa carpeta a mano.
rem ===========================================================================

setlocal EnableExtensions DisableDelayedExpansion

for %%I in ("%~dp0..") do set "BASE=%%~fI"
set "PGBIN=%BASE%\pgsql\bin"
set "DATOS=%ProgramData%\MotoERP"
set "PGDATA=%DATOS%\datos"
set "SERVICIO=MotoERP-Postgres"
set "TAREA=MotoERP servidor"

call "%~dp0detener.cmd"

schtasks /delete /tn "%TAREA%" /f >nul 2>&1

sc query "%SERVICIO%" >nul 2>&1
if errorlevel 1 goto :fin

sc stop "%SERVICIO%" >nul 2>&1

rem Hay que esperar a que pare de verdad: si se le quita el registro mientras
rem todavia esta corriendo, el servicio queda marcado para borrar y no se va
rem hasta reiniciar, y una reinstalacion despues no puede registrarlo.
for /l %%I in (1,1,30) do (
  sc query "%SERVICIO%" | find "STOPPED" >nul && goto :detenido
  sc query "%SERVICIO%" | find "DETENIDO" >nul && goto :detenido
  ping -n 2 127.0.0.1 >nul
)

:detenido
if exist "%PGBIN%\pg_ctl.exe" "%PGBIN%\pg_ctl.exe" unregister -N "%SERVICIO%" >nul 2>&1
sc query "%SERVICIO%" >nul 2>&1
if not errorlevel 1 sc delete "%SERVICIO%" >nul 2>&1

:fin
exit /b 0

@echo off
rem ===========================================================================
rem  MotoERP - abrir
rem
rem  Es lo que hay detras del icono del escritorio. No arranca el programa: el
rem  programa ya esta corriendo desde que se encendio la computadora. Lo unico
rem  que hace es comprobar que responde y abrir el navegador.
rem
rem  El acceso directo lo lanza minimizado, asi que esta ventana se ve un
rem  segundo en la barra de tareas y desaparece.
rem ===========================================================================

setlocal EnableExtensions DisableDelayedExpansion
title Abriendo MotoERP

set "DATOS=%ProgramData%\MotoERP"
set "CONFIG=%DATOS%\config.cmd"
set "TAREA=MotoERP servidor"
set "PUERTO_APP=3000"
if exist "%CONFIG%" call "%CONFIG%" 2>nul

rem Caso normal: ya esta levantado, se abre y listo.
call "%~dp0responde.cmd" %PUERTO_APP% && goto :abrir

rem No responde. Puede ser que la computadora acabe de encender y todavia este
rem levantando, o que alguien haya detenido la tarea.
schtasks /run /tn "%TAREA%" >nul 2>&1

for /l %%I in (1,1,40) do (
  call "%~dp0responde.cmd" %PUERTO_APP% && goto :abrir
  ping -n 2 127.0.0.1 >nul
)

echo.
echo  =========================================================================
echo   MotoERP no esta respondiendo.
echo  =========================================================================
echo.
echo   Que hacer, en este orden:
echo.
echo     1. Reinicia la computadora y vuelve a abrir MotoERP.
echo.
echo     2. Si sigue igual, abre el menu Inicio, busca "Reparar MotoERP",
echo        haz clic derecho y elige "Ejecutar como administrador".
echo.
echo     3. Si tampoco, el detalle esta en:
echo        %DATOS%\registros\servidor.log
echo.
pause
exit /b 1

:abrir
start "" "http://localhost:%PUERTO_APP%"
exit /b 0

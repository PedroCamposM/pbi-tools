@echo off
rem ===========================================================================
rem  MotoERP - detener el servidor
rem
rem  Lo llama el instalador antes de copiar archivos encima de una version
rem  anterior: si node.exe sigue corriendo, Windows no deja reemplazarlo y la
rem  actualizacion falla a mitad de camino.
rem
rem  Detiene solo la aplicacion. La base de datos sigue arriba.
rem ===========================================================================

setlocal EnableExtensions DisableDelayedExpansion

for %%I in ("%~dp0..") do set "BASE=%%~fI"
set "NODE=%BASE%\node\node.exe"
set "TAREA=MotoERP servidor"

schtasks /end /tn "%TAREA%" >nul 2>&1

rem La tarea deberia llevarse tambien al node.exe que colgaba de ella, pero no
rem siempre. Se mata por ruta exacta del ejecutable, no por nombre: en la
rem maquina de desarrollo hay otros node.exe corriendo y no son asunto nuestro.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq '%NODE%' } | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>&1

rem Un respiro para que Windows suelte los archivos.
ping -n 3 127.0.0.1 >nul
exit /b 0

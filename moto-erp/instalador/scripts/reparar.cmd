@echo off
rem ===========================================================================
rem  MotoERP - reparar
rem
rem  Vuelve a correr la preparacion completa. Sirve cuando algo quedo a medias:
rem  el servicio de la base desaparecio, la tarea programada se borro, o el
rem  servidor no levanta y no se sabe por que.
rem
rem  No toca la informacion del negocio: preparar.cmd no borra ni reinicializa
rem  una base que ya existe.
rem
rem  Necesita permisos de administrador y se los pide solo.
rem ===========================================================================

net session >nul 2>&1
if not errorlevel 1 goto :elevado

echo Pidiendo permisos de administrador...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b 0

:elevado
echo.
echo  Reparando MotoERP. Esto puede tardar un minuto.
echo.
call "%~dp0preparar.cmd"
set "SALIDA=%ERRORLEVEL%"

echo.
if "%SALIDA%"=="0" (
  echo  Listo. MotoERP deberia estar respondiendo otra vez.
  echo  Abrelo con el icono del escritorio.
) else (
  echo  No se pudo. El detalle esta en:
  echo    %ProgramData%\MotoERP\registros\instalacion.log
)
echo.
pause
exit /b %SALIDA%

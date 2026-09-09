@echo off
rem ---------------------------------------------------------------------------
rem  Devuelve 0 si algo esta escuchando en 127.0.0.1 en el puerto que se le pase.
rem
rem  Existe como archivo aparte porque lo usan tres scripts distintos. Usa
rem  PowerShell y no curl: curl.exe viene en Windows 10 desde 2018, pero
rem  PowerShell esta en absolutamente todas.
rem ---------------------------------------------------------------------------
setlocal
if "%~1"=="" exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',%~1);$c.Close();exit 0}catch{exit 1}"
exit /b %ERRORLEVEL%

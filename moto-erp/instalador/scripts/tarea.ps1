<#
    Registra la tarea programada que mantiene MotoERP levantado.

    ¿Por qué una tarea y no un servicio de Windows?

    Un servicio necesita un ejecutable que hable con el Administrador de
    servicios: node.exe no lo hace, y envolverlo pediría traer una herramienta
    de terceros (NSSM y parecidas) solo para eso. Una tarea programada corriendo
    como SYSTEM da lo mismo que se busca —arranca al encender la computadora,
    sin ventana, sin que nadie tenga que iniciar sesión— y no agrega
    dependencias: schtasks viene con Windows.

    PostgreSQL sí queda como servicio de verdad, porque pg_ctl sabe registrarse
    solo y así Windows lo apaga ordenadamente.

    Se registra con el SID S-1-5-18 en vez del nombre "SYSTEM" porque en un
    Windows en español la cuenta se llama "SISTEMA" y el nombre no resuelve.
#>

param(
    [Parameter(Mandatory = $true)][string] $Servidor,
    [Parameter(Mandatory = $true)][string] $Nombre
)

$ErrorActionPreference = 'Stop'

try {
    # cmd /s /c "" ... "" es la forma que sobrevive a las rutas con espacios:
    # con /s cmd saca solo el primer y el último carácter, y adentro queda la
    # ruta todavía entre comillas.
    $accion = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/s /c ""' + $Servidor + '""')

    # Al encender y también al iniciar sesión: si alguien mata el proceso, con
    # cerrar y volver a abrir sesión revive, sin reiniciar la computadora.
    $disparadores = @(
        (New-ScheduledTaskTrigger -AtStartup),
        (New-ScheduledTaskTrigger -AtLogOn)
    )

    $cuenta = New-ScheduledTaskPrincipal -UserId 'S-1-5-18' -RunLevel Highest

    $opciones = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -MultipleInstances IgnoreNew `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit ([TimeSpan]::Zero)

    Register-ScheduledTask -TaskName $Nombre `
        -Action $accion `
        -Trigger $disparadores `
        -Principal $cuenta `
        -Settings $opciones `
        -Description 'Mantiene MotoERP disponible en http://localhost:3000' `
        -Force | Out-Null

    # Sin esto, un usuario que no sea administrador no puede pedirle a la tarea
    # que arranque, y abrir.cmd se queda sin su plan B.
    $archivo = Join-Path $env:SystemRoot ('System32\Tasks\' + $Nombre)
    if (Test-Path -LiteralPath $archivo) {
        # S-1-5-32-545 = grupo Usuarios, con ese nombre en cualquier idioma.
        & icacls.exe $archivo /grant '*S-1-5-32-545:(RX)' | Out-Null
    }

    Write-Output "Tarea '$Nombre' registrada."
    exit 0
}
catch {
    Write-Output "ERROR al registrar la tarea: $($_.Exception.Message)"
    exit 1
}

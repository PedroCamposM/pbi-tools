; ===========================================================================
;  MotoERP - instalador para Windows
;
;  Se compila con Inno Setup 6.3 o superior. No lo compiles a mano: usa
;  empaquetar.cmd, que antes de llamar aqui construye la aplicacion y arma
;  la carpeta build\ con todo lo que este script espera encontrar.
;
;  Que instala:
;    {app}\app     la aplicacion Next.js ya compilada
;    {app}\node    node.exe, para no depender de que Node este instalado
;    {app}\pgsql   PostgreSQL portable
;    {app}\scripts los .cmd que hacen que todo esto arranque solo
;
;  Que NO va en Archivos de Programa, a proposito:
;    %ProgramData%\MotoERP  la base de datos, los respaldos y las claves.
;    Ahi sobreviven a una desinstalacion, y la base es escribible sin darle
;    permisos raros a Archivos de Programa.
; ===========================================================================

#define Nombre     "MotoERP"
#define Version    "1.0.0"
#define Publicador "MotoERP"
#define URLApp     "http://localhost:3000"

[Setup]
AppId={{8B3F1C42-7A5E-4D91-B6C8-2E4F9A7D1035}
AppName={#Nombre}
AppVersion={#Version}
AppVerName={#Nombre} {#Version}
AppPublisher={#Publicador}
DefaultDirName={autopf}\{#Nombre}
DefaultGroupName={#Nombre}
DisableProgramGroupPage=yes
OutputDir=salida
OutputBaseFilename=MotoERP-{#Version}-instalador
SetupIconFile=archivos\motoerp.ico
UninstallDisplayIcon={app}\motoerp.ico
UninstallDisplayName={#Nombre}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; PostgreSQL y node.exe pesan; sin esto el instalador arranca y falla a mitad.
ExtraDiskSpaceRequired=524288000

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Dirs]
; Se crean aqui, y no solo en preparar.cmd, porque los accesos directos se
; hacen antes de que preparar.cmd corra. uninsneveruninstall es lo que impide
; que desinstalar el programa se lleve la base y los respaldos.
Name: "{commonappdata}\MotoERP";           Flags: uninsneveruninstall
Name: "{commonappdata}\MotoERP\respaldos"; Flags: uninsneveruninstall
Name: "{commonappdata}\MotoERP\registros"; Flags: uninsneveruninstall

[Files]
Source: "build\app\*";    DestDir: "{app}\app";     Flags: ignoreversion recursesubdirs createallsubdirs
Source: "build\node\*";   DestDir: "{app}\node";    Flags: ignoreversion
Source: "scripts\*";      DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "archivos\motoerp.ico"; DestDir: "{app}";   Flags: ignoreversion
; De PostgreSQL solo hace falta lo que corre. La documentacion, las cabeceras
; de C y los simbolos de depuracion son unos 200 MB que nadie va a abrir.
Source: "vendor\pgsql\*"; DestDir: "{app}\pgsql";   Flags: ignoreversion recursesubdirs createallsubdirs; \
    Excludes: "doc\*,include\*,symbols\*,*.pdb"

[Icons]
; El acceso directo no arranca el programa: ya esta corriendo desde el
; encendido. Solo comprueba y abre el navegador, por eso va minimizado.
Name: "{autoprograms}\{#Nombre}"; Filename: "{app}\scripts\abrir.cmd"; \
    IconFilename: "{app}\motoerp.ico"; Comment: "Abrir MotoERP"; Flags: runminimized
Name: "{autodesktop}\{#Nombre}";  Filename: "{app}\scripts\abrir.cmd"; \
    IconFilename: "{app}\motoerp.ico"; Comment: "Abrir MotoERP"; Flags: runminimized
Name: "{autoprograms}\Respaldos de {#Nombre}"; Filename: "{commonappdata}\MotoERP\respaldos"; \
    Comment: "Carpeta con las copias de seguridad de la base de datos"
Name: "{autoprograms}\Reparar {#Nombre}"; Filename: "{app}\scripts\reparar.cmd"; \
    IconFilename: "{app}\motoerp.ico"; Comment: "Vuelve a dejar MotoERP funcionando si algo se rompio"

[Run]
Filename: "{app}\scripts\abrir.cmd"; Description: "Abrir MotoERP ahora"; \
    Flags: postinstall nowait skipifsilent runminimized

[UninstallRun]
Filename: "{app}\scripts\desinstalar.cmd"; RunOnceId: "QuitarServicios"; Flags: runhidden waituntilterminated

[Code]

{ Antes de copiar nada encima, hay que parar el servidor: mientras node.exe
  este corriendo desde {app}, Windows no deja reemplazar sus archivos y la
  actualizacion se rompe por la mitad. El detener.cmd que se usa es el de la
  version que ya estaba instalada, que sabe donde vive. }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Detener: String;
  Codigo: Integer;
begin
  Result := '';
  Detener := ExpandConstant('{app}\scripts\detener.cmd');
  if FileExists(Detener) then
  begin
    Exec(ExpandConstant('{cmd}'), '/s /c ""' + Detener + '""', '',
         SW_HIDE, ewWaitUntilTerminated, Codigo);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Codigo: Integer;
begin
  if CurStep <> ssPostInstall then
    Exit;

  WizardForm.StatusLabel.Caption :=
    'Preparando la base de datos y el arranque automatico. Puede tardar un minuto...';
  WizardForm.Refresh;

  if not Exec(ExpandConstant('{cmd}'),
              '/s /c ""' + ExpandConstant('{app}\scripts\preparar.cmd') + '""',
              '', SW_HIDE, ewWaitUntilTerminated, Codigo) then
    Codigo := -1;

  if Codigo <> 0 then
    MsgBox('Los archivos se copiaron bien, pero la preparacion no termino.' + #13#10 + #13#10 +
           'El detalle esta en:' + #13#10 +
           ExpandConstant('{commonappdata}\MotoERP\registros\instalacion.log') + #13#10 + #13#10 +
           'Puedes reintentar desde el menu Inicio, con "Reparar MotoERP",' + #13#10 +
           'haciendo clic derecho y eligiendo "Ejecutar como administrador".',
           mbError, MB_OK);
end;

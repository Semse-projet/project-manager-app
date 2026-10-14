#requires -Version 5.1
<#
.SYNOPSIS
  SEMSE Field Memory: SSH read-only inventory, encrypted SCP copy, isolated SHA-256 recovery.
.DESCRIPTION
  NEVER restores native Railway snapshots or writes to production /data.
  A confirmed upload freeze and BitLocker-protected local drive are required.
.EXAMPLE
  .\field-memory-offsite-recovery-windows.ps1 -Mode Preflight -RepoRoot C:\repo\project-manager-app
.EXAMPLE
  .\field-memory-offsite-recovery-windows.ps1 -Mode ExportAndVerify -RepoRoot C:\repo\project-manager-app -SecureRoot D:\SEMSE-Secure-Recovery -EncryptedStorageConfirmed -UploadsQuiescedConfirmed
#>
[CmdletBinding()]
param(
  [ValidateSet('Preflight','ExportAndVerify')][string]$Mode = 'Preflight',
  [string]$RepoRoot = '',
  [string]$SecureRoot = '',
  [switch]$EncryptedStorageConfirmed,
  [switch]$UploadsQuiescedConfirmed
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$utf8 = New-Object System.Text.UTF8Encoding($false)
$nl = [Environment]::NewLine

$project = '95ad1b14-d1d9-467d-82d8-5354619ba873'
$environment = 'd682210a-956a-4508-9c5b-4ca5959278f9'
$service = 'semse-API'
$aliasName = 'semse-api-prod'

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Falta el comando '$Name'. Instálalo y vuelve a ejecutar el preflight."
  }
}
function Assert-Exit([string]$Description) {
  if ($LASTEXITCODE -ne 0) { throw "$Description falló. Código $LASTEXITCODE." }
}
function Resolve-ProjectFolder {
  $candidates = @()
  if ($RepoRoot) {
    $candidates += $RepoRoot
    $candidates += (Join-Path $RepoRoot 'project-manager-app')
  }
  $candidates += (Join-Path $PSScriptRoot '..')
  $candidates += $PSScriptRoot
  foreach ($candidate in $candidates) {
    $absolute = [System.IO.Path]::GetFullPath($candidate)
    if (Test-Path -LiteralPath (Join-Path $absolute 'scripts\field-memory-source-inventory.mjs') -PathType Leaf) {
      return $absolute
    }
  }
  throw 'No encuentro project-manager-app\scripts. Pasa -RepoRoot a la carpeta que contiene scripts.'
}
function Assert-EncryptedLocation([string]$Directory) {
  if (-not $EncryptedStorageConfirmed) {
    throw 'Debes confirmar cifrado real en reposo con -EncryptedStorageConfirmed.'
  }
  $absolute = [System.IO.Path]::GetFullPath($Directory)
  $volume = [System.IO.Path]::GetPathRoot($absolute).TrimEnd('\')
  if ($absolute.TrimEnd('\') -eq $volume) {
    throw 'SecureRoot debe ser una carpeta, no la raíz de la unidad.'
  }
  if ($volume -notmatch '^[A-Za-z]:$' -or -not (Get-Command Get-BitLockerVolume -ErrorAction SilentlyContinue)) {
    throw 'Se requiere unidad local de Windows con BitLocker verificable.'
  }
  try {
    $v = Get-BitLockerVolume -MountPoint $volume -ErrorAction Stop
    if ([string]$v.ProtectionStatus -ne 'On') {
      throw 'BitLocker no está activo en la unidad de destino.'
    }
  } catch {
    throw 'No se pudo verificar BitLocker activo en el destino. No se copiarán fotografías.'
  }
  return $absolute
}
function Get-RemoteRoot {
  $result = & railway ssh -p $project -e $environment -s $service -- printenv SEMSE_STORAGE_ROOT
  Assert-Exit 'Consulta de SEMSE_STORAGE_ROOT'
  $value = ([string]($result | Select-Object -Last 1)).Trim()
  if ($value -notmatch '^/data/[A-Za-z0-9._/-]+$' -or $value.Contains('/../')) {
    throw 'La ruta de originales no pertenece al montaje /data o está ausente.'
  }
  return $value.TrimEnd('/')
}
function Get-RemoteManifest([string]$JsPath, [string]$Reference, [string]$Destination) {
  # Streaming source code to node's stdin avoids writing ANY file on the API service.
  # Inventory JS supports node --input-type=module - REFERENCE (argv[1] is "-").
  $source = Get-Content -LiteralPath $JsPath -Raw -Encoding UTF8
  $output = $source | & ssh -T $aliasName node --input-type=module - $Reference
  Assert-Exit 'Inventario SSH'
  $json = [string]::Join($nl,[string[]]@($output))
  $manifest = $json | ConvertFrom-Json -ErrorAction Stop
  if ($manifest.schema -ne 'semse-originals-manifest-v1' -or
      $manifest.backupReference -ne $Reference -or @($manifest.files).Count -lt 1) {
    throw 'Manifest vacío o inválido.'
  }
  [System.IO.File]::WriteAllText($Destination,$json + $nl,$utf8)
  return @($manifest.files).Count
}

Assert-Command 'railway'
Assert-Command 'ssh'
Assert-Command 'scp'
Assert-Command 'node'
$folder = Resolve-ProjectFolder
$inventory = Join-Path $folder 'scripts\field-memory-source-inventory.mjs'
$gate = Join-Path $folder 'scripts\field-memory-custody-gate.mjs'
if (-not (Test-Path -LiteralPath $gate -PathType Leaf)) {
  throw 'Falta el gate de recuperación. Actualiza el repositorio para incluir PR #914.'
}
$major = & node -p "Number(process.versions.node.split('.')[0])"
Assert-Exit 'Versión de Node'
if ([int]$major -lt 20) { throw 'Se requiere Node.js 20 o superior.' }

Write-Host 'SEMSE — verificación de custodia de originales (Railway producción, SOLO LECTURA)'
$root = Get-RemoteRoot
Write-Host "SEMSE_STORAGE_ROOT: $root"
if ($Mode -eq 'Preflight') {
  & railway ssh config -p $project -e $environment -s $service --alias $aliasName --dry-run | Out-Null
  Assert-Exit 'Previsualización de configuración SSH'
  Write-Host 'Preflight completado. NO se han copiado fotografías.'
  exit 0
}
if (-not $UploadsQuiescedConfirmed) {
  throw 'Falta confirmar suspensión efectiva de nuevas subidas durante toda la exportación.'
}
if (-not $SecureRoot) { throw 'SecureRoot es obligatorio para exportación.' }
$destination = Assert-EncryptedLocation $SecureRoot
if (-not (Test-Path -LiteralPath $destination -PathType Container)) {
  throw 'Crea primero SecureRoot en la unidad cifrada y vuelve a intentarlo.'
}
& railway ssh config -p $project -e $environment -s $service --alias $aliasName
Assert-Exit 'Configuración local de alias SSH'
$viaAlias = & ssh -T $aliasName printenv SEMSE_STORAGE_ROOT
Assert-Exit 'Verificación de la misma instancia SSH'
if (([string]($viaAlias | Select-Object -Last 1)).TrimEnd('/') -ne $root) {
  throw 'La ruta de originales no coincide entre Railway CLI y SSH.'
}

$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$reference = 'offsite-' + $stamp + '-' + [Guid]::NewGuid().ToString('N').Substring(0,12)
$session = Join-Path $destination $reference
New-Item -Path $session -ItemType Directory -ErrorAction Stop | Out-Null
$exportDir = Join-Path $session 'export'
$isolatedDir = Join-Path $session 'isolated'
New-Item -Path $exportDir -ItemType Directory | Out-Null
New-Item -Path $isolatedDir -ItemType Directory | Out-Null
$before = Join-Path $session 'manifest-before.json'
$after = Join-Path $session 'manifest-after.json'
$reportFile = Join-Path $session 'custody-gate-report.json'
Write-Host 'Generando inventario inicial (solo lectura)...'
$initialCount = Get-RemoteManifest $inventory $reference $before
Write-Host "Inicial: $initialCount originales."
Write-Host 'Descargando al disco cifrado (sin modificar el volumen original)...'
$remoteSpec = ('{0}:{1}/.' -f $aliasName,$root)
& scp -r $remoteSpec $exportDir
Assert-Exit 'Copia SCP'
Write-Host 'Generando inventario final (solo lectura)...'
$finalCount = Get-RemoteManifest $inventory $reference $after
Write-Host "Final: $finalCount originales."
Write-Host 'Ejecutando la puerta única de consistencia y restauración aislada...'
$out = & node $gate --before $before --after $after --export-root $exportDir --isolated-parent $isolatedDir --confirm-encrypted-destination --confirm-quiescent-export
Assert-Exit 'Gate de recuperación'
$result = [string]::Join($nl,[string[]]@($out))
$parsed = $result | ConvertFrom-Json -ErrorAction Stop
if ($parsed.result -ne 'OFFSITE_RESTORE_PASS' -or $parsed.filesRestored -lt 1 -or $parsed.missingFiles -ne 0 -or $parsed.alteredFiles -ne 0 -or $parsed.unexpectedFiles -ne 0 -or $parsed.captureSessionActivationPermitted -ne $false) {
  throw 'Recuperación no verificada. CAP-1 sigue BLOQUEADO.'
}
[System.IO.File]::WriteAllText($reportFile,$result+$nl,$utf8)
Write-Host "OFFSITE_RESTORE_PASS: $($parsed.filesRestored) originales íntegros en ensayo aislado."
Write-Host "Reporte agregado PRIVADO: $reportFile"
Write-Host 'NO equivale a restauración de snapshot Railway ni a reconciliación Evidence/Postgres.'
Write-Host 'CaptureSession permanece INACTIVO; no publiques fotos/manifiestos en GitHub o chat.'

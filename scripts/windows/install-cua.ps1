param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$ResolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$InstallerPath = Join-Path $env:TEMP 'install-cua-driver.ps1'
$env:CUA_DRIVER_RS_INSTALL_DIR = Join-Path $ResolvedRoot '.tools\cua-driver'
$env:CUA_DRIVER_RS_HOME = Join-Path $ResolvedRoot '.tools\cua-home'
$env:CUA_TELEMETRY_DISABLED = '1'

Invoke-WebRequest -UseBasicParsing -Uri 'https://cua.ai/driver/install.ps1' -OutFile $InstallerPath
try {
  & $InstallerPath -NoAutoStart -NoPathUpdate
  $Driver = Join-Path $env:CUA_DRIVER_RS_INSTALL_DIR 'cua-driver.exe'
  if (-not (Test-Path $Driver)) {
    throw "Cua Driver installer completed without creating $Driver"
  }
  & $Driver --version
} finally {
  Remove-Item $InstallerPath -Force -ErrorAction SilentlyContinue
}

exit 0

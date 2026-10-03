$ErrorActionPreference = 'Stop'
$Destination = Join-Path (Get-Location) 'windows-playwright-evidence.zip'

if (Test-Path $Destination) {
  Remove-Item $Destination -Force
}

Compress-Archive `
  -Path 'test-results', 'artifacts\live\playwright-results.json' `
  -DestinationPath $Destination `
  -Force

Write-Output $Destination


param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot,

  [Parameter(Mandatory = $true)]
  [ValidateSet('install', 'platform', 'unit', 'playwright', 'start')]
  [string]$Action
)

$ErrorActionPreference = 'Stop'
$ResolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$NodeDir = Join-Path $ResolvedRoot '.tools\node'
$Node = Join-Path $NodeDir 'node.exe'
$Npm = Join-Path $NodeDir 'npm.cmd'
$env:Path = "$NodeDir;$env:Path"
Set-Location -LiteralPath $ResolvedRoot

switch ($Action) {
  'install' {
    & $Npm ci --no-audit --no-fund
  }
  'platform' {
    & $Node -p 'JSON.stringify({platform:process.platform,arch:process.arch,node:process.version})'
  }
  'unit' {
    & $Node --test 'tests\unit.test.cjs'
  }
  'playwright' {
    $env:EXPECTED_PLATFORM = 'win32'
    $env:CI = '1'
    & $Node 'node_modules\@playwright\test\cli.js' test
  }
  'start' {
    & (Join-Path $ResolvedRoot 'node_modules\electron\dist\electron.exe') .
  }
}

exit $LASTEXITCODE


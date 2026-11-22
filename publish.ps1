param(
  [Parameter(Mandatory = $true)]
  [string]$Message
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

$git = (Get-Command git.exe -ErrorAction SilentlyContinue).Source
if (-not $git) {
  foreach ($c in @(
    'C:\Program Files\Git\cmd\git.exe',
    'C:\Program Files (x86)\Git\cmd\git.exe',
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe",
    "$env:USERPROFILE\tools\PortableGit\cmd\git.exe"
  )) {
    if (Test-Path $c) { $git = $c; break }
  }
}
if (-not $git) { throw 'git.exe not found in PATH or any known install location.' }

& $git add -A
if ($LASTEXITCODE -ne 0) { throw 'git add failed' }

$staged = & $git diff --cached --name-only
if (-not $staged) {
  Write-Host 'No changes to publish.'
  exit 0
}

& $git commit -m $Message
if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }

& $git push origin main
if ($LASTEXITCODE -ne 0) { throw 'git push failed' }

Write-Host 'Pushed to GitHub main. Hostinger deployment will start automatically.'
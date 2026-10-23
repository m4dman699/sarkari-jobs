param(
  [Parameter(Mandatory = $true)]
  [string]$Message
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

$git = 'git'
if (-not (Get-Command $git -ErrorAction SilentlyContinue)) {
  $candidate = 'C:\Users\Arun\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe'
  if (Test-Path $candidate) { $git = $candidate } else { throw 'git.exe not found' }
}

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
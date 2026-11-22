$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logDir = Join-Path $env:LOCALAPPDATA 'SarkariJobsPlus'
$logFile = Join-Path $logDir 'sync.log'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Write-Log([string]$Message) {
  Add-Content -LiteralPath $logFile -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz') $Message"
}

function Resolve-Git {
  # Prefer PATH, then the per-machine install, then the portable copy kept under
  # the operator's user profile so the scheduled task works even when PATH is
  # stripped (as it is for the SarkariJobsPlus GitHub Sync task).
  $candidates = @()
  $onPath = Get-Command git.exe -ErrorAction SilentlyContinue
  if ($onPath) { $candidates += $onPath.Source }
  $candidates += @(
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files (x86)\Git\cmd\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe",
    "$env:USERPROFILE\tools\PortableGit\cmd\git.exe"
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  throw 'git.exe not found in PATH or any known install location.'
}

try {
  $git = Resolve-Git
  $env:GIT_TERMINAL_PROMPT = '0'
  $dirty = & $git -C $repo status --porcelain
  if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the local Git worktree.' }
  if ($dirty) {
    Write-Log 'Skipped sync because the Desktop checkout contains local changes. No files were overwritten.'
    exit 0
  }

  & $git -C $repo fetch --prune origin main
  if ($LASTEXITCODE -ne 0) { throw 'GitHub fetch failed.' }
  & $git -C $repo merge --ff-only origin/main
  if ($LASTEXITCODE -ne 0) { throw 'Fast-forward sync failed; local branch was left unchanged.' }
  Write-Log 'Desktop checkout synced to origin/main.'
} catch {
  Write-Log "Sync failed: $($_.Exception.Message)"
  exit 1
}
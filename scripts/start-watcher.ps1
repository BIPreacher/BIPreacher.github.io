$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$stateDirectory = Join-Path $projectDirectory '.blog-sync'
New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null
$lockFile = Join-Path $stateDirectory 'sync.lock'
if (Test-Path -LiteralPath $lockFile) {
  $watcherProcessId = [int](Get-Content -LiteralPath $lockFile -Raw)
  $watcherProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$watcherProcessId"
  if ($watcherProcess -and $watcherProcess.CommandLine.Contains((Join-Path $PSScriptRoot 'sync.mjs'))) {
    Write-Output 'Blog watcher is already running.'
    return
  }
}
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
$watcherScript = Join-Path $PSScriptRoot 'sync.mjs'
$watcherArguments = '"' + $watcherScript + '" --watch'
Start-Process -FilePath $nodeExecutable -ArgumentList $watcherArguments -WorkingDirectory $projectDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateDirectory 'watcher.log') -RedirectStandardError (Join-Path $stateDirectory 'watcher-error.log')

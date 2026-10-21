$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$lockFile = Join-Path $projectDirectory '.blog-sync/sync.lock'
if (Test-Path -LiteralPath $lockFile) {
  $watcherProcessId = [int](Get-Content -LiteralPath $lockFile -Raw)
  $watcherProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$watcherProcessId"
  if ($watcherProcess -and $watcherProcess.CommandLine.Contains((Join-Path $PSScriptRoot 'sync.mjs'))) {
    Stop-Process -Id $watcherProcessId
    Remove-Item -LiteralPath $lockFile
    Write-Output 'Blog watcher stopped. Login shortcut remains installed.'
  }
}

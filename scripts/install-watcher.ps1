$ErrorActionPreference = 'Stop'
$watcherScript = Join-Path $PSScriptRoot 'start-watcher.ps1'
$startupDirectory = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDirectory 'DailyThoughtsBlog.lnk'
$windowsShell = New-Object -ComObject WScript.Shell
$shortcut = $windowsShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = (Get-Command powershell.exe).Source
$shortcut.Arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $watcherScript + '"'
$shortcut.WorkingDirectory = Split-Path -Parent $PSScriptRoot
$shortcut.WindowStyle = 7
$shortcut.Save()
& $watcherScript
Write-Output "Blog watcher started. Login shortcut: $shortcutPath"

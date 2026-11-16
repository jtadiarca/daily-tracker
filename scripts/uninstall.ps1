<#
.SYNOPSIS
  Removes Daily Task Tracker from this Windows machine.

.DESCRIPTION
  Undoes what setup.cmd / setup.ps1 set up:
  1. Removes the startup shortcut that opens the app at sign-in.
  2. Stops and removes the DailyTaskTracker Windows service (asks for administrator permission).
  3. Deletes the service logs in %ProgramData%\DailyTaskTracker.
  4. Deletes the installed packages (node_modules) and the build output (dist).
  5. Optionally uninstalls NSSM, the service helper setup installed, when no other service uses it.
  6. Optionally deletes the whole project folder.

  It does not uninstall Git or Node.js, which other programs may use, and it does not change the PowerShell
  execution policy back. Your tasks are stored in the browser, not in the project folder: see the end of
  the script's output for how to remove the installed app and its data from the browser.

.PARAMETER Yes
  Do not ask to confirm the uninstall (the optional steps still need their own switches).

.PARAMETER RemoveNssm
  Also uninstall NSSM (skipped if another service still uses it).

.PARAMETER DeleteProject
  Also delete the project folder this script belongs to, once this window closes.

.EXAMPLE
  .\uninstall.cmd

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\uninstall.ps1 -Yes -RemoveNssm
#>
[CmdletBinding()]
param(
  [switch]$Yes,
  [switch]$RemoveNssm,
  [switch]$DeleteProject,
  [switch]$Elevated,
  [switch]$ServiceOnly
)

$ErrorActionPreference = 'Stop'
$ServiceName = 'DailyTaskTracker'
$LogDir = Join-Path $env:ProgramData 'DailyTaskTracker'
$ProjectDir = Split-Path -Parent $PSScriptRoot

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  return ([Security.Principal.WindowsPrincipal]$id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ask([string]$question) {
  $answer = Read-Host "$question (y/N)"
  return $answer -match '^(y|yes)$'
}

# Same search as setup.ps1: NSSM on PATH, from winget, or in the usual install folders.
function Find-Nssm {
  $cmd = Get-Command nssm -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $roots = @("$env:LOCALAPPDATA\Microsoft\WinGet\Packages", "$env:ProgramFiles\nssm", "${env:ProgramFiles(x86)}\nssm", "$env:ProgramData\chocolatey\bin")
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    $hit = Get-ChildItem -Path $root -Recurse -Filter 'nssm.exe' -ErrorAction SilentlyContinue |
      Sort-Object { $_.FullName -notmatch 'win64' } | Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  return $null
}

function Get-StartupShortcut { return (Join-Path ([Environment]::GetFolderPath('Startup')) 'Daily Task Tracker.lnk') }

# The part that needs administrator rights: the service, its logs and NSSM.
function Remove-AdminParts {
  Step "Removing the $ServiceName service"
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if (-not $svc) {
    Ok 'The service is not installed.'
  } else {
    $nssm = Find-Nssm
    if ($nssm) {
      $appDir = (& $nssm get $ServiceName AppDirectory 2>$null | Out-String).Trim()
      if ($appDir -and $ProjectDir -and ($appDir.TrimEnd('\') -ne $ProjectDir.TrimEnd('\'))) {
        Warn "Note: the service was serving a copy of the app in $appDir"
      }
      & $nssm stop $ServiceName 2>&1 | Out-Null
      & $nssm remove $ServiceName confirm 2>&1 | Out-Null
    } else {
      Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
      & sc.exe delete $ServiceName | Out-Null
    }
    # Windows can take a moment to let go of a deleted service.
    for ($i = 0; $i -lt 10 -and (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Milliseconds 500 }
    if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
      Warn 'The service is marked for removal and will disappear after a restart.'
    } else {
      Ok 'Removed the service. Nothing is served on http://localhost:4173 any more.'
    }
  }

  Step 'Deleting the service logs'
  if (Test-Path $LogDir) {
    Remove-Item -LiteralPath $LogDir -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $LogDir) { Warn "Could not delete $LogDir completely. Delete it by hand after a restart." }
    else { Ok "Deleted $LogDir" }
  } else {
    Ok 'There are no service logs.'
  }

  if ($RemoveNssm) {
    Step 'Uninstalling NSSM'
    $others = @(Get-CimInstance Win32_Service -ErrorAction SilentlyContinue | Where-Object { $_.PathName -match 'nssm' -and $_.Name -ne $ServiceName })
    if ($others.Count -gt 0) {
      Warn "Kept NSSM because other services still use it: $(($others | ForEach-Object Name) -join ', ')"
    } elseif (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
      Warn 'winget was not found, so NSSM was left in place.'
    } else {
      & winget uninstall --id NSSM.NSSM -e --source winget --accept-source-agreements 2>&1 | Out-Host
      if ($LASTEXITCODE -eq 0) { Ok 'Uninstalled NSSM.' }
      else { Warn 'winget could not uninstall NSSM (it may not have been installed with winget). You can leave it; it does nothing on its own.' }
    }
  }
}

$script:failed = $false
try {
  # Elevated helper started below: do only the administrator part, then return.
  if ($ServiceOnly) {
    if (-not (Test-Admin)) { throw 'This step needs administrator rights.' }
    Remove-AdminParts
    return
  }

  # Run from outside the project folder so it can be deleted.
  Set-Location $env:TEMP

  Write-Host 'Daily Task Tracker uninstaller' -ForegroundColor Cyan
  Write-Host "Project folder: $ProjectDir"
  Write-Host ''
  Write-Host 'This removes the startup shortcut, the DailyTaskTracker Windows service, its logs,'
  Write-Host 'and the installed packages and build output (node_modules, dist) in the project folder.'
  Write-Host 'Git and Node.js stay installed.'
  Write-Host ''
  Warn 'Your tasks live in the browser, not in these files. If you plan to delete the browser data too,'
  Warn 'export a backup first (Settings > Backup, or Save to Google Drive).'
  Write-Host ''
  if (-not $Yes -and -not (Ask 'Uninstall Daily Task Tracker from this PC?')) { Write-Host 'Nothing was changed.'; return }

  if (-not $Yes) {
    if (-not $RemoveNssm) { $RemoveNssm = [switch](Ask 'Also uninstall NSSM, the service helper setup installed? It is kept if anything else uses it.') }
    if (-not $DeleteProject) { $DeleteProject = [switch](Ask "Also delete the whole project folder ($ProjectDir)?") }
  }

  # Deleting the project throws away work that isn't on GitHub, so say so and confirm once more.
  if ($DeleteProject -and (Test-Path (Join-Path $ProjectDir '.git')) -and (Get-Command git -ErrorAction SilentlyContinue)) {
    $dirty = & git -C $ProjectDir status --porcelain 2>$null
    $ahead = & git -C $ProjectDir rev-list --count '@{u}..HEAD' 2>$null
    if ($dirty -or ($ahead -and [int]$ahead -gt 0)) {
      Warn 'The project folder has changes that are not on GitHub (uncommitted files or commits not pushed).'
      $typed = Read-Host 'Type DELETE to delete it anyway, or press Enter to keep the folder'
      if ($typed -ne 'DELETE') { $DeleteProject = [switch]$false; Ok 'The project folder will be kept.' }
    }
  }

  Step 'Removing the startup shortcut'
  $lnk = Get-StartupShortcut
  if (Test-Path $lnk) { Remove-Item -LiteralPath $lnk -Force; Ok "Removed $lnk" }
  else { Ok 'There is no startup shortcut.' }
  Warn 'If the app window is open now, close it.'

  if (Test-Admin) {
    Remove-AdminParts
  } else {
    Step 'Asking Windows for administrator permission (needed to remove the service)'
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-ServiceOnly', '-Elevated')
    if ($RemoveNssm) { $argList += '-RemoveNssm' }
    try {
      $p = Start-Process -FilePath (Get-Process -Id $PID).Path -ArgumentList $argList -Verb RunAs -Wait -PassThru
      if ($p.ExitCode -ne 0) { Warn 'The administrator step reported a problem (see its window).' }
    } catch {
      Warn 'Administrator permission was not given, so the service and its logs were left in place.'
      Warn 'Run uninstall.cmd again and choose Yes when Windows asks.'
    }
  }

  if ($DeleteProject) {
    Step 'Deleting the project folder'
    # This window (and the uninstall.cmd running in it) is inside the folder, so wait for it to close first.
    $parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId
    $cleanup = "Wait-Process -Id $parent -Timeout 1800 -ErrorAction SilentlyContinue; Start-Sleep 1; Remove-Item -LiteralPath '$($ProjectDir -replace "'", "''")' -Recurse -Force -ErrorAction SilentlyContinue"
    Start-Process -FilePath (Get-Process -Id $PID).Path -WorkingDirectory $env:TEMP -WindowStyle Hidden `
      -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $cleanup)
    Ok 'The project folder will be deleted as soon as you close this window.'
  } else {
    Step 'Deleting installed packages and build output'
    foreach ($name in 'node_modules', 'dist') {
      $path = Join-Path $ProjectDir $name
      if (Test-Path $path) {
        Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path $path) { Warn "Could not delete all of $path (a file may be in use). Delete it by hand." }
        else { Ok "Deleted $path" }
      }
    }
    Ok "The source code is still in $ProjectDir. Run setup.cmd to install again."
  }

  Write-Host "`nDone. To also remove the app and your tasks from the browser:" -ForegroundColor Green
  Write-Host '    1. If you installed it as an app: open it, then use the menu (three dots) > Uninstall Daily Task Tracker.'
  Write-Host '       Tick "Also clear data" only if you have a backup or no longer need your tasks.'
  Write-Host '    2. Or remove just the data: in Chrome or Edge go to Settings > Privacy > Site settings > View data,'
  Write-Host '       search for localhost:4173 and delete it. This deletes your tasks on this PC.'
} catch {
  Write-Host "`nUninstall stopped: $($_.Exception.Message)" -ForegroundColor Red
  $script:failed = $true
} finally {
  if ($Elevated) { Read-Host 'Press Enter to close this window' | Out-Null }
}
if ($script:failed) { exit 1 }

<#
.SYNOPSIS
  Sets up Daily Task Tracker on a new Windows machine.

.DESCRIPTION
  1. Lets your user account run local PowerShell scripts (RemoteSigned), so npm works in PowerShell.
  2. Installs Git and Node.js LTS with winget if they are missing or too old.
  3. Clones the project (or updates it), installs dependencies and runs the tests.
  4. Starts the development server, or with -Service installs a Windows service that serves the built app at boot.
  5. With -AutoOpen, adds a startup shortcut that opens the app at login so reminders can fire.

.PARAMETER Dir
  Where to put the project when it is not already on disk. Default: a daily-tracker folder in your home folder.

.PARAMETER RepoUrl
  Git address to clone from.

.PARAMETER SkipTests
  Do not run the test suite.

.PARAMETER Build
  Also run a production build (type-checks the whole app).

.PARAMETER NoStart
  Do not start the development server at the end.

.PARAMETER Service
  Build the app and install (or update) a Windows service named DailyTaskTracker that starts at boot and serves
  the app on http://localhost:<Port>. Needs administrator rights; the script asks for them.

.PARAMETER RemoveService
  Stop and remove the DailyTaskTracker service.

.PARAMETER Port
  Port for the service. Default: 4173.

.PARAMETER AutoOpen
  Add a shortcut to your Startup folder that opens http://localhost:<Port> as a minimized app window when you
  sign in. Reminders only fire while the app is open, so this keeps it open without you doing anything.

.PARAMETER RemoveAutoOpen
  Remove that startup shortcut.

.PARAMETER Browser
  Which browser the startup shortcut uses: Auto (Chrome if found, otherwise Edge), Chrome or Edge.
  Use the browser where you installed the app and allowed notifications.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Dir C:\dev\daily-tracker -SkipTests -NoStart

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Service -AutoOpen
#>
[CmdletBinding()]
param(
  [string]$RepoUrl = 'https://github.com/jtadiarca/daily-tracker.git',
  [string]$Dir = (Join-Path $HOME 'daily-tracker'),
  [switch]$SkipTests,
  [switch]$Build,
  [switch]$NoStart,
  [switch]$Service,
  [switch]$RemoveService,
  [ValidateRange(1024, 65535)][int]$Port = 4173,
  [switch]$AutoOpen,
  [switch]$RemoveAutoOpen,
  [ValidateSet('Auto', 'Chrome', 'Edge')][string]$Browser = 'Auto',
  [switch]$Elevated
)

$ErrorActionPreference = 'Stop'
$MinNodeMajor = 22
$ServiceName = 'DailyTaskTracker'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Have($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  return ([Security.Principal.WindowsPrincipal]$id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# A program installed during this run adds itself to PATH, but this window does not see it until PATH is reloaded.
function Update-SessionPath {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user"
}

function Get-NodeMajor {
  if (-not (Have 'node')) { return 0 }
  $v = (& node -v) -replace '^v', ''
  return [int]($v.Split('.')[0])
}

function Install-WithWinget($id, $name) {
  Warn "Installing $name with winget (Windows may ask for permission)..."
  & winget install --id $id -e --source winget --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw "winget could not install $name (exit code $LASTEXITCODE)." }
  Update-SessionPath
}

# npm.cmd avoids the "running scripts is disabled" error that blocks npm.ps1.
function Run-Npm([string[]]$NpmArgs) {
  & npm.cmd @NpmArgs
  if ($LASTEXITCODE -ne 0) { throw "npm $($NpmArgs -join ' ') failed (exit code $LASTEXITCODE)." }
}

# Runs a program and returns its exit code and output. Windows PowerShell 5.1 treats anything a program writes
# to its error output as a fatal error when $ErrorActionPreference is Stop, and NSSM reports even success there
# ("STOP: The operation completed successfully"), so relax that just for the call.
function Invoke-Native([string]$exe, [string[]]$argv) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $out = & $exe @argv 2>&1 | ForEach-Object { "$_" } | Where-Object { $_ -and $_ -ne 'System.Management.Automation.RemoteException' }
    $code = $LASTEXITCODE
  } catch {
    $out = @($_.Exception.Message); $code = -1
  } finally { $ErrorActionPreference = $old }
  # NSSM writes UTF-16, which shows up with NUL characters in between.
  return [pscustomobject]@{ Code = $code; Output = (($out -join "`n") -replace "`0", '').Trim() }
}

# Stops and deletes the service: Windows first, then NSSM, then sc.exe. Waits until it is gone.
function Stop-AndDelete-DttService($nssm) {
  Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
  for ($i = 0; $i -lt 40 -and "$((Get-Service -Name $ServiceName -ErrorAction SilentlyContinue).Status)" -eq 'Running'; $i++) { Start-Sleep -Milliseconds 500 }
  if ($nssm -and "$((Get-Service -Name $ServiceName -ErrorAction SilentlyContinue).Status)" -eq 'Running') { [void](Invoke-Native $nssm @('stop', $ServiceName)) }
  $r = $null
  if ($nssm) { $r = Invoke-Native $nssm @('remove', $ServiceName, 'confirm') }
  if (-not $nssm -or $r.Code -ne 0) { $r = Invoke-Native 'sc.exe' @('delete', $ServiceName) }
  for ($i = 0; $i -lt 20 -and (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Milliseconds 500 }
  if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    throw "The old $ServiceName service could not be removed ($($r.Output)). Close any open Services window, or restart Windows, then run this again."
  }
}

# NSSM wraps a normal program (here: node) so Windows can run it as a service.
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

function Remove-DttService {
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if (-not $svc) { Ok "The $ServiceName service is not installed."; return }
  Stop-AndDelete-DttService (Find-Nssm)
  Ok "Removed the $ServiceName service."
}

function Install-DttService {
  $nssm = Find-Nssm
  if (-not $nssm) { Install-WithWinget 'NSSM.NSSM' 'NSSM (service wrapper)'; $nssm = Find-Nssm }
  if (-not $nssm) { throw 'NSSM was installed but could not be found. Close this window, open a new administrator window and run the script again.' }

  $node = (Get-Command node).Source
  if (-not (Test-Path (Join-Path $Dir 'dist\index.html'))) { throw 'The build output dist\index.html is missing.' }
  if (-not (Test-Path (Join-Path $Dir 'node_modules\vite\bin\vite.js'))) { throw 'node_modules\vite is missing. Run npm install first.' }
  if ($Dir -match 'OneDrive') { Warn 'The project is inside a OneDrive folder. A service may not be able to read online-only files. A folder like C:\dev is safer.' }

  if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    Warn "Replacing the existing $ServiceName service..."
    Stop-AndDelete-DttService $nssm
  }

  $logDir = Join-Path $env:ProgramData 'DailyTaskTracker'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null

  # The server listens on 127.0.0.1 only, so other computers on your network cannot reach it.
  & $nssm install $ServiceName $node 'node_modules\vite\bin\vite.js' 'preview' '--host' '127.0.0.1' '--port' "$Port" '--strictPort'
  if ($LASTEXITCODE -ne 0) { throw 'NSSM could not install the service.' }
  & $nssm set $ServiceName AppDirectory $Dir | Out-Null
  & $nssm set $ServiceName DisplayName 'Daily Task Tracker' | Out-Null
  & $nssm set $ServiceName Description 'Serves the Daily Task Tracker web app on http://localhost.' | Out-Null
  & $nssm set $ServiceName Start SERVICE_AUTO_START | Out-Null
  & $nssm set $ServiceName AppStdout (Join-Path $logDir 'out.log') | Out-Null
  & $nssm set $ServiceName AppStderr (Join-Path $logDir 'error.log') | Out-Null
  & $nssm set $ServiceName AppRotateFiles 1 | Out-Null
  [void](Invoke-Native $nssm @('start', $ServiceName))

  $up = $false
  for ($i = 0; $i -lt 15 -and -not $up; $i++) {
    Start-Sleep -Seconds 1
    try { $up = ((Invoke-WebRequest -Uri "http://127.0.0.1:$Port" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) } catch { $up = $false }
  }
  if ($up) {
    Ok "The service is running. Open http://localhost:$Port"
  } else {
    Warn "The service was installed but did not answer yet. Check the logs in $logDir and run: Get-Service $ServiceName"
  }
  Write-Host "`n    It now starts automatically when Windows boots."
  Write-Host "    Logs:    $logDir"
  Write-Host "    Update:  double-click setup.cmd (it pulls the latest code and rebuilds)"
  Write-Host "    Remove:  double-click uninstall.cmd"
}

function Find-Browser([string]$pref) {
  $paths = @{
    Chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")
    Edge   = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")
  }
  $order = if ($pref -eq 'Auto') { @('Chrome', 'Edge') } else { @($pref) }
  foreach ($name in $order) {
    foreach ($p in $paths[$name]) {
      if (Test-Path $p) { return @{ Name = $name; Path = $p } }
    }
  }
  return $null
}

function Get-StartupShortcut { return (Join-Path ([Environment]::GetFolderPath('Startup')) 'Daily Task Tracker.lnk') }

# Reminders run inside the open page, so the page has to be open. This opens it at every sign-in.
function Install-AutoOpen {
  $b = Find-Browser $Browser
  if (-not $b) { throw 'Neither Chrome nor Edge was found. Install one of them, or pass -Browser to choose.' }
  if (-not (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) {
    Warn "The $ServiceName service is not installed, so http://localhost:$Port will not answer after a restart. Add -Service to install it too."
  }
  $url = "http://localhost:$Port"
  $lnk = Get-StartupShortcut
  $shell = New-Object -ComObject WScript.Shell
  $sc = $shell.CreateShortcut($lnk)
  $sc.TargetPath = $b.Path
  $sc.Arguments = "--app=$url"
  $sc.WindowStyle = 7
  $sc.Description = 'Opens Daily Task Tracker at sign-in so reminders can fire.'
  $sc.Save()
  Ok "Added a startup shortcut that opens $url in $($b.Name): $lnk"
  Write-Host "`n    Do these once:"
  Write-Host "    1. Double-click that shortcut now (press Win+R and run shell:startup to find it)."
  Write-Host "    2. In the app window open Settings, then press Turn on reminders and choose Allow."
  Write-Host "    3. In $($b.Name) settings, under Performance, add $url to the list of sites that are never put to sleep."
  Write-Host "    4. Leave the window open or minimized. Closing it stops reminders until the next sign-in."
  Write-Host "`n    Note: browsers only allow spoken reminders after you click inside the window once per sign-in."
  Write-Host "    The notification itself appears without a click. A sleeping or powered-off PC cannot show reminders."
}

function Remove-AutoOpen {
  $lnk = Get-StartupShortcut
  if (Test-Path $lnk) { Remove-Item -LiteralPath $lnk -Force; Ok 'Removed the startup shortcut.' }
  else { Ok 'There is no startup shortcut to remove.' }
}

$script:failed = $false
try {
  if (($Service -or $RemoveService) -and -not (Test-Admin)) {
    Warn 'Installing or removing a Windows service needs administrator rights. Asking Windows for permission...'
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Elevated')
    foreach ($kv in $PSBoundParameters.GetEnumerator()) {
      if ($kv.Value -is [switch]) { if ($kv.Value.IsPresent) { $argList += "-$($kv.Key)" } }
      else { $argList += "-$($kv.Key)"; $argList += "`"$($kv.Value)`"" }
    }
    Start-Process -FilePath (Get-Process -Id $PID).Path -ArgumentList $argList -Verb RunAs -Wait
    return
  }

  if ($RemoveService -or $RemoveAutoOpen) {
    if ($RemoveAutoOpen) { Step 'Removing the startup shortcut'; Remove-AutoOpen }
    if ($RemoveService) { Step "Removing the $ServiceName service"; Remove-DttService }
    return
  }

  if ($AutoOpen -and -not $Service) {
    Step 'Adding the startup shortcut'
    Install-AutoOpen
    return
  }

  Step 'Checking PowerShell script permission'
  try {
    $effective = Get-ExecutionPolicy
    if ($effective -in 'Restricted', 'AllSigned', 'Undefined') {
      Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
      Ok 'Set the execution policy for your user to RemoteSigned.'
    } else {
      Ok "Execution policy is already $effective."
    }
  } catch {
    Warn "Could not change the execution policy: $($_.Exception.Message)"
    Warn 'This script uses npm.cmd, so it can continue. If your IT department controls the policy, use Command Prompt or npm.cmd later.'
  }

  Step 'Checking winget'
  if (-not (Have 'winget')) {
    throw 'winget was not found. Install "App Installer" from the Microsoft Store, then run this script again.'
  }
  Ok 'winget is available.'

  Step 'Checking Git'
  if (-not (Have 'git')) { Install-WithWinget 'Git.Git' 'Git' }
  if (-not (Have 'git')) { throw 'Git was installed but this window cannot see it yet. Close this window, open a new one and run the script again.' }
  Ok (& git --version)

  Step "Checking Node.js (version $MinNodeMajor or newer)"
  if ((Get-NodeMajor) -lt $MinNodeMajor) { Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js LTS' }
  if ((Get-NodeMajor) -lt $MinNodeMajor) {
    throw "Node.js $MinNodeMajor or newer is required. Close this window, open a new one and run the script again, or install the LTS version from https://nodejs.org."
  }
  Ok "Node $(& node -v), npm $(& npm.cmd -v)"

  Step 'Getting the project'
  $scriptRoot = Split-Path -Parent $PSScriptRoot
  if ($scriptRoot -and (Test-Path (Join-Path $scriptRoot 'package.json'))) {
    $Dir = $scriptRoot
    Ok "Using the project this script belongs to: $Dir"
    # Bring it up to date, but never touch uncommitted work.
    if (Test-Path (Join-Path $Dir '.git')) {
      $dirty = & git -C $Dir status --porcelain
      if ($dirty) {
        Warn 'You have uncommitted changes, so the latest code was not pulled. Commit or stash them and run again to update.'
      } else {
        & git -C $Dir pull --ff-only
        if ($LASTEXITCODE -ne 0) { Warn 'git pull did not succeed (see above). Continuing with the code already on disk.' }
        else { Ok 'Pulled the latest code.' }
      }
    }
  } elseif (Test-Path (Join-Path $Dir '.git')) {
    Ok "Updating the existing copy in $Dir"
    & git -C $Dir pull
    if ($LASTEXITCODE -ne 0) { throw 'git pull failed. Fix the message above, then run the script again.' }
  } else {
    & git clone $RepoUrl $Dir
    if ($LASTEXITCODE -ne 0) { throw 'git clone failed. If the repository is private, sign in when Git asks, then run the script again.' }
  }
  Set-Location $Dir

  if (-not (& git config --global user.name)) {
    Warn 'Git does not know your name yet. Before committing, run:'
    Warn '  git config --global user.name "Your Name"'
    Warn '  git config --global user.email "you@example.com"'
  }

  Step 'Installing dependencies (npm install)'
  Warn 'npm may report 4 low-severity audit warnings (deepmerge, used only while building; no fixed version exists yet). They are expected and do not affect the app.'
  Run-Npm 'install'

  if (-not $SkipTests) {
    Step 'Running the tests'
    Run-Npm 'test'
  }

  if ($Service) {
    Step 'Building the app for the service'
    Run-Npm 'run', 'build'
    Step "Installing the $ServiceName Windows service"
    Install-DttService
    if ($AutoOpen) {
      Step 'Adding the startup shortcut'
      Install-AutoOpen
    }
    Write-Host "`nAll set. The project is in: $Dir" -ForegroundColor Green
    return
  }

  if ($Build) {
    Step 'Building the app'
    Run-Npm 'run', 'build'
  }

  Write-Host "`nAll set. The project is in: $Dir" -ForegroundColor Green
  if ($NoStart) {
    Write-Host 'Start it later with:  npm run dev'
    return
  }

  Step 'Starting the app (press Ctrl+C to stop)'
  & npm.cmd run dev -- --open
} catch {
  Write-Host "`nSetup stopped: $($_.Exception.Message)" -ForegroundColor Red
  $script:failed = $true
} finally {
  if ($Elevated) { Read-Host 'Press Enter to close this window' | Out-Null }
}
if ($script:failed) { exit 1 }

<#
.SYNOPSIS
  Sets up Daily Task Tracker on a new Windows machine.

.DESCRIPTION
  1. Lets your user account run local PowerShell scripts (RemoteSigned), so npm works in PowerShell.
  2. Installs Git and Node.js LTS with winget if they are missing or too old.
  3. Clones the project (or updates it), installs dependencies and runs the tests.
  4. Starts the development server, or with -Service installs a Windows service that serves the built app at boot.

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

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Dir C:\dev\daily-tracker -SkipTests -NoStart

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Service
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
  [switch]$Elevated
)

$ErrorActionPreference = 'Stop'
$MinNodeMajor = 20
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
  $nssm = Find-Nssm
  if ($nssm) {
    & $nssm stop $ServiceName 2>&1 | Out-Null
    & $nssm remove $ServiceName confirm 2>&1 | Out-Null
  } else {
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    & sc.exe delete $ServiceName | Out-Null
  }
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
    & $nssm stop $ServiceName 2>&1 | Out-Null
    & $nssm remove $ServiceName confirm 2>&1 | Out-Null
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
  & $nssm start $ServiceName | Out-Null

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
  Write-Host "    Update:  git pull, then run this script again with -Service"
  Write-Host "    Remove:  run this script with -RemoveService"
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

  if ($RemoveService) {
    Step "Removing the $ServiceName service"
    Remove-DttService
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
  Warn 'npm may print audit warnings and an esbuild install-script notice. They are expected and do not stop the app.'
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

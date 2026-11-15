<#
.SYNOPSIS
  Sets up Daily Task Tracker on a new Windows machine.

.DESCRIPTION
  1. Lets your user account run local PowerShell scripts (RemoteSigned), so npm works in PowerShell.
  2. Installs Git and Node.js LTS with winget if they are missing or too old.
  3. Clones the project (or updates it), installs dependencies and runs the tests.
  4. Starts the development server.

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

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Dir C:\dev\daily-tracker -SkipTests -NoStart
#>
[CmdletBinding()]
param(
  [string]$RepoUrl = 'https://github.com/jtadiarca/daily-tracker.git',
  [string]$Dir = (Join-Path $HOME 'daily-tracker'),
  [switch]$SkipTests,
  [switch]$Build,
  [switch]$NoStart
)

$ErrorActionPreference = 'Stop'
$MinNodeMajor = 20

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Have($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

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

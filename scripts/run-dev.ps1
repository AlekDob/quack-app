# Run Tauri Dev with proper PATH
$ErrorActionPreference = "Stop"

# Setup PATH
$env:Path = "C:\Program Files\nodejs;" + $env:USERPROFILE + "\.cargo\bin;" + [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

Write-Host ""
Write-Host "Quack Development Server (Windows)" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Verify
Write-Host "Node.js:" (& "C:\Program Files\nodejs\node.exe" --version) -ForegroundColor Green
Write-Host "npm:" (& "C:\Program Files\nodejs\npm.cmd" --version) -ForegroundColor Green
Write-Host "Cargo:" (& "$env:USERPROFILE\.cargo\bin\cargo.exe" --version) -ForegroundColor Green
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    & "C:\Program Files\nodejs\npm.cmd" install
}

# Check if tauri-cli is installed
$tauriInstalled = & "$env:USERPROFILE\.cargo\bin\cargo.exe" install --list 2>$null | Select-String "tauri-cli"
if (-not $tauriInstalled) {
    Write-Host "Installing tauri-cli..." -ForegroundColor Yellow
    & "$env:USERPROFILE\.cargo\bin\cargo.exe" install tauri-cli
}

# Install node-sdk dependencies
if (Test-Path "src-tauri/node-sdk/package.json") {
    Write-Host "Installing node-sdk dependencies..." -ForegroundColor Yellow
    Set-Location "src-tauri/node-sdk"
    & "C:\Program Files\nodejs\npm.cmd" install --production
    Set-Location $projectRoot
}

Write-Host ""
Write-Host "Starting Tauri dev..." -ForegroundColor Cyan
Write-Host ""

# Run tauri dev
& "$env:USERPROFILE\.cargo\bin\cargo.exe" tauri dev

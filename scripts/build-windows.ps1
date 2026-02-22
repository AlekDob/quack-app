# Quack Windows Build Script
# Run with: powershell -ExecutionPolicy Bypass -File scripts/build-windows.ps1

param(
    [switch]$Debug,
    [switch]$SkipOptimize
)

$ErrorActionPreference = "Stop"

# Function to check if a command exists
function Test-Command($Command) {
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        if (Get-Command $Command) { return $true }
    }
    catch { return $false }
    finally { $ErrorActionPreference = $oldPreference }
}

# Ensure we're in the project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Quack Windows Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Add Cargo to PATH if not already there
$cargoPath = "$env:USERPROFILE\.cargo\bin"
if (Test-Path $cargoPath) {
    if ($env:Path -notlike "*$cargoPath*") {
        $env:Path = "$cargoPath;$env:Path"
    }
}

# Verify prerequisites
$missingDeps = @()

if (-not (Test-Command "node")) {
    $missingDeps += "Node.js"
}
if (-not (Test-Command "npm")) {
    $missingDeps += "npm"
}
if (-not (Test-Command "cargo")) {
    $missingDeps += "Rust/Cargo"
}

if ($missingDeps.Count -gt 0) {
    Write-Host "ERROR: Missing dependencies: $($missingDeps -join ', ')" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run setup first:" -ForegroundColor Yellow
    Write-Host "  .\scripts\setup-windows.ps1" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Display versions
Write-Host "Build environment:" -ForegroundColor Yellow
Write-Host "  Node.js: $(node --version)" -ForegroundColor White
Write-Host "  npm: $(npm --version)" -ForegroundColor White
Write-Host "  Cargo: $(cargo --version)" -ForegroundColor White
Write-Host ""

# Set production environment
$env:NODE_ENV = "production"

# Load .env if present (for Rust compile-time variables like GUMROAD_PRODUCT_ID)
$envFile = Join-Path $projectRoot ".env"
if (Test-Path $envFile) {
    Write-Host "Loading .env file..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        $line = $_ -replace '^export\s+', ''
        if ($line -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim() -replace '^["'']|["'']$', ''
            [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "  Done" -ForegroundColor Green
}

# Step 0: Clean previous build artifacts
Write-Host ""
Write-Host "[0/4] Cleaning previous build artifacts..." -ForegroundColor Yellow

# Kill any running app.exe from previous builds
$appProcess = Get-Process -Name "app" -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like "*quack-app*"
}
if ($appProcess) {
    Write-Host "  Stopping running Quack instance (PID: $($appProcess.Id))..." -ForegroundColor Yellow
    $appProcess | Stop-Process -Force
    Start-Sleep -Seconds 1
}

# Remove previous bundle output
$bundlePath = Join-Path $projectRoot "src-tauri\target\release\bundle"
if (Test-Path $bundlePath) {
    Write-Host "  Removing previous bundle directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $bundlePath
}

# Remove previous exe to avoid access denied errors
$exePath = Join-Path $projectRoot "src-tauri\target\release\app.exe"
if (Test-Path $exePath) {
    Write-Host "  Removing previous app.exe..." -ForegroundColor Yellow
    Remove-Item -Force $exePath
}

Write-Host "  Done" -ForegroundColor Green

# Step 1: Prepare node-sdk
Write-Host "[1/4] Preparing node-sdk..." -ForegroundColor Yellow
Set-Location "src-tauri/node-sdk"
npm install --production
Set-Location $projectRoot
Write-Host "  Done" -ForegroundColor Green

# Step 2: TypeScript compilation
Write-Host ""
Write-Host "[2/4] Compiling TypeScript..." -ForegroundColor Yellow
npx tsc -b
Write-Host "  Done" -ForegroundColor Green

# Step 3: Vite build
Write-Host ""
Write-Host "[3/4] Building frontend with Vite..." -ForegroundColor Yellow
npx vite build --minify esbuild
Write-Host "  Done" -ForegroundColor Green

# Step 4: Tauri build
Write-Host ""
Write-Host "[4/4] Building Tauri application..." -ForegroundColor Yellow

if ($Debug) {
    Write-Host "  Building in DEBUG mode..." -ForegroundColor Yellow
    cargo tauri build --debug --config '{\"build\":{\"beforeBundleCommand\":\"\"}}'
} else {
    Write-Host "  Building in RELEASE mode..." -ForegroundColor Yellow
    cargo tauri build --config '{\"build\":{\"beforeBundleCommand\":\"\"}}'
}

Write-Host "  Done" -ForegroundColor Green

# Step 5: Optimize bundle (optional)
if (-not $SkipOptimize -and -not $Debug) {
    Write-Host ""
    Write-Host "[5/5] Optimizing bundle..." -ForegroundColor Yellow
    & "$scriptPath\optimize-bundle-windows.ps1"
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Find the built installer
$installerPath = "src-tauri/target/release/bundle"

if (Test-Path "$installerPath/msi") {
    $msiFile = Get-ChildItem "$installerPath/msi/*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($msiFile) {
        $msiSize = [math]::Round($msiFile.Length / 1MB, 2)
        Write-Host "MSI Installer:" -ForegroundColor Cyan
        Write-Host "  Path: $($msiFile.FullName)" -ForegroundColor White
        Write-Host "  Size: ${msiSize} MB" -ForegroundColor White
    }
}

if (Test-Path "$installerPath/nsis") {
    $nsisFile = Get-ChildItem "$installerPath/nsis/*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($nsisFile) {
        $nsisSize = [math]::Round($nsisFile.Length / 1MB, 2)
        Write-Host ""
        Write-Host "NSIS Installer:" -ForegroundColor Cyan
        Write-Host "  Path: $($nsisFile.FullName)" -ForegroundColor White
        Write-Host "  Size: ${nsisSize} MB" -ForegroundColor White
    }
}

Write-Host ""

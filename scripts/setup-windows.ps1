# Quack Windows Setup Script
# Run with: powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Quack Windows Development Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a command exists
function Test-Command($Command) {
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'stop'
    try {
        if (Get-Command $Command) { return $true }
    }
    catch { return $false }
    finally { $ErrorActionPreference = $oldPreference }
}

# Function to refresh PATH
function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# ============================================
# 1. Check/Install Node.js
# ============================================
Write-Host "[1/5] Checking Node.js..." -ForegroundColor Yellow

if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Host "  Node.js already installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  Node.js not found. Installing via winget..." -ForegroundColor Yellow

    if (Test-Command "winget") {
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        Refresh-Path

        if (Test-Command "node") {
            $nodeVersion = node --version
            Write-Host "  Node.js installed: $nodeVersion" -ForegroundColor Green
        } else {
            Write-Host "  ERROR: Node.js installation failed. Please install manually from https://nodejs.org" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  ERROR: winget not available. Please install Node.js manually from https://nodejs.org" -ForegroundColor Red
        Write-Host "  After installing, run this script again." -ForegroundColor Yellow
        exit 1
    }
}

# ============================================
# 2. Check/Install Rust
# ============================================
Write-Host ""
Write-Host "[2/5] Checking Rust..." -ForegroundColor Yellow

if (Test-Command "rustc") {
    $rustVersion = rustc --version
    Write-Host "  Rust already installed: $rustVersion" -ForegroundColor Green
} else {
    Write-Host "  Rust not found. Installing via rustup..." -ForegroundColor Yellow

    # Download and run rustup-init
    $rustupUrl = "https://win.rustup.rs/x86_64"
    $rustupPath = "$env:TEMP\rustup-init.exe"

    Write-Host "  Downloading rustup-init.exe..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $rustupUrl -OutFile $rustupPath

    Write-Host "  Running rustup-init (this may take a few minutes)..." -ForegroundColor Cyan
    & $rustupPath -y --default-toolchain stable

    # Add cargo to PATH for current session
    $cargoPath = "$env:USERPROFILE\.cargo\bin"
    $env:Path = "$cargoPath;$env:Path"

    if (Test-Command "rustc") {
        $rustVersion = rustc --version
        Write-Host "  Rust installed: $rustVersion" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: Rust installation failed." -ForegroundColor Red
        Write-Host "  Please install manually from https://rustup.rs" -ForegroundColor Yellow
        exit 1
    }
}

# ============================================
# 3. Check/Install Visual Studio Build Tools
# ============================================
Write-Host ""
Write-Host "[3/5] Checking Visual Studio Build Tools..." -ForegroundColor Yellow

$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasBuildTools = $false

if (Test-Path $vsWhere) {
    $vsPath = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($vsPath) {
        $hasBuildTools = $true
        Write-Host "  Visual Studio Build Tools found at: $vsPath" -ForegroundColor Green
    }
}

if (-not $hasBuildTools) {
    Write-Host "  Visual Studio Build Tools not found." -ForegroundColor Yellow
    Write-Host "  Installing via winget..." -ForegroundColor Cyan

    if (Test-Command "winget") {
        winget install Microsoft.VisualStudio.2022.BuildTools --accept-package-agreements --accept-source-agreements
        Write-Host "  Build Tools installation started. You may need to complete setup in the Visual Studio Installer." -ForegroundColor Yellow
        Write-Host "  Make sure to select 'Desktop development with C++' workload." -ForegroundColor Yellow
    } else {
        Write-Host "  WARNING: Please install Visual Studio Build Tools manually." -ForegroundColor Yellow
        Write-Host "  Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor Yellow
        Write-Host "  Select 'Desktop development with C++' workload during installation." -ForegroundColor Yellow
    }
}

# ============================================
# 4. Install Tauri CLI
# ============================================
Write-Host ""
Write-Host "[4/5] Installing Tauri CLI..." -ForegroundColor Yellow

if (Test-Command "cargo") {
    # Check if tauri-cli is already installed
    $tauriInstalled = cargo install --list | Select-String "tauri-cli"

    if ($tauriInstalled) {
        Write-Host "  Tauri CLI already installed" -ForegroundColor Green
    } else {
        Write-Host "  Installing tauri-cli via cargo..." -ForegroundColor Cyan
        cargo install tauri-cli
        Write-Host "  Tauri CLI installed" -ForegroundColor Green
    }
} else {
    Write-Host "  ERROR: Cargo not found. Please ensure Rust is installed correctly." -ForegroundColor Red
    exit 1
}

# ============================================
# 5. Install npm dependencies
# ============================================
Write-Host ""
Write-Host "[5/5] Installing npm dependencies..." -ForegroundColor Yellow

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

if (Test-Path "package.json") {
    Write-Host "  Running npm install..." -ForegroundColor Cyan
    npm install

    # Install node-sdk dependencies
    if (Test-Path "src-tauri/node-sdk/package.json") {
        Write-Host "  Installing node-sdk dependencies..." -ForegroundColor Cyan
        Set-Location "src-tauri/node-sdk"
        npm install --production
        Set-Location $projectRoot
    }

    Write-Host "  npm dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ERROR: package.json not found. Are you in the project root?" -ForegroundColor Red
    exit 1
}

# ============================================
# Summary
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installed versions:" -ForegroundColor Cyan

if (Test-Command "node") {
    Write-Host "  Node.js: $(node --version)" -ForegroundColor White
}
if (Test-Command "npm") {
    Write-Host "  npm: $(npm --version)" -ForegroundColor White
}
if (Test-Command "rustc") {
    Write-Host "  Rust: $(rustc --version)" -ForegroundColor White
}
if (Test-Command "cargo") {
    Write-Host "  Cargo: $(cargo --version)" -ForegroundColor White
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open a NEW terminal (to refresh PATH)" -ForegroundColor White
Write-Host "  2. Run: .\scripts\dev.ps1" -ForegroundColor White
Write-Host "     Or:  npm run dev:win" -ForegroundColor White
Write-Host ""
Write-Host "For production build:" -ForegroundColor Yellow
Write-Host "  Run: .\scripts\build-windows.ps1" -ForegroundColor White
Write-Host "  Or:  npm run tauri:build:win" -ForegroundColor White
Write-Host ""

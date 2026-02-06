# Quack Windows Dev Script
# Run with: powershell -ExecutionPolicy Bypass -File scripts/dev.ps1
# Or simply: .\scripts\dev.ps1

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
Write-Host "Quack Development Server (Windows)" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
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
Write-Host "Node.js: $(node --version)" -ForegroundColor Green
Write-Host "npm: $(npm --version)" -ForegroundColor Green
Write-Host "Cargo: $(cargo --version)" -ForegroundColor Green
Write-Host ""

# Load .env file if it exists (required for Rust compile-time variables)
$envFile = Join-Path $projectRoot ".env"
if (Test-Path $envFile) {
    Write-Host "Loading .env file..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        # Skip comments and empty lines
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        # Skip lines with 'export ' prefix (bash syntax)
        $line = $_ -replace '^export\s+', ''
        # Parse KEY=VALUE
        if ($line -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove surrounding quotes if present
            $value = $value -replace '^["'']|["'']$', ''
            [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "  Environment variables loaded" -ForegroundColor Green

    # Verify critical variables
    $criticalVars = @("GUMROAD_PRODUCT_ID", "SUPABASE_URL", "SUPABASE_ANON_KEY")
    foreach ($var in $criticalVars) {
        $value = [System.Environment]::GetEnvironmentVariable($var, "Process")
        if ($value) {
            Write-Host "  $var : OK" -ForegroundColor Green
        } else {
            Write-Host "  $var : NOT SET" -ForegroundColor Red
        }
    }
} else {
    Write-Host "No .env file found - some features may not work" -ForegroundColor Yellow
}
Write-Host ""

# Kill any process using port 5174
Write-Host "Checking port 5174..." -ForegroundColor Yellow
$processOnPort = Get-NetTCPConnection -LocalPort 5174 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1

if ($processOnPort) {
    Write-Host "  Killing process on port 5174 (PID: $processOnPort)..." -ForegroundColor Yellow
    Stop-Process -Id $processOnPort -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Write-Host "  Port 5174 freed" -ForegroundColor Green
} else {
    Write-Host "  Port 5174 already free" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting Tauri dev..." -ForegroundColor Cyan
Write-Host ""

# Run cargo tauri dev
cargo tauri dev

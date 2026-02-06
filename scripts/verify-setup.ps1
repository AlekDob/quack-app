# Quack Windows Setup Verification Script
# Run with: powershell -ExecutionPolicy Bypass -File scripts/verify-setup.ps1

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Quack Setup Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Function to check if a command exists
function Test-Command($Command) {
    try {
        if (Get-Command $Command -ErrorAction Stop) { return $true }
    }
    catch { return $false }
}

function Check-Tool($Name, $Command, $Required = $true) {
    Write-Host -NoNewline "  $Name`: "
    if (Test-Command $Command) {
        try {
            $version = & $Command --version 2>$null | Select-Object -First 1
            Write-Host "$version" -ForegroundColor Green
            return $true
        } catch {
            Write-Host "installed" -ForegroundColor Green
            return $true
        }
    } else {
        if ($Required) {
            Write-Host "NOT FOUND" -ForegroundColor Red
            $script:allGood = $false
        } else {
            Write-Host "not found (optional)" -ForegroundColor Yellow
        }
        return $false
    }
}

Write-Host "Required tools:" -ForegroundColor Yellow
Check-Tool "Git" "git"
Check-Tool "Node.js" "node"
Check-Tool "npm" "npm"
Check-Tool "npx" "npx"
Check-Tool "Rust" "rustc"
Check-Tool "Cargo" "cargo"

Write-Host ""
Write-Host "Optional tools:" -ForegroundColor Yellow
Check-Tool "Windows Terminal" "wt" $false
Check-Tool "Tauri CLI" "cargo-tauri" $false

# Check Visual Studio Build Tools
Write-Host -NoNewline "  VS Build Tools: "
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vsWhere) {
    $vsPath = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
    if ($vsPath) {
        Write-Host "found" -ForegroundColor Green
    } else {
        Write-Host "NOT FOUND (required for Rust)" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host "NOT FOUND (required for Rust)" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""
Write-Host "IDE/Terminals detected:" -ForegroundColor Yellow

$tools = @(
    @{ Name = "VS Code"; Path = "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" },
    @{ Name = "Cursor"; Path = "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe" },
    @{ Name = "Git Bash"; Path = "$env:ProgramFiles\Git\git-bash.exe" },
    @{ Name = "Windows Terminal"; Path = "$env:LOCALAPPDATA\Microsoft\WindowsApps\wt.exe" }
)

$foundTools = @()
foreach ($tool in $tools) {
    if (Test-Path $tool.Path) {
        $foundTools += $tool.Name
    }
}

if ($foundTools.Count -gt 0) {
    Write-Host "  $($foundTools -join ', ')" -ForegroundColor White
} else {
    Write-Host "  None" -ForegroundColor Gray
}

# Check project files
Write-Host ""
Write-Host "Project files:" -ForegroundColor Yellow

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$projectFiles = @(
    @{ Name = "package.json"; Path = "$projectRoot\package.json" },
    @{ Name = "Cargo.toml"; Path = "$projectRoot\src-tauri\Cargo.toml" },
    @{ Name = ".mcp.json"; Path = "$projectRoot\.mcp.json" },
    @{ Name = "node_modules"; Path = "$projectRoot\node_modules" }
)

foreach ($file in $projectFiles) {
    Write-Host -NoNewline "  $($file.Name): "
    if (Test-Path $file.Path) {
        Write-Host "found" -ForegroundColor Green
    } else {
        Write-Host "missing" -ForegroundColor Yellow
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "  All required tools are installed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You can start development with:" -ForegroundColor White
    Write-Host "  .\scripts\dev.ps1" -ForegroundColor Cyan
    Write-Host "  or: npm run dev:win" -ForegroundColor Cyan
} else {
    Write-Host "  Some tools are missing!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Run the setup script to install missing tools:" -ForegroundColor White
    Write-Host "  .\scripts\setup-windows.ps1" -ForegroundColor Cyan
}
Write-Host ""

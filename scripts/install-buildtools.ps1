# Install Visual Studio Build Tools with C++ workload
$ErrorActionPreference = "Continue"

Write-Host "Installing Visual Studio Build Tools..." -ForegroundColor Cyan
Write-Host "This is required for Rust compilation on Windows." -ForegroundColor Yellow
Write-Host ""

# Download VS Build Tools installer
$vsUrl = "https://aka.ms/vs/17/release/vs_BuildTools.exe"
$vsInstaller = "$env:TEMP\vs_BuildTools.exe"

Write-Host "Downloading Visual Studio Build Tools installer..."
Invoke-WebRequest -Uri $vsUrl -OutFile $vsInstaller -UseBasicParsing

Write-Host "Running installer with C++ workload..."
Write-Host "(This may take 5-10 minutes)" -ForegroundColor Yellow
Write-Host ""

# Install with C++ workload and Windows SDK
Start-Process $vsInstaller -ArgumentList `
    "--quiet", `
    "--wait", `
    "--norestart", `
    "--add", "Microsoft.VisualStudio.Workload.VCTools", `
    "--add", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", `
    "--add", "Microsoft.VisualStudio.Component.Windows11SDK.22621" `
    -Wait -Verb RunAs

Write-Host ""
Write-Host "Visual Studio Build Tools installed!" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Please restart your terminal and run:" -ForegroundColor Yellow
Write-Host "  .\scripts\run-dev.ps1" -ForegroundColor White
Write-Host ""

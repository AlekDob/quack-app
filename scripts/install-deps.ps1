# Quick dependency installer for Quack Windows
$ErrorActionPreference = "Continue"

Write-Host "Installing Node.js..." -ForegroundColor Cyan

# Download Node.js
$nodeUrl = "https://nodejs.org/dist/v22.13.1/node-v22.13.1-x64.msi"
$nodeMsi = "$env:TEMP\node-installer.msi"

Write-Host "Downloading from $nodeUrl..."
Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing

Write-Host "Running installer (requires elevation)..."
Start-Process msiexec.exe -ArgumentList "/i", "`"$nodeMsi`"", "/quiet", "/norestart" -Wait -Verb RunAs

Write-Host ""
Write-Host "Installing Rust..." -ForegroundColor Cyan

# Download rustup
$rustupUrl = "https://win.rustup.rs/x86_64"
$rustupExe = "$env:TEMP\rustup-init.exe"

Write-Host "Downloading rustup..."
Invoke-WebRequest -Uri $rustupUrl -OutFile $rustupExe -UseBasicParsing

Write-Host "Running rustup installer..."
Start-Process $rustupExe -ArgumentList "-y", "--default-toolchain", "stable" -Wait

Write-Host ""
Write-Host "Done! Please restart your terminal." -ForegroundColor Green

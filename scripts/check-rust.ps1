# Check Rust compilation
$ErrorActionPreference = "Stop"

$env:Path = "C:\Program Files\nodejs;" + $env:USERPROFILE + "\.cargo\bin;" + [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location "$projectRoot\src-tauri"

Write-Host "Checking Rust compilation..." -ForegroundColor Cyan
& "$env:USERPROFILE\.cargo\bin\cargo.exe" check 2>&1

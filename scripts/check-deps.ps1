# Check dependencies
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User") + ";C:\Program Files\nodejs;" + $env:USERPROFILE + "\.cargo\bin"

Write-Host "Checking dependencies..." -ForegroundColor Cyan
Write-Host ""

try {
    $nodeVer = & "C:\Program Files\nodejs\node.exe" --version 2>$null
    if ($nodeVer) {
        Write-Host "Node.js: $nodeVer" -ForegroundColor Green
    }
} catch {
    Write-Host "Node.js: NOT FOUND" -ForegroundColor Red
}

try {
    $npmVer = & "C:\Program Files\nodejs\npm.cmd" --version 2>$null
    if ($npmVer) {
        Write-Host "npm: $npmVer" -ForegroundColor Green
    }
} catch {
    Write-Host "npm: NOT FOUND" -ForegroundColor Red
}

$cargoPath = "$env:USERPROFILE\.cargo\bin\cargo.exe"
if (Test-Path $cargoPath) {
    $cargoVer = & $cargoPath --version 2>$null
    Write-Host "Cargo: $cargoVer" -ForegroundColor Green
} else {
    Write-Host "Cargo: NOT FOUND" -ForegroundColor Red
}

Write-Host ""

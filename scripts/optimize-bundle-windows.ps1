# Quack Bundle Optimizer for Windows
# Removes unnecessary files from Tauri bundle to reduce size

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "Quack Bundle Optimizer (Windows)" -ForegroundColor Cyan
Write-Host ""

function Optimize-Bundle {
    param(
        [string]$BundleDir,
        [string]$ArchName
    )

    if (-not (Test-Path $BundleDir)) {
        Write-Host "  Bundle directory not found: $BundleDir" -ForegroundColor Yellow
        return
    }

    Write-Host "Optimizing $ArchName bundle..." -ForegroundColor Green

    # Find the resources directory (Tauri puts resources in the bundle folder on Windows)
    $ResourcesDir = Join-Path $BundleDir "node-sdk"

    if (-not (Test-Path $ResourcesDir)) {
        # Try alternative path structure
        $ResourcesDir = Get-ChildItem -Path $BundleDir -Recurse -Directory -Filter "node-sdk" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName

        if (-not $ResourcesDir) {
            Write-Host "  node-sdk directory not found, skipping optimization" -ForegroundColor Yellow
            return
        }
    }

    # Get initial size
    $InitialSize = [math]::Round((Get-ChildItem $BundleDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB, 2)

    # 1. Remove ripgrep binaries for other platforms
    Write-Host "  -> Removing ripgrep for macOS/Linux..." -ForegroundColor White
    $RipgrepDir = Join-Path $ResourcesDir "node_modules\@anthropic-ai\claude-agent-sdk\vendor\ripgrep"
    if (Test-Path $RipgrepDir) {
        Remove-Item -Path (Join-Path $RipgrepDir "x64-darwin") -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -Path (Join-Path $RipgrepDir "arm64-darwin") -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -Path (Join-Path $RipgrepDir "x64-linux") -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -Path (Join-Path $RipgrepDir "arm64-linux") -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "    Kept: x64-win32 only" -ForegroundColor Gray
    }

    # 2. Remove JetBrains plugin (not needed for Tauri)
    Write-Host "  -> Removing JetBrains plugin..." -ForegroundColor White
    $JetBrainsDir = Join-Path $ResourcesDir "node_modules\@anthropic-ai\claude-agent-sdk\vendor\claude-code-jetbrains-plugin"
    if (Test-Path $JetBrainsDir) {
        Remove-Item -Path $JetBrainsDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    # 3. Remove duplicate images
    Write-Host "  -> Removing duplicate images..." -ForegroundColor White
    $DuplicateImages = Join-Path $BundleDir "_up_\images"
    if (Test-Path $DuplicateImages) {
        Remove-Item -Path $DuplicateImages -Recurse -Force -ErrorAction SilentlyContinue
    }

    # 4. Remove source maps
    Write-Host "  -> Removing source maps..." -ForegroundColor White
    Get-ChildItem -Path $ResourcesDir -Recurse -Filter "*.map" -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

    # 5. Remove TypeScript definition files
    Write-Host "  -> Removing TypeScript definitions..." -ForegroundColor White
    Get-ChildItem -Path $ResourcesDir -Recurse -Filter "*.d.ts" -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $ResourcesDir -Recurse -Filter "*.d.ts.map" -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

    # 6. Remove @types packages
    Write-Host "  -> Removing @types packages..." -ForegroundColor White
    $TypesDir = Join-Path $ResourcesDir "node_modules\@types"
    if (Test-Path $TypesDir) {
        Remove-Item -Path $TypesDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    # 7. Remove documentation files
    Write-Host "  -> Removing documentation..." -ForegroundColor White
    Get-ChildItem -Path $ResourcesDir -Recurse -Include "README.md","CHANGELOG.md","LICENSE","*.markdown" -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

    # 8. Remove test files
    Write-Host "  -> Removing test files..." -ForegroundColor White
    Get-ChildItem -Path $ResourcesDir -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -in @("__tests__", "test", "tests") } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $ResourcesDir -Recurse -Include "*.test.js","*.spec.js" -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

    # 9. Remove sharp binaries for other platforms
    Write-Host "  -> Removing unused sharp binaries..." -ForegroundColor White
    $SharpDir = Join-Path $ResourcesDir "node_modules\@img"
    if (Test-Path $SharpDir) {
        Get-ChildItem -Path $SharpDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "sharp-darwin-*" -or $_.Name -like "sharp-linux-*" } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }

    # Get final size
    $FinalSize = [math]::Round((Get-ChildItem $BundleDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 2)

    Write-Host "  Optimization complete!" -ForegroundColor Green
    Write-Host "    Before: ${InitialSize} MB" -ForegroundColor White
    Write-Host "    After:  ${FinalSize} MB" -ForegroundColor White
    Write-Host ""
}

Write-Host "Searching for bundles to optimize..." -ForegroundColor Yellow
Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Windows x64 build
$WindowsBundle = Join-Path $ProjectRoot "src-tauri\target\release"
if (Test-Path $WindowsBundle) {
    Optimize-Bundle -BundleDir $WindowsBundle -ArchName "Windows (x64)"
}

# Debug build
$DebugBundle = Join-Path $ProjectRoot "src-tauri\target\debug"
if (Test-Path $DebugBundle) {
    Optimize-Bundle -BundleDir $DebugBundle -ArchName "Windows Debug (x64)"
}

Write-Host "Quack! All bundles optimized!" -ForegroundColor Green
Write-Host ""

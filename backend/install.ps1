# GestureFlow backend - environment setup
# Run from the backend/ directory:
#   powershell -ExecutionPolicy Bypass -File install
# Or rename to install.ps1 and run: .\install.ps1

param(
    [string]$VenvDir = ".venv",
    [string]$Requirements = "requirements.txt"
)

$ErrorActionPreference = "Stop"

# -- Resolve paths ------------------------------------------------------------------
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $root) { $root = $PWD.Path }

$venvPath   = Join-Path $root $VenvDir
$reqPath    = Join-Path $root $Requirements

# -- Verify requirements.txt exists -------------------------------------------------
if (-not (Test-Path $reqPath)) {
    Write-Error "requirements.txt not found at: $reqPath"
    exit 1
}

# -- Find python ---------------------------------------------------------------------
$python = $null
foreach ($candidate in @("python", "python3", "py")) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) {
        $python = $candidate
        break
    }
}
if (-not $python) {
    Write-Error "Python not found. Install Python 3.10+ and ensure it is on PATH."
    exit 1
}

$pyVersion = & $python --version 2>&1
Write-Host "Using: $pyVersion" -ForegroundColor Cyan

# -- Create virtual environment ------------------------------------------------------
if (Test-Path $venvPath) {
    Write-Host "Virtual environment already exists at '$VenvDir' - skipping creation."
} else {
    Write-Host "Creating virtual environment at '$VenvDir'..." -ForegroundColor Cyan
    & $python -m venv $venvPath
    if ($LASTEXITCODE -ne 0) { Write-Error "venv creation failed."; exit 1 }
    Write-Host "Virtual environment created." -ForegroundColor Green
}

# -- Resolve venv pip/python executables ---------------------------------------------
if ($IsWindows -or $env:OS -eq "Windows_NT") {
    $venvPython = Join-Path $venvPath "Scripts\python.exe"
    $venvPip    = Join-Path $venvPath "Scripts\pip.exe"
    $activateCmd = Join-Path $venvPath "Scripts\Activate.ps1"
} else {
    $venvPython = Join-Path $venvPath "bin/python"
    $venvPip    = Join-Path $venvPath "bin/pip"
    $activateCmd = Join-Path $venvPath "bin/activate"
}

# -- Upgrade pip ---------------------------------------------------------------------
Write-Host "Upgrading pip..." -ForegroundColor Cyan
& $venvPython -m pip install --upgrade pip --quiet
if ($LASTEXITCODE -ne 0) { Write-Error "pip upgrade failed."; exit 1 }

# -- Install requirements ------------------------------------------------------------
Write-Host "Installing packages from '$Requirements'..." -ForegroundColor Cyan
& $venvPip install -r $reqPath
if ($LASTEXITCODE -ne 0) { Write-Error "Package installation failed."; exit 1 }

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host ""
Write-Host "Activate the environment with:" -ForegroundColor Cyan
Write-Host "  $activateCmd" -ForegroundColor White
Write-Host ""
Write-Host "Then start the server:" -ForegroundColor Cyan
Write-Host "uvicorn app.main:app --reload" -ForegroundColor White

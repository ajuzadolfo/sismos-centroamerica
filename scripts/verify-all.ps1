# Script de validacion local integral previo a git push (Frontend & Backend)
$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "[SISMOS CA] GUARDIAN DE CALIDAD PRE-PUSH (LOCAL CI/CD)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Asegurar variables de entorno y binarios locales
$additionalPaths = @(
    "C:\nvm4w\nodejs",
    "C:\Users\ajuza\AppData\Roaming\npm",
    "C:\apache-maven-3.9.9-bin\bin",
    "C:\Program Files\Java\jdk-21\bin"
)
foreach ($p in $additionalPaths) {
    if ((Test-Path $p) -and ($env:PATH -notlike "*$p*")) {
        $env:PATH = "$p;$env:PATH"
    }
}

if (-not (Test-Path env:JAVA_HOME)) {
    if (Test-Path "C:\Program Files\Java\jdk-21") {
        $env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $repoRoot) { $repoRoot = (Get-Location).Path }

$frontendDir = Join-Path $repoRoot "frontend"
$backendDir = Join-Path $repoRoot "backend"

# ============================================================
# PASO 1: Linting de Frontend (ESLint)
# ============================================================
Write-Host ""
Write-Host "[1/3] Ejecutando analisis estatico Frontend (npm run lint)..." -ForegroundColor Yellow
Push-Location $frontendDir
try {
    npm.cmd run lint
    if ($LASTEXITCODE -ne 0) {
        throw "ESLint reporto advertencias o errores en el frontend."
    }
    Write-Host "[OK] Frontend Lint: APROBADO sin errores." -ForegroundColor Green
} catch {
    Write-Host "[FALLO] en Frontend Lint: $_" -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

# ============================================================
# PASO 2: Compilacion de Frontend (Angular ng build)
# ============================================================
Write-Host ""
Write-Host "[2/3] Compilando Frontend Angular (npm run build)..." -ForegroundColor Yellow
Push-Location $frontendDir
try {
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        throw "La compilacion de Angular (ng build) fallo."
    }
    Write-Host "[OK] Frontend Build: APROBADO (Compilacion limpia)." -ForegroundColor Green
} catch {
    Write-Host "[FALLO] en Frontend Build: $_" -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

# ============================================================
# PASO 3: Compilacion y Verificacion de Backend (Maven)
# ============================================================
Write-Host ""
Write-Host "[3/3] Compilando Backend Spring Boot (mvn test-compile)..." -ForegroundColor Yellow
Push-Location $backendDir
try {
    mvn.cmd test-compile -B -q
    if ($LASTEXITCODE -ne 0) {
        throw "La compilacion de Java/Spring Boot (mvn test-compile) fallo."
    }
    Write-Host "[OK] Backend Compile: APROBADO (Compilacion limpia)." -ForegroundColor Green
} catch {
    Write-Host "[FALLO] en Backend Compile: $_" -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "[EXITO] TODOS LOS CHEQUEOS PASARON. Codigo 100% listo para push." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
exit 0

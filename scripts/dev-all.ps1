param(
  [int]$DashboardPort = 3000,
  [int]$SimulationPort = 3100,
  [int]$ApiPort = 8000,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$DashboardDir = $RepoRoot
$SimulationDir = Join-Path $RepoRoot "02-simulation-engine"
$ApiDir = Join-Path $RepoRoot "04-analyst-api"
$BundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

function Find-CommandPath {
  param([string]$Name)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }
  return $null
}

function Start-DevWindow {
  param(
    [string]$Title,
    [string]$WorkingDirectory,
    [string]$Command
  )

  $escapedTitle = $Title.Replace("'", "''")
  $escapedDirectory = $WorkingDirectory.Replace("'", "''")
  $fullCommand = "Set-Location '$escapedDirectory'; `$Host.UI.RawUI.WindowTitle = '$escapedTitle'; $Command"

  if ($DryRun) {
    Write-Host "DRY RUN: $Title"
    Write-Host "  cd $WorkingDirectory"
    Write-Host "  $Command"
    return
  }

  Start-Process powershell -ArgumentList "-NoExit", "-Command", $fullCommand
}

Write-Host "SEA Social Contagion Lab concurrent launcher"
Write-Host "Dashboard is the primary demo surface."
Write-Host ""

$npmPath = Find-CommandPath "npm"
if ($npmPath) {
  Start-DevWindow `
    -Title "SEA Dashboard" `
    -WorkingDirectory $DashboardDir `
    -Command "npm run dev -- --port $DashboardPort"
  Write-Host "Dashboard: http://localhost:$DashboardPort"
} else {
  Write-Host "Dashboard: npm was not found on PATH."
  Write-Host "Install Node/npm, then run:"
  Write-Host "  npm ci"
  Write-Host "  npm run dev -- --port $DashboardPort"
}

$pythonPath = Find-CommandPath "python"
if (-not $pythonPath -and (Test-Path $BundledPython)) {
  $pythonPath = $BundledPython
}
if ($pythonPath) {
  Start-DevWindow `
    -Title "Static Simulation Mock" `
    -WorkingDirectory $RepoRoot `
    -Command "& '$pythonPath' -m http.server $SimulationPort --directory '$SimulationDir'"
  Write-Host "Simulation mock: http://localhost:$SimulationPort"
} else {
  Write-Host "Simulation mock: python was not found on PATH."
  Write-Host "Open directly instead:"
  Write-Host "  $SimulationDir\index.html"
}

$apiMain = Join-Path $ApiDir "app\main.py"
$uvicornPath = Find-CommandPath "uvicorn"
if ((Test-Path $apiMain) -and $uvicornPath) {
  Start-DevWindow `
    -Title "Analyst API" `
    -WorkingDirectory $ApiDir `
    -Command "uvicorn app.main:app --reload --port $ApiPort"
  Write-Host "Analyst API: http://localhost:$ApiPort"
} else {
  Write-Host "Analyst API: no runnable FastAPI entrypoint found yet."
}

Write-Host ""
Write-Host "Primary tab: http://localhost:$DashboardPort"
Write-Host "See RUNBOOK.md for integration order and known gaps."

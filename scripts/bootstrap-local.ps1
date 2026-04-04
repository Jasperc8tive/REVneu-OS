Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$postgresRoot = Join-Path $env:LOCALAPPDATA 'Programs\PostgreSQL17\pgsql'
$postgresBin = Join-Path $postgresRoot 'bin'
$postgresData = Join-Path $postgresRoot 'data'
$postgresLog = Join-Path $postgresRoot 'postgres.log'
$postgresPasswordFile = Join-Path $postgresRoot 'pw.txt'
$postgresPassword = 'revneu_secret'
$databaseUrl = 'postgresql://revneu:revneu_secret@localhost:5432/revneu_db'

$memuraiRoot = Join-Path $env:LOCALAPPDATA 'Programs\MemuraiExtract\Memurai'
$memuraiExe = Join-Path $memuraiRoot 'memurai.exe'

$pythonExe = Join-Path $repoRoot '.venv\Scripts\python.exe'
$apiWorkingDir = Join-Path $repoRoot 'apps\api'
$agentsWorkingDir = Join-Path $repoRoot 'apps\agents'

function Test-PortListening {
  param([int]$Port)

  $result = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
  return [bool]$result.TcpTestSucceeded
}

function Wait-HttpOk {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        return
      }
    } catch {
    }

    Start-Sleep -Seconds 2
  }

  throw "Timed out waiting for $Url"
}

function Ensure-Postgres {
  if (!(Test-Path (Join-Path $postgresBin 'pg_ctl.exe'))) {
    throw 'PostgreSQL binaries not found. Extract the PostgreSQL archive to %LOCALAPPDATA%\\Programs\\PostgreSQL17 first.'
  }

  if (!(Test-Path $postgresData)) {
    Set-Content -Path $postgresPasswordFile -Value $postgresPassword -NoNewline
    & (Join-Path $postgresBin 'initdb.exe') -D $postgresData -U postgres -A scram-sha-256 --pwfile=$postgresPasswordFile | Out-Null
  }

  if (!(Test-PortListening 5432)) {
    & (Join-Path $postgresBin 'pg_ctl.exe') -D $postgresData -l $postgresLog -o '-p 5432' start | Out-Null
    Start-Sleep -Seconds 2
  }

  $env:PGPASSWORD = $postgresPassword
  $roleExists = & (Join-Path $postgresBin 'psql.exe') -h localhost -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='revneu'"
  if (($roleExists | Out-String).Trim() -ne '1') {
    & (Join-Path $postgresBin 'psql.exe') -h localhost -p 5432 -U postgres -d postgres -c "CREATE ROLE revneu LOGIN PASSWORD 'revneu_secret' CREATEDB;" | Out-Null
  } else {
    & (Join-Path $postgresBin 'psql.exe') -h localhost -p 5432 -U postgres -d postgres -c "ALTER ROLE revneu CREATEDB;" | Out-Null
  }

  $dbExists = & (Join-Path $postgresBin 'psql.exe') -h localhost -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='revneu_db'"
  if (($dbExists | Out-String).Trim() -ne '1') {
    & (Join-Path $postgresBin 'psql.exe') -h localhost -p 5432 -U postgres -d postgres -c 'CREATE DATABASE revneu_db OWNER revneu;' | Out-Null
  }
}

function Ensure-Memurai {
  if (!(Test-Path $memuraiExe)) {
    throw 'Memurai binary not found. Extract Memurai to %LOCALAPPDATA%\\Programs\\MemuraiExtract first.'
  }

  if (!(Test-PortListening 6379)) {
    Start-Process -FilePath $memuraiExe -ArgumentList '--port 6379' -WorkingDirectory $memuraiRoot -WindowStyle Hidden | Out-Null
    Start-Sleep -Seconds 2
  }
}

function Start-Agents {
  if (!(Test-Path $pythonExe)) {
    throw '.venv Python not found. Create the virtual environment and install agent dependencies first.'
  }

  if (!(Test-PortListening 8000)) {
    $command = @(
      "`$env:API_URL='http://localhost:4000'",
      "`$env:AGENT_API_KEY='revneu-stage4-internal-key-1234567890'",
      "`$env:ENVIRONMENT='development'",
      "& '$pythonExe' -m uvicorn main:app --host 0.0.0.0 --port 8000"
    ) -join '; '

    Start-Process -FilePath 'powershell' -ArgumentList '-NoExit', '-Command', $command -WorkingDirectory $agentsWorkingDir | Out-Null
  }
}

function Start-Api {
  if (!(Test-PortListening 4000)) {
    $command = @(
      "`$env:DATABASE_URL='$databaseUrl'",
      "`$env:AGENT_API_KEY='revneu-stage4-internal-key-1234567890'",
      "`$env:AGENT_SERVICE_URL='http://localhost:8000'",
      "`$env:REDIS_HOST='localhost'",
      "`$env:REDIS_PORT='6379'",
      "`$env:JWT_SECRET='dev-jwt-secret-change-in-prod'",
      "`$env:JWT_REFRESH_SECRET='dev-refresh-secret-change-in-prod'",
      "`$env:ENCRYPTION_KEY='0000000000000000000000000000000000000000000000000000000000000000'",
      "`$env:AGENT_SCHEDULER_TRIGGER_TIMEOUT_MS='60000'",
      'npx ts-node src/main.ts'
    ) -join '; '

    Start-Process -FilePath 'powershell' -ArgumentList '-NoExit', '-Command', $command -WorkingDirectory $apiWorkingDir | Out-Null
  }
}

Ensure-Postgres
Ensure-Memurai
Start-Agents
Start-Api

Wait-HttpOk -Url 'http://localhost:4000/health'
Wait-HttpOk -Url 'http://localhost:8000/health'

Write-Host 'Local stack ready:'
Write-Host '  PostgreSQL: localhost:5432'
Write-Host '  Memurai:    localhost:6379'
Write-Host '  API:        http://localhost:4000/health'
Write-Host '  Agents:     http://localhost:8000/health'
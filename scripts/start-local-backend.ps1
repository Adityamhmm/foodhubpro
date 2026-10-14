$ErrorActionPreference = 'Stop'

function Read-SecretText([string] $Prompt) {
    $secureValue = Read-Host $Prompt -AsSecureString
    if ($secureValue.Length -eq 0) {
        throw 'A value is required.'
    }

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try {
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

if (-not (Get-Command mvn.cmd -ErrorAction SilentlyContinue)) {
    throw 'Maven (mvn.cmd) was not found on PATH.'
}

$listener = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($listener) {
    throw "Port 8080 is already in use by PID $($listener.OwningProcess). Stop the existing backend with Ctrl+C in its original PowerShell window before starting another copy."
}

Push-Location (Split-Path -Parent $PSScriptRoot)
$env:DB_URL = 'jdbc:mysql://localhost:3306/foodhub_db'
$env:DB_USERNAME = 'foodhub_app'
$env:ADMIN_USERNAME = 'admin'
$env:FRONTEND_ORIGIN = 'http://localhost:3000'

try {
    $env:DB_PASSWORD = Read-SecretText 'Enter the foodhub_app database password'
    $env:ADMIN_PASSWORD = Read-SecretText 'Enter the initial admin password (at least 12 characters)'
    if ($env:ADMIN_PASSWORD.Length -lt 12) {
        throw 'The initial admin password must be at least 12 characters.'
    }

    & mvn.cmd spring-boot:run
    if ($LASTEXITCODE -ne 0) {
        throw "Spring Boot stopped with exit code $LASTEXITCODE."
    }
}
finally {
    Remove-Item Env:DB_PASSWORD, Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:DB_URL, Env:DB_USERNAME, Env:ADMIN_USERNAME, Env:FRONTEND_ORIGIN -ErrorAction SilentlyContinue
    Pop-Location
}

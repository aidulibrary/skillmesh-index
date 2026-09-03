param(
    [string]$BaseUrl = "https://97b25635.skillmesh.pages.dev"
)

Write-Host "=== Verify Deployment: $BaseUrl ===" -ForegroundColor Cyan

# 1. API capabilities
try {
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/ccp/v1/capabilities" -TimeoutSec 10
    Write-Host "[PASS] GET /capabilities — count=$($r.count), version=$($r.version)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] GET /capabilities — $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Cache-Control
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/api/ccp/v1/capabilities" -TimeoutSec 10 -UseBasicParsing
    $cc = $r.Headers['Cache-Control']
    if ($cc -eq 'no-store') {
        Write-Host "[PASS] Cache-Control: $cc" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Cache-Control: $cc" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[FAIL] Cache-Control check — $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Search
try {
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/ccp/v1/search?q=PDF" -TimeoutSec 10
    Write-Host "[PASS] GET /search?q=PDF — count=$($r.count)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] GET /search — $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Federated search
try {
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/ccp/v1/search?q=PDF&federated=true" -TimeoutSec 10
    Write-Host "[PASS] GET /search?q=PDF&federated=true — federated=$($r.federated)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] GET /search federated — $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Federation info
try {
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/ccp/v1/federation" -TimeoutSec 10
    Write-Host "[PASS] GET /federation — protocol=$($r.protocol), version=$($r.version)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] GET /federation — $($_.Exception.Message)" -ForegroundColor Red
}

# 6. Federation nodes
try {
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/ccp/v1/federation/nodes" -TimeoutSec 10
    Write-Host "[PASS] GET /federation/nodes — count=$($r.count)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] GET /federation/nodes — $($_.Exception.Message)" -ForegroundColor Red
}

# 7. Frontend: federation panel
try {
    $r = Invoke-WebRequest -Uri $BaseUrl -TimeoutSec 10 -UseBasicParsing
    if ($r.Content -match 'federationPanel') {
        Write-Host "[PASS] Frontend — federationPanel present" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Frontend — federationPanel missing" -ForegroundColor Red
    }
    if ($r.Content -match 'federatedToggle') {
        Write-Host "[PASS] Frontend — federatedToggle present" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Frontend — federatedToggle missing" -ForegroundColor Red
    }
} catch {
    Write-Host "[FAIL] Frontend — $($_.Exception.Message)" -ForegroundColor Red
}

# 8. Frontend: app.js functions
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/js/app.js" -TimeoutSec 10 -UseBasicParsing
    if ($r.Content -match 'toggleFederation') { Write-Host "[PASS] app.js — toggleFederation" -ForegroundColor Green } else { Write-Host "[FAIL] app.js — toggleFederation" -ForegroundColor Red }
    if ($r.Content -match 'loadFederationNodes') { Write-Host "[PASS] app.js — loadFederationNodes" -ForegroundColor Green } else { Write-Host "[FAIL] app.js — loadFederationNodes" -ForegroundColor Red }
    if ($r.Content -match 'sendTelemetry') { Write-Host "[PASS] app.js — sendTelemetry" -ForegroundColor Green } else { Write-Host "[FAIL] app.js — sendTelemetry" -ForegroundColor Red }
    if ($r.Content -match 'loadCapabilities') { Write-Host "[PASS] app.js — loadCapabilities" -ForegroundColor Green } else { Write-Host "[FAIL] app.js — loadCapabilities" -ForegroundColor Red }
} catch {
    Write-Host "[FAIL] app.js — $($_.Exception.Message)" -ForegroundColor Red
}

# 9. Telemetry
try {
    $body = @{ capability_id = "pdf-extract-text-001"; agent_id = "verify-test"; success = $true } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/ccp/v1/telemetry" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10
    Write-Host "[PASS] POST /telemetry — received=$($r.received)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] POST /telemetry — $($_.Exception.Message)" -ForegroundColor Red
}

# 10. Metrics
try {
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/ccp/v1/metrics" -TimeoutSec 10
    Write-Host "[PASS] GET /metrics — requests present" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] GET /metrics — $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Verification Complete ===" -ForegroundColor Cyan
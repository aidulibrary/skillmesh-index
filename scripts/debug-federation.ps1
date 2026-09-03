$ErrorActionPreference = "Continue"
$base = "https://skillmesh.xn--rpr94o750a.xn--fiqs8s/api/ccp/v1"

Write-Host "=== Debug: GET federation/nodes ==="
try {
    $r = Invoke-RestMethod -Uri "$base/federation/nodes" -Method GET
    Write-Host "Type: $($r.GetType().Name)"
    Write-Host "Raw: $($r | ConvertTo-Json -Depth 3 -Compress)"
} catch { Write-Host "ERROR: $($_.Exception.Message)" }

Write-Host ""
Write-Host "=== Debug: POST federation/nodes ==="
$body = '{"id":"test-node-001","name":"Test Node","endpoint":"https://test.example.com/api/ccp/v1","description":"Test","trust_weight":0.5}'
try {
    $r2 = Invoke-RestMethod -Uri "$base/federation/nodes" -Method POST -ContentType "application/json" -Body $body
    Write-Host "Type: $($r2.GetType().Name)"
    Write-Host "Raw: $($r2 | ConvertTo-Json -Depth 3 -Compress)"
} catch { Write-Host "ERROR: $($_.Exception.Message)" }
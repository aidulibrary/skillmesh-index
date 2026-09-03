$base = "https://skillmesh.xn--rpr94o750a.xn--fiqs8s/api/ccp/v1"

Write-Host "=== Federation Search (blast + federated) ==="
$r = Invoke-RestMethod -Uri "$base/search?q=blast&federated=true"
Write-Host "Total:" $r.count
Write-Host "Federated:" $r.federated
foreach ($c in $r.results) {
    $src = if ($c._source) { $c._source } else { "local" }
    Write-Host "  - $($c.id) $($c.name) [source=$src]"
}

Write-Host ""
Write-Host "=== Federation Search (legal + federated) ==="
$r2 = Invoke-RestMethod -Uri "$base/search?q=contract&federated=true"
Write-Host "Total:" $r2.count
foreach ($c in $r2.results) {
    $src = if ($c._source) { $c._source } else { "local" }
    Write-Host "  - $($c.id) $($c.name) [source=$src]"
}
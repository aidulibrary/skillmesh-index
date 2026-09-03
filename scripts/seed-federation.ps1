param($BaseUrl = "https://skillmesh.xn--rpr94o750a.xn--fiqs8s/api/ccp/v1")

$ErrorActionPreference = "Continue"

Write-Host "=== CCP Seed Federation Nodes Registration ===" -ForegroundColor Cyan
Write-Host "Target: $BaseUrl" -ForegroundColor Cyan
Write-Host ""

# Node 1: Academic Node
Write-Host "[1/2] Registering academic node: bioinfo-ccp.lab.ac.cn" -ForegroundColor Yellow
$node1 = @{
    id           = "bioinfo-ccp.lab.ac.cn"
    name         = "Bioinfo CCP Node"
    endpoint     = "https://bioinfo-ccp.lab.ac.cn/api/ccp/v1"
    description  = "Academic federation node for bioinformatics capabilities: sequence alignment, protein structure prediction, genome annotation, literature mining."
    trust_weight = 0.85
} | ConvertTo-Json -Compress

try {
    $r = Invoke-RestMethod -Uri "$BaseUrl/federation/nodes" -Method POST -ContentType "application/json" -Body $node1 -ErrorAction Stop
    Write-Host "  OK: $($r.id) status=$($r.status)" -ForegroundColor Green
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 409) { Write-Host "  WARN: Already exists (409)" -ForegroundColor DarkYellow }
    else { Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red }
}

Write-Host ""

# Node 2: Industry Node
Write-Host "[2/2] Registering industry node: legal-ai-ccp.example.com" -ForegroundColor Yellow
$node2 = @{
    id           = "legal-ai-ccp.example.com"
    name         = "Legal AI CCP Node"
    endpoint     = "https://legal-ai-ccp.example.com/api/ccp/v1"
    description  = "Industry federation node for legal AI capabilities: contract review, case law search, statute parsing, document generation."
    trust_weight = 0.80
} | ConvertTo-Json -Compress

try {
    $r = Invoke-RestMethod -Uri "$BaseUrl/federation/nodes" -Method POST -ContentType "application/json" -Body $node2 -ErrorAction Stop
    Write-Host "  OK: $($r.id) status=$($r.status)" -ForegroundColor Green
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 409) { Write-Host "  WARN: Already exists (409)" -ForegroundColor DarkYellow }
    else { Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red }
}

Write-Host ""

# Verify
Write-Host "=== Verification ===" -ForegroundColor Cyan
try {
    $nodes = Invoke-RestMethod -Uri "$BaseUrl/federation/nodes" -Method GET -ErrorAction Stop
    $list = if ($nodes -is [array]) { $nodes } else { $nodes.results }
    $count = if ($list) { $list.Count } else { 0 }
    Write-Host "  Total nodes: $count" -ForegroundColor Green
    if ($list) {
        foreach ($n in $list) {
            Write-Host "    - $($n.id) ($($n.name)) trust=$($n.trust_weight)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
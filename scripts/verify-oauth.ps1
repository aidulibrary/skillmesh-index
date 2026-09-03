<#
.SYNOPSIS
    SkillMesh CCP v1.0.0 - OAuth + API full regression verification
.DESCRIPTION
    One-click verification of login/logout/callback/user OAuth endpoints,
    plus CCP API core endpoints, homepage, proxy - 14 checks total.
    Colored pass/fail output, exit code 0=all pass, 1=failures exist.
.PARAMETER BaseUrl
    Target site URL, default https://skillmesh.礼字号.中国
.PARAMETER TimeoutSec
    Request timeout in seconds, default 10
.EXAMPLE
    .\scripts\verify-oauth.ps1
    Verify production
.EXAMPLE
    .\scripts\verify-oauth.ps1 -BaseUrl https://abcdef.skillmesh.pages.dev
    Verify specific deployment
#>

param(
    [string]$BaseUrl = "https://skillmesh.礼字号.中国",
    [int]$TimeoutSec = 10
)

$ErrorActionPreference = "Continue"
$script:FailCount = 0
$script:PassCount = 0
$script:TotalCount = 0

function Write-Pass($label) {
    Write-Host "  [PASS] " -NoNewline -ForegroundColor Green
    Write-Host $label
    $script:PassCount++
    $script:TotalCount++
}

function Write-Fail($label, $detail) {
    Write-Host "  [FAIL] " -NoNewline -ForegroundColor Red
    Write-Host "$label - $detail"
    $script:FailCount++
    $script:TotalCount++
}

function Curl-Request {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [switch]$FollowRedirects
    )

    $result = @{
        StatusCode = 0
        Headers = @{}
        Body = $null
        Location = $null
        RawBody = $null
    }

    $tmpFile = [System.IO.Path]::GetTempFileName()
    $headerFile = [System.IO.Path]::GetTempFileName()

    try {
        $curlArgs = @("-s", "-w", "%{http_code}", "-o", $tmpFile, "-D", $headerFile, "-X", $Method, "--max-time", $TimeoutSec)
        if ($FollowRedirects) {
            $curlArgs += "-L"
        }
        $curlArgs += $Uri

        $output = & curl.exe $curlArgs 2>&1
        $exitCode = $LASTEXITCODE

        if (Test-Path $headerFile) {
            $headerLines = Get-Content $headerFile -Encoding UTF8
            foreach ($line in $headerLines) {
                if ($line -match '^HTTP/\S+\s+(\d+)') {
                    $result.StatusCode = [int]$matches[1]
                } elseif ($line -match '^location:\s*(.+)$') {
                    $result.Location = $matches[1].Trim()
                }
            }
        }

        if ($output -match '^\d{3}$') {
            $result.StatusCode = [int]$output
        } elseif ($output -match '(\d{3})$') {
            $result.StatusCode = [int]$matches[1]
        }

        if (Test-Path $tmpFile) {
            $bodyText = Get-Content $tmpFile -Raw -Encoding UTF8
            if ($bodyText) {
                try {
                    $result.Body = $bodyText | ConvertFrom-Json
                } catch {
                    $result.RawBody = $bodyText
                }
            }
        }
    } catch {
        $result.RawBody = $_.Exception.Message
    } finally {
        if (Test-Path $tmpFile) { Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue }
        if (Test-Path $headerFile) { Remove-Item $headerFile -Force -ErrorAction SilentlyContinue }
    }

    return $result
}

function Check-Redirect {
    param([string]$Label, [string]$Url)

    $r = Curl-Request -Uri $Url -FollowRedirects:$false
    if ($r.StatusCode -eq 302) {
        $loc = "unknown"
        if ($r.Location) {
            $loc = $r.Location.Substring(0, [Math]::Min(60, $r.Location.Length))
        }
        Write-Pass "$Label -> 302 -> $loc"
    } elseif ($r.StatusCode -eq 0) {
        Write-Fail $Label "request failed"
    } else {
        Write-Fail $Label "expected 302 got $($r.StatusCode)"
    }
}

function Check-Json {
    param(
        [string]$Label,
        [string]$Url,
        [string]$Method = "GET",
        [int]$ExpectedStatus = 200,
        [string[]]$RequiredFields = @(),
        [string[]]$ForbiddenFields = @()
    )

    $r = Curl-Request -Uri $Url -Method $Method

    if ($r.StatusCode -eq 0) {
        Write-Fail $Label "request failed: $($r.RawBody)"
        return
    }

    if ($r.StatusCode -ne $ExpectedStatus) {
        Write-Fail $Label "expected $ExpectedStatus got $($r.StatusCode)"
        return
    }

    if ($r.Body -eq $null) {
        Write-Fail $Label "response is not JSON"
        return
    }

    foreach ($field in $RequiredFields) {
        $found = $false
        $props = $r.Body.PSObject.Properties
        foreach ($p in $props) {
            if ($p.Name -eq $field) { $found = $true; break }
        }
        if (-not $found) {
            Write-Fail $Label "missing field: $field"
            return
        }
    }

    foreach ($field in $ForbiddenFields) {
        $found = $false
        $props = $r.Body.PSObject.Properties
        foreach ($p in $props) {
            if ($p.Name -eq $field) { $found = $true; break }
        }
        if ($found) {
            Write-Fail $Label "should not expose field: $field"
            return
        }
    }

    Write-Pass "$Label -> $($r.StatusCode)"
}

function Check-Status {
    param(
        [string]$Label,
        [string]$Url,
        [string]$Method = "GET",
        [int]$ExpectedStatus = 200
    )

    $r = Curl-Request -Uri $Url -Method $Method
    if ($r.StatusCode -eq $ExpectedStatus) {
        Write-Pass "$Label -> $($r.StatusCode)"
    } elseif ($r.StatusCode -eq 0) {
        Write-Fail $Label "request failed"
    } else {
        Write-Fail $Label "expected $ExpectedStatus got $($r.StatusCode)"
    }
}

# ============================================================
# Main
# ============================================================
Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  SkillMesh CCP v1.0.0 Regression Test" -ForegroundColor Cyan
Write-Host "  Target: $BaseUrl" -ForegroundColor Cyan
Write-Host "  Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Group 1: OAuth Endpoints
Write-Host "-- 1. OAuth Endpoints --" -ForegroundColor Cyan

Check-Redirect -Label "GET /api/auth/github/login" `
    -Url "$BaseUrl/api/auth/github/login"

Check-Redirect -Label "GET /api/auth/github/logout" `
    -Url "$BaseUrl/api/auth/github/logout"

Check-Json -Label "GET /api/auth/github/callback" `
    -Url "$BaseUrl/api/auth/github/callback" `
    -ExpectedStatus 400 `
    -ForbiddenFields @("stack", "name", "bodyPreview")

Check-Json -Label "GET /api/auth/github/user" `
    -Url "$BaseUrl/api/auth/github/user" `
    -RequiredFields @("authenticated")

Check-Json -Label "GET /api/auth/github/404" `
    -Url "$BaseUrl/api/auth/github/random" `
    -ExpectedStatus 404 `
    -RequiredFields @("error", "endpoints")

# Group 2: CCP API Core
Write-Host ""
Write-Host "-- 2. CCP API Core Endpoints --" -ForegroundColor Cyan

Check-Json -Label "GET /api/ccp/v1/capabilities" `
    -Url "$BaseUrl/api/ccp/v1/capabilities" `
    -RequiredFields @("count")

Check-Json -Label "GET /api/ccp/v1/search?q=pdf" `
    -Url "$BaseUrl/api/ccp/v1/search?q=pdf" `
    -RequiredFields @("count")

Check-Json -Label "GET /api/ccp/v1/search?q=pdf&federated=true" `
    -Url "$BaseUrl/api/ccp/v1/search?q=pdf&federated=true" `
    -RequiredFields @("count")

Check-Json -Label "GET /api/ccp/v1/metrics" `
    -Url "$BaseUrl/api/ccp/v1/metrics" `
    -RequiredFields @("requests", "errors", "latency", "uptime")

Check-Json -Label "GET /api/ccp/v1/federation" `
    -Url "$BaseUrl/api/ccp/v1/federation"

Check-Json -Label "GET /api/ccp/v1/federation/nodes" `
    -Url "$BaseUrl/api/ccp/v1/federation/nodes" `
    -RequiredFields @("nodes", "count")

# Group 3: Frontend
Write-Host ""
Write-Host "-- 3. Frontend & Static --" -ForegroundColor Cyan

Check-Status -Label "GET / (homepage)" `
    -Url "$BaseUrl/"

Check-Status -Label "GET /api/proxy" `
    -Url "$BaseUrl/api/proxy" `
    -ExpectedStatus 405

# Group 4: 1101 Check
Write-Host ""
Write-Host "-- 4. 1101 Check (no endpoint should return Cloudflare 1101) --" -ForegroundColor Cyan

$criticalEndpoints = @(
    "$BaseUrl/",
    "$BaseUrl/api/auth/github/login",
    "$BaseUrl/api/auth/github/logout",
    "$BaseUrl/api/auth/github/callback",
    "$BaseUrl/api/auth/github/user",
    "$BaseUrl/api/ccp/v1/capabilities",
    "$BaseUrl/api/ccp/v1/search?q=test",
    "$BaseUrl/api/ccp/v1/metrics",
    "$BaseUrl/api/ccp/v1/federation",
    "$BaseUrl/api/proxy"
)

$elevenOoneCount = 0
foreach ($url in $criticalEndpoints) {
    $label = $url.Replace($BaseUrl, "")
    $r = Curl-Request -Uri $url
    if ($r.StatusCode -eq 1101) {
        Write-Host "  [1101] " -NoNewline -ForegroundColor Red
        Write-Host "$label - Cloudflare 1101 error!"
        $elevenOoneCount++
    }
}

if ($elevenOoneCount -eq 0) {
    Write-Host "  [PASS] " -NoNewline -ForegroundColor Green
    Write-Host "All 10 endpoints: 0 1101 errors"
} else {
    Write-Host "  [FAIL] " -NoNewline -ForegroundColor Red
    Write-Host "Found $elevenOoneCount 1101 error(s)"
}

# Summary
Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Result: $PassCount passed / $FailCount failed / $TotalCount total" -ForegroundColor $(if ($FailCount -eq 0) { "Green" } else { "Red" })

if ($elevenOoneCount -gt 0) {
    Write-Host "  !! 1101 errors: $elevenOoneCount" -ForegroundColor Red
}

if ($FailCount -eq 0 -and $elevenOoneCount -eq 0) {
    Write-Host "  Status: [PASS] All checks passed" -ForegroundColor Green
    Write-Host "=================================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "  Status: [FAIL] Some checks failed" -ForegroundColor Red
    Write-Host "=================================================" -ForegroundColor Cyan
    exit 1
}
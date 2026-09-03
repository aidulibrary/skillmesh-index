<#
.SYNOPSIS
    SkillMesh 阶段五（A6）部署与回归自动化
.DESCRIPTION
    编排：A6-1 语法校验 -> A6-2 Cloudflare Pages 部署 -> A6-3 API 全量回归(18项)
          -> A6-5 CCP SDK 验证 -> A6-6 错误码验证，并生成汇总报告。
    注：A6-4 前端浏览器验证为 UI 交互项，由 Agent 浏览器流程单独执行。
.PARAMETER SkipDeploy
    跳过部署（仅做校验/回归，适用于已有部署预览地址）
.PARAMETER BaseUrl
    目标站点（默认主域 punycode；建议传入本次部署的 pages.dev 预览地址避开主域缓存污染）
.PARAMETER ProjectName
    Cloudflare Pages 项目名，默认 skillmesh
.PARAMETER Branch
    部署分支，默认 main
.PARAMETER TimeoutSec
    请求超时（秒），默认 15
.EXAMPLE
    .\scripts\stage5-deploy.ps1 -BaseUrl https://abcdef.skillmesh.pages.dev
#>

param(
    [switch]$SkipDeploy,
    [string]$BaseUrl = "https://skillmesh.xn--rpr94o750a.xn--fiqs8s",
    [string]$ProjectName = "skillmesh",
    [string]$Branch = "main",
    [int]$TimeoutSec = 15
)

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$script:Pass = 0
$script:Fail = 0

function Write-Pass($label) { Write-Host "  [PASS] $label" -ForegroundColor Green; $script:Pass++ }
function Write-Fail($label) { Write-Host "  [FAIL] $label" -ForegroundColor Red; $script:Fail++ }
function Write-H1($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }

# 语法文件清单（A6-1 按文档顺序）
$syntaxFiles = @(
    "functions/api/ccp/v1/lib/errors.js",
    "functions/api/ccp/v1/[[path]].js",
    "functions/api/ccp/v1/lib/trust-vector.js",
    "functions/api/ccp/v1/lib/db.js",
    "functions/api/ccp/v1/lib/response.js",
    "functions/api/ccp/v1/lib/error-boundary.js",
    "functions/api/ccp/v1/lib/monitoring.js",
    "functions/api/ccp/v1/handlers/capabilities.js",
    "functions/api/ccp/v1/handlers/telemetry.js",
    "functions/api/ccp/v1/handlers/contribute.js",
    "functions/api/ccp/v1/handlers/adapters.js",
    "functions/api/ccp/v1/federation/node.js",
    "functions/api/ccp/v1/federation/exchange.js",
    "js/app.js",
    "js/i18n.js"
)

function Test-JsSyntax {
    # ESM(.js) 不能直接 node --check(CommonJS 语义)，复制为 .mjs 后按 ESM 校验
    $ok = 0
    $tmp = Join-Path $env:TEMP "skillmesh-syntax"
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    foreach ($f in $syntaxFiles) {
        $src = Join-Path $root $f
        if (-not (Test-Path -LiteralPath $src)) { Write-Fail "$f missing"; continue }
        $mjs = Join-Path $tmp (([IO.Path]::GetFileNameWithoutExtension($f) + "_" + [IO.Path]::GetFileNameWithoutExtension([IO.Path]::GetRandomFileName()) + ".mjs"))
        Copy-Item -LiteralPath $src $mjs -Force
        node --check $mjs *> $null
        if ($LASTEXITCODE -eq 0) { Write-Pass "$f OK"; $ok++ } else { Write-Fail "$f syntax error" }
    }
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    return $ok
}

function Invoke-Deploy {
    Write-H1 "A6-2 部署 Cloudflare Pages ($ProjectName / $Branch)"
    $out = npx wrangler pages deploy . --project-name=$ProjectName --branch=$Branch 2>&1
    $out | ForEach-Object { Write-Host $_ }
    $pat = "https://[a-f0-9]{16,}\.$ProjectName\.pages\.dev"
    $preview = ($out | Select-String -Pattern $pat -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -First 1)
    return $preview
}

function Curl-Raw {
    param([string]$Uri, [string]$Method = "GET", [string]$Body = "", [switch]$PostEmpty)
    $args = @("-s", "-w", "`n%{http_code}", "--max-time", "$TimeoutSec", "-X", $Method)
    if ($PostEmpty) { $args += "--data"; $args += "" }
    elseif ($Body) { $args += "--data"; $args += $Body }
    $args += $Uri
    $r = (& curl.exe $args 2>&1) -join "`n"
    $code = 0
    if ($r -match '(\d{3})\s*$') { $code = [int]$Matches[1] }
    return @{ Code = $code; Raw = $r }
}

function Check-Status {
    param([string]$Label, [string]$Uri, [int]$Expected = 200)
    $r = Curl-Raw -Uri $Uri
    if ($r.Code -eq $Expected) { Write-Pass "$Label -> $($r.Code)" } else { Write-Fail "$Label expected $Expected got $($r.Code)" }
}

function Check-ErrorCode {
    param([string]$Label, [string]$Uri, [string]$Method = "GET", [string]$Body = "", [int]$Expected = 0, [string]$Code = "")
    $r = Curl-Raw -Uri $Uri -Method $Method -Body $Body
    $jsonOk = $false; $codeOk = $false; $statusOk = $false
    try {
        $obj = $r.Raw -replace '\d{3}\s*$', '' | ConvertFrom-Json
        if ($obj.error.code -eq $Code) { $codeOk = $true }
        $jsonOk = $true
    } catch { }
    if ($Expected -gt 0 -and $r.Code -eq $Expected) { $statusOk = $true }
    if ($jsonOk -and $codeOk -and ($Expected -eq 0 -or $statusOk)) { Write-Pass "$Label -> $($r.Code) error.code=$Code" }
    else { Write-Fail "$Label (status=$($r.Code) jsonOk=$jsonOk codeOk=$codeOk expectedCode=$Code)" }
}

function Verify-Sdk {
    Write-H1 "A6-5 CCP SDK 验证"
    Push-Location (Join-Path $root "packages\ccp-client")
    try {
        if (Test-Path "package.json") {
            $pkg = Get-Content package.json | ConvertFrom-Json
            Write-Pass "package.json exists ($($pkg.name)@$($pkg.version), main=$($pkg.main))"
        } else { Write-Fail "package.json not found" }
        $code = Get-Content "src/index.js" -Raw
        node --check "src/index.js" *> $null
        if ($LASTEXITCODE -eq 0) { Write-Pass "SDK syntax OK (CJS)" } else {
            $tmp = Join-Path $env:TEMP "ccp-client-check.mjs"
            Copy-Item "src/index.js" $tmp -Force
            node --check $tmp *> $null
            if ($LASTEXITCODE -eq 0) { Write-Pass "SDK syntax OK (ESM)" } else { Write-Fail "SDK syntax error" }
            Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        }
        $inst = node -e "const { CCPClient } = require('./src/index.js'); const c = new CCPClient({ baseUrl: '$BaseUrl/api/ccp/v1' }); console.log(JSON.stringify({ ok: true, baseUrl: c.baseUrl, timeout: c.timeout, agentId: c.agentId }));" 2>&1
        $instOut = ($inst | Out-String).Trim()
        if ($instOut -match '"ok":\s*true') { Write-Pass "CCPClient instantiated -> $instOut" } else { Write-Fail "CCPClient instantiation: $instOut" }
    } finally { Pop-Location }
}

# ============ 主流程 ============
Write-Host "SkillMesh 阶段五（A6）部署与回归" -ForegroundColor Cyan
Write-Host "根目录: $root"

Write-H1 "A6-1 语法校验"
$ok = Test-JsSyntax
Write-Host "  通过 $ok / $($syntaxFiles.Count)"
if ($ok -ne $syntaxFiles.Count) { Write-Fail "A6-1 语法校验未全通过，按文档应阻塞部署"; exit 1 }
else { Write-Pass "A6-1 语法校验全通过" }

if (-not $SkipDeploy) {
    $preview = Invoke-Deploy
    if ($preview) {
        Write-Pass "部署成功，预览地址: $preview"
        $BaseUrl = $preview.TrimEnd("/")
    } else {
        Write-Fail "未捕获到预览地址，继续使用 -BaseUrl 指定地址验证：$BaseUrl"
    }
} else {
    Write-Host "（已跳过部署）验证目标：$BaseUrl" -ForegroundColor Yellow
}

Write-H1 "A6-3 API 全量回归（18 项）"
# OAuth + 核心 CCP + 前端 + 1101 由 verify-oauth.ps1 覆盖（13 项命名检查）
& (Join-Path $root "scripts\verify-oauth.ps1") -BaseUrl $BaseUrl -TimeoutSec $TimeoutSec
# 新增端点回归（A6-3 #14-#18）
Check-ErrorCode -Label "GET /api/ccp/v1/capabilities/nonexistent (#14)" -Uri "$BaseUrl/api/ccp/v1/capabilities/nonexistent-999" -Expected 404 -Code "CAPABILITY_NOT_FOUND"
Check-ErrorCode -Label "POST /api/ccp/v1/telemetry empty (#15)" -Uri "$BaseUrl/api/ccp/v1/telemetry" -Method POST -PostEmpty -Expected 400 -Code "INVALID_JSON"
Check-ErrorCode -Label "POST /api/ccp/v1/contribute empty (#16)" -Uri "$BaseUrl/api/ccp/v1/contribute" -Method POST -PostEmpty -Expected 400 -Code "INVALID_JSON"
Check-Status -Label "GET /docs/ccp-openapi.yaml (#17)" -Uri "$BaseUrl/docs/ccp-openapi.yaml" -Expected 200
# 注：Pages clean-URL 会把 /docs/api.html 308 到 /docs/api，此处跟随重定向校验终态 200
$r18 = (& curl.exe -s -L -o NUL -w "%{http_code}" --max-time $TimeoutSec "$BaseUrl/docs/api.html" 2>&1)
if ($r18 -eq "200") { Write-Pass "GET /docs/api.html (#18, follow redirect) -> 200" } else { Write-Fail "GET /docs/api.html (#18) expected 200 got $r18" }

Write-H1 "A6-6 错误码验证"
Check-ErrorCode -Label "404 不存在能力锚点" -Uri "$BaseUrl/api/ccp/v1/capabilities/nonexistent-999" -Expected 404 -Code "CAPABILITY_NOT_FOUND"
Check-ErrorCode -Label "400 空 body telemetry" -Uri "$BaseUrl/api/ccp/v1/telemetry" -Method POST -PostEmpty -Expected 400 -Code "INVALID_JSON"
$r405 = Curl-Raw -Uri "$BaseUrl/api/ccp/v1/capabilities" -Method DELETE
if ($r405.Code -eq 405) { Write-Pass "405 DELETE /capabilities -> $($r405.Code)" } else { Write-Fail "405 expected got $($r405.Code)" }

Verify-Sdk

Write-H1 "汇总"
Write-Host "  通过: $script:Pass"
Write-Host "  失败: $script:Fail"
if ($script:Fail -eq 0) { Write-Host "  总体: PASS" -ForegroundColor Green; exit 0 }
else { Write-Host "  总体: FAIL" -ForegroundColor Red; exit 1 }

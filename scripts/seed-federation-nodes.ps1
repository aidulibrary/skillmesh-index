# ============================================================
# CCP 联邦种子节点注册脚本
# ============================================================
# 用途：在 SkillMesh 主节点注册 2 个种子联邦节点
# 用法：.\scripts\seed-federation-nodes.ps1
# 前提：SkillMesh 主节点已部署且可访问
# ============================================================

param(
    [string]$BaseUrl = "https://skillmesh.礼字号.中国/api/ccp/v1"
)

$ErrorActionPreference = "Continue"
$Utf8Encoding = [System.Text.Encoding]::UTF8

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " CCP 联邦种子节点注册" -ForegroundColor Cyan
Write-Host " 目标：$BaseUrl" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ----------------------------------------------------------
# 节点 1：生物信息学 CCP 节点（学术节点）
# ----------------------------------------------------------
$academicNode = @{
    id           = "bioinfo-ccp.lab.ac.cn"
    name         = "生物信息学 CCP 节点"
    endpoint     = "https://bioinfo-ccp.lab.ac.cn/api/ccp/v1"
    description  = "高校生物信息学实验室维护的 CCP 联邦节点，聚焦生物信息学工具、序列分析、蛋白质结构预测等学术能力锚点。"
    trust_weight = 0.85
} | ConvertTo-Json

Write-Host "[1/2] 注册学术节点：bioinfo-ccp.lab.ac.cn" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/federation/nodes" `
        -Method POST `
        -ContentType "application/json; charset=utf-8" `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($academicNode)) `
        -ErrorAction Stop
    Write-Host "  OK 注册成功" -ForegroundColor Green
    Write-Host "  节点 ID：$($response.id)" -ForegroundColor Gray
    Write-Host "  状态：$($response.status)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 409) {
        Write-Host "  WARN 节点已存在（409），跳过" -ForegroundColor DarkYellow
    } else {
        Write-Host "  ERROR 注册失败：$($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""

# ----------------------------------------------------------
# 节点 2：法律 AI 能力节点（行业节点）
# ----------------------------------------------------------
$industryNode = @{
    id           = "legal-ai-ccp.example.com"
    name         = "法律 AI 能力节点"
    endpoint     = "https://legal-ai-ccp.example.com/api/ccp/v1"
    description  = "法律科技社区维护的 CCP 联邦节点，聚焦合同审查、案例检索、法规解析、文书生成等法律 AI 能力锚点。"
    trust_weight = 0.80
} | ConvertTo-Json

Write-Host "[2/2] 注册行业节点：legal-ai-ccp.example.com" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/federation/nodes" `
        -Method POST `
        -ContentType "application/json; charset=utf-8" `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($industryNode)) `
        -ErrorAction Stop
    Write-Host "  OK 注册成功" -ForegroundColor Green
    Write-Host "  节点 ID：$($response.id)" -ForegroundColor Gray
    Write-Host "  状态：$($response.status)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 409) {
        Write-Host "  WARN 节点已存在（409），跳过" -ForegroundColor DarkYellow
    } else {
        Write-Host "  ERROR 注册失败：$($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " 验证：查询联邦节点列表" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

try {
    $nodes = Invoke-RestMethod -Uri "$BaseUrl/federation/nodes" `
        -Method GET `
        -ErrorAction Stop
    $count = if ($nodes -is [array]) { $nodes.Count } elseif ($nodes.results) { $nodes.results.Count } else { 0 }
    Write-Host "  联邦节点总数：$count" -ForegroundColor Green
    
    if ($nodes -is [array]) {
        foreach ($node in $nodes) {
            Write-Host "    - $($node.id) ($($node.name)) [trust=$($node.trust_weight)]" -ForegroundColor Gray
        }
    } elseif ($nodes.results) {
        foreach ($node in $nodes.results) {
            Write-Host "    - $($node.id) ($($node.name)) [trust=$($node.trust_weight)]" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ERROR 查询失败：$($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " 种子节点注册完成" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
# MGbaojia 项目备份脚本
# 用法：在项目目录下运行 .\backup.ps1 或在 PowerShell 中 & "D:\Users\Desktop\MGbaojia\backup.ps1"

$projectRoot = $PSScriptRoot
if (-not $projectRoot) { $projectRoot = Get-Location }
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $projectRoot "backup_$timestamp"

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$files = @(
    "index.html",
    "script.js",
    "style.css",
    "需求.txt",
    "README.md",
    ".gitignore"
)
foreach ($f in $files) {
    $src = Join-Path $projectRoot $f
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $backupDir $f) -Force
        Write-Host "已备份: $f"
    }
}

$traeDir = Join-Path $projectRoot ".trae"
$traeBackup = Join-Path $backupDir ".trae"
if (Test-Path $traeDir) {
    New-Item -ItemType Directory -Path $traeBackup -Force | Out-Null
    Copy-Item (Join-Path $traeDir "*") $traeBackup -Recurse -Force
    Write-Host "已备份: .trae/"
}

Write-Host ""
Write-Host "备份完成: $backupDir" -ForegroundColor Green

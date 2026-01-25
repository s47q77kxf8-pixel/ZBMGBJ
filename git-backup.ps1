# MGbaojia Git 备份脚本
# 用法：在项目目录下运行 .\git-backup.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Git 备份脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否在 git 仓库中
if (-not (Test-Path ".git")) {
    Write-Host "当前目录不是 git 仓库，正在初始化..." -ForegroundColor Yellow
    git init
    Write-Host ""
}

# 显示当前状态
Write-Host "当前 git 状态：" -ForegroundColor Green
git status
Write-Host ""

# 添加所有更改
Write-Host "添加所有更改到暂存区..." -ForegroundColor Green
git add .
Write-Host ""

# 显示将要提交的文件
Write-Host "将要提交的文件：" -ForegroundColor Green
git status --short
Write-Host ""

# 创建提交
$defaultMsg = "备份: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$commitMsg = Read-Host "请输入提交信息（直接回车使用默认信息: $defaultMsg）"
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $commitMsg = $defaultMsg
}

Write-Host ""
Write-Host "正在创建提交..." -ForegroundColor Green
git commit -m $commitMsg
Write-Host ""

# 显示提交历史
Write-Host "最近的提交记录：" -ForegroundColor Green
git log --oneline -5
Write-Host ""

# 检查是否有远程仓库
$remotes = git remote -v
if ([string]::IsNullOrWhiteSpace($remotes)) {
    Write-Host "提示：未配置远程仓库" -ForegroundColor Yellow
    Write-Host "如需推送到远程，请先添加远程仓库：" -ForegroundColor Yellow
    Write-Host "  git remote add origin <远程仓库URL>" -ForegroundColor Yellow
    Write-Host "  git push -u origin master" -ForegroundColor Yellow
} else {
    Write-Host ""
    $pushConfirm = Read-Host "是否推送到远程仓库？(y/n)"
    if ($pushConfirm -eq "y" -or $pushConfirm -eq "Y") {
        Write-Host "正在推送到远程仓库..." -ForegroundColor Green
        git push
        Write-Host "推送完成！" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Git 备份完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

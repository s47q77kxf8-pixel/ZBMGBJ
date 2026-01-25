@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo Git 备份脚本
echo ========================================
echo.

REM 检查是否在 git 仓库中
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo 当前目录不是 git 仓库，正在初始化...
    git init
    echo.
)

REM 显示当前状态
echo 当前 git 状态：
git status
echo.

REM 添加所有更改
echo 添加所有更改到暂存区...
git add .
echo.

REM 显示将要提交的文件
echo 将要提交的文件：
git status --short
echo.

REM 创建提交
set /p commit_msg="请输入提交信息（直接回车使用默认信息）: "
if "%commit_msg%"=="" set commit_msg=备份: %date% %time%

echo.
echo 正在创建提交...
git commit -m "%commit_msg%"
echo.

REM 显示提交历史
echo 最近的提交记录：
git log --oneline -5
echo.

REM 检查是否有远程仓库
git remote -v >nul 2>&1
if errorlevel 1 (
    echo 提示：未配置远程仓库
    echo 如需推送到远程，请先添加远程仓库：
    echo   git remote add origin <远程仓库URL>
    echo   git push -u origin master
) else (
    echo.
    set /p push_confirm="是否推送到远程仓库？(y/n): "
    if /i "%push_confirm%"=="y" (
        echo 正在推送到远程仓库...
        git push
        echo 推送完成！
    )
)

echo.
echo ========================================
echo Git 备份完成！
echo ========================================
pause

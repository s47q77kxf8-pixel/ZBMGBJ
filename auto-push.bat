@echo off

:check_network
echo 正在检查网络连接...
ping -n 1 github.com > nul
if %errorlevel% equ 0 (
    echo 网络连接正常，开始推送...
    
    git --version > nul 2>&1
    if %errorlevel% neq 0 (
        echo 错误：未找到git命令，请确保git已安装并添加到PATH
        pause
        exit /b 1
    )
    
    git status > nul 2>&1
    if %errorlevel% neq 0 (
        echo 错误：当前目录不是git仓库
        pause
        exit /b 1
    )
    
    git push
    if %errorlevel% equ 0 (
        echo 推送成功！
        pause
        exit /b 0
    ) else (
        echo 推送失败，5分钟后重试...
        ping -n 301 127.0.0.1 > nul
        goto check_network
    )
) else (
    echo 网络连接失败，5分钟后重试...
    ping -n 301 127.0.0.1 > nul
    goto check_network
)
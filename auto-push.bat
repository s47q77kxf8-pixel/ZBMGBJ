@echo off

:check_network
ping -n 1 github.com > nul
if %errorlevel% equ 0 (
    echo 网络连接正常，开始推送...
    git push
    if %errorlevel% equ 0 (
        echo 推送成功！
        exit /b 0
    ) else (
        echo 推送失败，稍后重试...
        timeout /t 300 > nul
        goto check_network
    )
) else (
    echo 网络连接失败，稍后重试...
    timeout /t 300 > nul
    goto check_network
)
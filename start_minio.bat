@echo off
title MinIO Object Storage
cd /d %~dp0
echo ========================================================
echo   KHOI DONG MINIO OBJECT STORAGE (DOCKER)
echo ========================================================
echo   - S3 API Endpoint: http://localhost:9000
echo   - Web Console UI:  http://localhost:9001
echo   - Tai khoan:       minioadmin
echo   - Mat khau:        minioadmin
echo ========================================================
echo Dang khoi dong container MinIO...
docker compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [CANH BAO] Khong the ket noi den Docker!
    echo Vui long mo Docker Desktop truoc roi chay lai file bat nay.
) else (
    echo.
    echo [THANH CONG] MinIO da duoc khoi dong ngam!
    echo Ban co the truy cap Web Console tai: http://localhost:9001
)
pause

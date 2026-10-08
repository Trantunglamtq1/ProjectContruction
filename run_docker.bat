@echo off
title ConstructInspect Enterprise - Full Docker Orchestration
cd /d %~dp0

echo ======================================================================
echo   KHOI DONG TOAN BO HE THONG VOI DOCKER (FULL-STACK ALL-IN-ONE)
echo ======================================================================
echo   1. Database:   SQL Server 2022 (Port 1433)
echo   2. Storage:    MinIO S3 (Port 9000 & Web Console Port 9001)
echo   3. Backend:    .NET 8 Clean Architecture API (Port 5092)
echo   4. Frontend:   React 19 + Nginx Reverse Proxy (Port 5173)
echo ======================================================================
echo.
echo Dang build va khoi dong cac containers...
docker compose up -d --build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LOI] Khong the khoi dong Docker! Vui long kiem tra Docker Desktop da bat chua.
) else (
    echo.
    echo ======================================================================
    echo   TAT CA DICH VU DA CHAY THANH CONG!
    echo ======================================================================
    echo   - Ung dung Web Frontend: http://localhost:5173
    echo   - Backend Swagger API:   http://localhost:5092/swagger
    echo   - MinIO Storage Console: http://localhost:9001 (User: minioadmin / Pass: minioadmin)
    echo   - Database SQL Server:   localhost,1433 (User: sa / Pass: YourStrong@Passw0rd123!)
    echo ======================================================================
    echo   De dung he thong, chay file 'stop_docker.bat' hoac 'docker compose down'
    echo ======================================================================
)
pause

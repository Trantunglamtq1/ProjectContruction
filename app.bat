@echo off
title ConstructInspect Enterprise Controller
cd /d %~dp0

:MENU
cls
echo ======================================================================
echo          CONSTRUCTINSPECT ENTERPRISE - DIEU KHIEN HE THONG
echo ======================================================================
echo   [1] KHOI DONG TOAN BO VOI DOCKER (Database + MinIO + API + Web)
echo   [2] DUNG TOAN BO DOCKER (docker compose down)
echo   [3] XEM LOGS DOCKER (docker compose logs -f)
echo   ------------------------------------------------------------------
echo   [4] Chay Dev Local khong Docker (Dotnet run + Vite frontend)
echo   [5] Dung cac tien trinh Dev Local (Kill dotnet / node)
echo   ------------------------------------------------------------------
echo   [0] Thoat
echo ======================================================================
set /p opt="Vui long chon chuc nang [0-5]: "

if "%opt%"=="1" goto START_DOCKER
if "%opt%"=="2" goto STOP_DOCKER
if "%opt%"=="3" goto LOGS_DOCKER
if "%opt%"=="4" goto START_LOCAL
if "%opt%"=="5" goto STOP_LOCAL
if "%opt%"=="0" exit /b 0

echo Lua chon khong hop le!
timeout /t 2 >nul
goto MENU

:START_DOCKER
echo.
echo Dang khoi dong toan bo containers Docker...
docker compose up -d --build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LOI] Khong the khoi dong Docker! Vui long kiem tra Docker Desktop da mo chua.
) else (
    echo.
    echo ======================================================================
    echo   TAT CA DICH VU DOCKER DA KHOI DONG THANH CONG!
    echo ======================================================================
    echo   - Web Frontend:    http://localhost:5173
    echo   - Backend Swagger: http://localhost:5092/swagger
    echo   - MinIO Storage:   http://localhost:9001 (User: minioadmin / Pass: minioadmin)
    echo   - SQL Server:      localhost,1433 (User: sa / Pass: YourStrong@Passw0rd123!)
    echo ======================================================================
)
echo.
pause
goto MENU

:STOP_DOCKER
echo.
echo Dang dung cac containers Docker...
docker compose down
echo.
echo Da dung toan bo he thong Docker thanh cong!
pause
goto MENU

:LOGS_DOCKER
echo.
echo Dang mo logs Docker (Nhan Ctrl+C de thoat logs ve menu)...
docker compose logs -f
goto MENU

:START_LOCAL
echo.
echo ======================================================================
echo   KHOI DONG DEV LOCAL (BACKEND + FRONTEND)
echo ======================================================================
echo   - Backend API:  http://localhost:5092/swagger
echo   - Frontend Web: http://localhost:5173
echo.
echo   * Nhan [Ctrl + C] de dung tien trinh.
echo ======================================================================
npm --prefix frontend run dev:all
pause
goto MENU

:STOP_LOCAL
echo.
echo Dang dung cac tien trinh Dotnet va Node local...
taskkill /F /IM ConstructionProject.API.exe >nul 2>&1
taskkill /F /IM dotnet.exe >nul 2>&1
echo Da dung tien trinh local thanh cong!
pause
goto MENU

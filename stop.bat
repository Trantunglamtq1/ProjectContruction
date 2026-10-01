@echo off
echo ================================================================
echo   DANG DUNG CONSTRUCTINSPECT ENTERPRISE (BACKEND + FRONTEND)...
echo ================================================================
taskkill /F /IM ConstructionProject.API.exe >nul 2>&1
taskkill /F /IM dotnet.exe >nul 2>&1
echo Da dung thanh cong Backend va Frontend!

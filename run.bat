@echo off
title ConstructInspect Enterprise (Backend + Frontend)
cd /d %~dp0

echo ================================================================
echo   CONSTRUCTINSPECT ENTERPRISE (BACKEND + FRONTEND)
echo ================================================================
echo   - Backend:  http://localhost:5092/swagger
echo   - Frontend: http://localhost:5173
echo.
echo   * Chay truc tiep tai terminal nay.
echo   * Nhan [Ctrl + C] de dung tien trinh.
echo ================================================================
echo.

npm --prefix frontend run dev:all

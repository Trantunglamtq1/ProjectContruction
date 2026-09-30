@echo off
echo ===================================================
echo   KHOI DONG BACKEND API (PORT: 5092)
echo ===================================================
echo Dang khoi chay server tai http://localhost:5092/swagger
dotnet run --project src/ConstructionProject.API --urls "http://localhost:5092"
pause

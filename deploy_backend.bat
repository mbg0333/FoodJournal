@echo off
echo ===================================================
echo     FOOD JOURNAL - BACKEND DEPLOYMENT SCRIPT
echo ===================================================
echo.
echo [STEP 1] Logging into Google...
call .\node_modules\.bin\firebase login
if %errorlevel% neq 0 ( exit /b )

echo.
echo [STEP 2] Deploying Security Function...
call .\node_modules\.bin\firebase deploy --only functions
if %errorlevel% neq 0 (
    echo Deployment failed!
    pause
    exit /b
)

echo.
echo ===================================================
echo        SUCCESS! Backend is live.
echo ===================================================
pause

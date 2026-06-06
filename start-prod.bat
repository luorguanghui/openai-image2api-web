@echo off
echo ==============================
echo   OpenAI Image2API Web - Production
echo ==============================
echo.

echo [1/4] Installing dependencies...
call npm run install:all
if %errorlevel% neq 0 (
    echo Failed to install dependencies!
    pause
    exit /b 1
)

echo.
echo [2/4] Building client...
call npm run build:client
if %errorlevel% neq 0 (
    echo Client build failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Building server...
call npm run build:server
if %errorlevel% neq 0 (
    echo Server build failed!
    pause
    exit /b 1
)

echo.
echo [4/4] Starting production server...
echo Server: http://localhost:3001
echo.
call npm run start
pause

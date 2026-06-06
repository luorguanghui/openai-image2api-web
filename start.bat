@echo off
echo ==============================
echo   OpenAI Image2API Web Starter
echo ==============================
echo.

echo [1/3] Installing root dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Failed to install root dependencies!
    pause
    exit /b 1
)

echo.
echo [2/3] Installing server dependencies...
cd server
call npm install
if %errorlevel% neq 0 (
    echo Failed to install server dependencies!
    pause
    exit /b 1
)
cd ..

echo.
echo [3/3] Installing client dependencies...
cd client
call npm install
if %errorlevel% neq 0 (
    echo Failed to install client dependencies!
    pause
    exit /b 1
)
cd ..

echo.
echo ==============================
echo   All dependencies installed!
echo   Starting dev servers...
echo ==============================
echo.

call npm run dev
pause

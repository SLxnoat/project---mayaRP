@echo off
TITLE Maya RP - Launching...
echo.
echo ========================================
echo   MAYA RP - AI ROLEPLAY COMPANION
echo ========================================
echo.

:: Check for node_modules
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm install failed. Please ensure Node.js is installed.
        pause
        exit /b %ERRORLEVEL%
    )
)

echo [INFO] Starting development server on port 3000...
echo [INFO] Your browser should open automatically to http://localhost:3000
echo.

:: Open browser after a short delay
start http://localhost:3000

:: Run the dev server
call npm run dev

pause

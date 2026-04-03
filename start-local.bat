@echo off
echo ========================================
echo OpenAgent Framework - Local Deployment
echo ========================================
echo.

REM Check Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not running
    echo Please install Docker Desktop first
    pause
    exit /b 1
)

REM Stop old services
echo [1/4] Stopping old services...
docker-compose down 2>nul

REM Build and start services
echo [2/4] Building and starting services...
docker-compose up -d --build

REM Wait for services to start
echo [3/4] Waiting for services to start...
timeout /t 10 /nobreak >nul

REM Check status
echo [4/4] Checking service status...
docker-compose ps

echo.
echo ========================================
echo OpenAgent Framework is running!
echo ========================================
echo.
echo Services:
echo   - OpenAgent API:     http://localhost:3000
echo   - PostgreSQL:        localhost:5432
echo   - Redis:             localhost:6379
echo.
echo Commands:
echo   - View logs:         docker-compose logs -f
echo   - Stop services:     docker-compose down
echo   - Restart:           docker-compose restart
echo.

REM Open browser
echo Opening browser...
start http://localhost:3000

pause

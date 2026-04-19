@echo off
title Coffee Project

echo.
echo  ==============================
echo   Coffee Project — Dev Server
echo  ==============================
echo.

:: Kill anything holding port 4000 or 5173
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Move to project root
cd /d "%~dp0"

:: Seed built-in recipes (safe to re-run, skips existing)
echo [1/2] Seeding built-in recipes...
node backend/seedRecipes.js
echo.

:: Start backend and frontend concurrently
echo [2/2] Starting servers...
echo  Backend  ^> http://localhost:4000
echo  Frontend ^> http://localhost:5173
echo.
echo  Press Ctrl+C to stop.
echo.

npm run dev

@echo off
TITLE Multi-File Player - Simple Build

ECHO ================================
ECHO Multi-File Player Build Tool
ECHO ================================
ECHO.
ECHO Select build target:
ECHO 1. Windows only
ECHO 2. macOS only
ECHO 3. All platforms (Windows, macOS, Linux)
ECHO.

CHOICE /C 123 /M "Enter your choice"

IF ERRORLEVEL 3 GOTO all
IF ERRORLEVEL 2 GOTO mac
IF ERRORLEVEL 1 GOTO windows

:windows
ECHO.
ECHO Building for Windows...
CALL npm install
CALL npm run dist
GOTO end

:mac
ECHO.
ECHO Building for macOS...
ECHO Note: To build for macOS, you need to run this on a macOS machine
CALL npm install
CALL npm run dist-mac
GOTO end

:all
ECHO.
ECHO Building for all platforms...
ECHO Note: Building for all platforms requires appropriate build environments
CALL npm install
CALL npm run dist-all
GOTO end

:end
ECHO.
ECHO Build process finished. Check the dist folder for the executable(s).
ECHO.
PAUSE
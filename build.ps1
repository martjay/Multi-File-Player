Write-Host "===============================" -ForegroundColor Green
Write-Host "Multi-File Player Build Script" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green

Write-Host ""
Write-Host "Select build target:" -ForegroundColor Yellow
Write-Host "1. Windows only" -ForegroundColor Gray
Write-Host "2. macOS only" -ForegroundColor Gray
Write-Host "3. All platforms (Windows, macOS, Linux)" -ForegroundColor Gray
Write-Host ""

do {
    $choice = Read-Host "Enter your choice (1-3)"
} until ($choice -match '^[123]$')

Write-Host ""
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check if Node.js is installed
try {
    $nodeVersion = & node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Node.js not found. Please install Node.js first." -ForegroundColor Red
    Pause
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = & npm --version
    Write-Host "npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: npm not found. Please install Node.js and npm first." -ForegroundColor Red
    Pause
    exit 1
}

Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to install dependencies!" -ForegroundColor Red
    Pause
    exit 1
}

Write-Host ""
Write-Host "Building application..." -ForegroundColor Yellow

switch ($choice) {
    "1" {
        Write-Host "Building for Windows..." -ForegroundColor Cyan
        npm run dist
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: Windows build failed!" -ForegroundColor Red
            Pause
            exit 1
        }
    }
    "2" {
        Write-Host "Building for macOS..." -ForegroundColor Cyan
        Write-Host "Note: To build for macOS, you need to run this on a macOS machine" -ForegroundColor Yellow
        npm run dist-mac
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: macOS build failed!" -ForegroundColor Red
            Pause
            exit 1
        }
    }
    "3" {
        Write-Host "Building for all platforms..." -ForegroundColor Cyan
        Write-Host "Note: Building for all platforms requires appropriate build environments" -ForegroundColor Yellow
        npm run dist-all
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: Multi-platform build failed!" -ForegroundColor Red
            Pause
            exit 1
        }
    }
}

Write-Host ""
Write-Host "===============================" -ForegroundColor Green
Write-Host "Build completed successfully!" -ForegroundColor Green
Write-Host "Executable files are located in the dist folder" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green

Write-Host ""
Write-Host "Press any key to exit..."
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
#!/bin/bash

# Multi-File Player macOS Build Script

echo "==============================="
echo "Multi-File Player macOS Build"
echo "==============================="

echo ""
echo "Checking prerequisites..."

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "Error: Node.js not found. Please install Node.js first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"

# Check if npm is installed
if ! command -v npm &> /dev/null
then
    echo "Error: npm not found. Please install Node.js and npm first."
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "npm version: $NPM_VERSION"

echo ""
echo "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "Error: Failed to install dependencies!"
    exit 1
fi

echo ""
echo "Building application for macOS..."
npm run dist-mac
if [ $? -ne 0 ]; then
    echo "Error: macOS build failed!"
    exit 1
fi

echo ""
echo "==============================="
echo "macOS build completed successfully!"
echo "Application package is located in the dist folder"
echo "==============================="

echo ""
echo "Press any key to exit..."
read -n 1 -s
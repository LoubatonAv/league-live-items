@echo off
start "League Backend" powershell -NoExit -Command "Set-Location -LiteralPath '%~dp0server'; node .\server.js"
start "League Frontend" powershell -NoExit -Command "Set-Location -LiteralPath '%~dp0client'; npm.cmd run dev"

@echo off
start "League Backend" powershell -NoExit -Command "Set-Location -LiteralPath 'C:\Users\Avner\Desktop\league-live-items\server client'; node .\server.js"
start "League Frontend" powershell -NoExit -Command "Set-Location -LiteralPath 'C:\Users\Avner\Desktop\league-live-items\client'; npm.cmd run dev"

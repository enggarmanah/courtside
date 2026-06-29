@echo off
setlocal
cd /d "%~dp0"

set "URL=https://courtside-crawler-trigger-430782775816.asia-southeast1.run.app"

echo Triggering full booking crawl...
powershell -Command "$token = $(gcloud auth print-identity-token); Invoke-RestMethod -Uri '%URL%' -Method POST -ContentType 'application/json' -Body '{\"command\":\"\"}' -Headers @{'Authorization'=\"Bearer $token\"}"
echo.
echo Triggered. Check Cloud Run logs for progress.
pause

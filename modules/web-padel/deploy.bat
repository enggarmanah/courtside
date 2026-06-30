@echo off
setlocal
cd /d "%~dp0"

copy env-prd.env .env
set "GOOGLE_APPLICATION_CREDENTIALS=%~dp0firebase-key.json" & REM firebase authentication for deployment
call npm run build && node firebase-deploy-wrapper.cjs deploy --project padelitics-id
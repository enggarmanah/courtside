@echo off
setlocal
cd /d "%~dp0"

set "PROJECT=padelitics-api"
set "REGION=asia-southeast1"
set "SERVICE=courtside-crawler-trigger"
set "JOB=courtside-crawler-job"
set "SA_NAME=courtside-crawler-sa"
set "SA_EMAIL=%SA_NAME%@%PROJECT%.iam.gserviceaccount.com"
set "USER_EMAIL=enggarmanah@gmail.com"

echo [1/7] Setting project to %PROJECT%
call gcloud config set project %PROJECT%
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to set project.
    exit /b %ERRORLEVEL%
)

echo [2/7] Ensuring service account exists...
call gcloud iam service-accounts describe %SA_EMAIL% >nul 2>&1
if %ERRORLEVEL% neq 0 (
    call gcloud iam service-accounts create %SA_NAME% --display-name="Courtside Crawler"
)
call gcloud iam service-accounts describe %SA_EMAIL% >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: Service account %SA_EMAIL% does not exist and could not be created.
    exit /b 1
)

echo [3/7] Ensuring secret exists...
call gcloud secrets describe courtside-config >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: Secret 'courtside-config' not found. Run setup-gcp.sh first or create it manually:
    echo   gcloud secrets create courtside-config --data-file=config-prd.properties --replication-policy=automatic
    exit /b 1
)

echo [4/7] Granting secret access to service account...
call gcloud secrets add-iam-policy-binding courtside-config ^
    --member="serviceAccount:%SA_EMAIL%" ^
    --role="roles/secretmanager.secretAccessor" ^
    --quiet
call gcloud iam service-accounts add-iam-policy-binding %SA_EMAIL% ^
    --member="user:%USER_EMAIL%" ^
    --role="roles/iam.serviceAccountUser" ^
    --quiet
if %ERRORLEVEL% neq 0 (
    echo Warning: Failed to grant actAs permission. You may need to run this manually.
)

echo [5/7] Building container image...
call gcloud builds submit --tag gcr.io/%PROJECT%/%SERVICE%
if %ERRORLEVEL% neq 0 (
    echo Error: Container build failed.
    exit /b %ERRORLEVEL%
)

echo [6/7] Deploying Cloud Run trigger service...
call gcloud run deploy %SERVICE% ^
    --image gcr.io/%PROJECT%/%SERVICE% ^
    --region %REGION% ^
    --service-account %SA_EMAIL% ^
    --set-env-vars="CLOUD_RUN=1" ^
    --no-allow-unauthenticated ^
    --memory 256Mi ^
    --timeout 60
if %ERRORLEVEL% neq 0 (
    echo Error: Cloud Run deploy failed.
    exit /b %ERRORLEVEL%
)

echo [7/7] Creating Cloud Run Job...
call gcloud run jobs create %JOB% ^
    --image gcr.io/%PROJECT%/%SERVICE% ^
    --region %REGION% ^
    --service-account %SA_EMAIL% ^
    --set-env-vars="CONFIG_SECRET_PATH=/secrets/config.json" ^
    --update-secrets=/secrets/config.json=courtside-config:latest ^
    --memory 512Mi ^
    --task-timeout 3600 ^
    --project=%PROJECT%
if %ERRORLEVEL% neq 0 (
    echo Warning: Cloud Run Job creation failed or already exists.
)

echo.
echo Deployment successful!
echo.
echo Trigger Service URL:
gcloud run services describe %SERVICE% --region %REGION% --format="value(status.url)"
echo.
echo Job Name: %JOB%
echo.
echo Scheduler URL (update cloud_run.bat):
gcloud scheduler jobs describe courtside-crawler-daily --location=%REGION% --format="value(httpTarget.uri)" --project=%PROJECT%
pause

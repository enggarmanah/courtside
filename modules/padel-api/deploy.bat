@echo off
setlocal
cd /d "%~dp0"

set "DEPLOY_LARGE_FILE_MB=10"

echo [1/3] Setting project to padelitics-api
call gcloud config set project padelitics-api
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to set project.
    exit /b %ERRORLEVEL%
)

copy config-prd.properties config.properties

echo [2/3] Checking deploy bundle...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference = 'Stop';" ^
    "$thresholdBytes = %DEPLOY_LARGE_FILE_MB% * 1MB;" ^
    "$files = @(gcloud meta list-files-for-upload .);" ^
    "$items = foreach ($file in $files) { if (Test-Path -LiteralPath $file -PathType Leaf) { Get-Item -LiteralPath $file } };" ^
    "$totalBytes = ($items | Measure-Object -Property Length -Sum).Sum;" ^
    "Write-Host ('Deployable files: {0}, total size: {1:N2} MB' -f $items.Count, ($totalBytes / 1MB));" ^
    "$large = $items | Where-Object { $_.Length -ge $thresholdBytes } | Sort-Object Length -Descending;" ^
    "if ($large.Count -gt 0) {" ^
    "  Write-Host 'Large deployable files detected:';" ^
    "  $large | ForEach-Object { Write-Host ('  {0,8:N2} MB  {1}' -f ($_.Length / 1MB), $_.FullName) };" ^
    "  exit 2;" ^
    "}"
if %ERRORLEVEL% neq 0 (
    echo Error: Deployment aborted because large deployable files were detected.
    exit /b %ERRORLEVEL%
)

echo [3/3] Deploying to Google App Engine...
call gcloud app deploy --quiet
if %ERRORLEVEL% neq 0 (
    echo Error: Deployment failed.
    exit /b %ERRORLEVEL%
)

echo.
echo Deployment successful!
pause

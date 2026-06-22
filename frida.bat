@echo off
setlocal enabledelayedexpansion

set FRIDA=C:\Users\hp\AppData\Local\Programs\Python\Python311\Scripts\frida.exe
set ADB=C:\Users\hp\AppData\Local\Android\Sdk\platform-tools\adb.exe
set EMULATOR=C:\Users\hp\AppData\Local\Android\Sdk\emulator\emulator.exe
set AVD_NAME=Pixel_9x
set ADB_TARGET=emulator-5554
set ADB_CMD=%ADB% -s %ADB_TARGET%
set SCRIPT=C:\Workspace\courtside\ssl-hook-debug.js
set OUTDIR=C:\Workspace\courtside\output
set MAINLOG=%OUTDIR%\api_capture.log
set FRIDALOG=%OUTDIR%\frida_output.log
set PKG=com.startive.courtside.app
set MAX_RETRIES=3
set RETRY_COUNT=0

echo ===== COURTSIDE API CAPTURE =====

REM === CHECK / START EMULATOR ===
:check_emu
%ADB% devices > "%TEMP%\devices.txt" 2>&1
findstr "%ADB_TARGET%.*device$" "%TEMP%\devices.txt" >nul
if !errorlevel! equ 0 goto :check_boot
findstr "%ADB_TARGET%.*offline$" "%TEMP%\devices.txt" >nul
if !errorlevel! equ 0 (
    del "%TEMP%\devices.txt" 2>nul
    echo Device is offline. Killing...
    goto :kill_and_retry
)
findstr "%ADB_TARGET%" "%TEMP%\devices.txt" >nul
if !errorlevel! equ 0 (
    del "%TEMP%\devices.txt" 2>nul
    echo Device state unknown. Killing...
    goto :kill_and_retry
)
del "%TEMP%\devices.txt" 2>nul
goto :start_emu

:check_boot
del "%TEMP%\devices.txt" 2>nul
%ADB_CMD% shell getprop sys.boot_completed > "%TEMP%\boot_check.txt" 2>&1
findstr "1" "%TEMP%\boot_check.txt" >nul
del "%TEMP%\boot_check.txt" 2>nul
if !errorlevel! equ 0 goto :verify_responsive
echo Waiting for boot...
ping -n 11 127.0.0.1 >nul
goto :check_emu

:start_emu
set BOOT_WAIT=0
if !RETRY_COUNT! gtr %MAX_RETRIES% (
    echo Failed after %MAX_RETRIES% attempts. Exiting.
    exit /b 1
)
if !RETRY_COUNT! equ 0 (
    echo No emulator found. Starting %AVD_NAME%
) else (
    echo Starting %AVD_NAME% (attempt !RETRY_COUNT!/%MAX_RETRIES%)
)
start "" "%EMULATOR%" -avd %AVD_NAME% -no-snapshot -no-boot-anim
echo Waiting for emulator to boot...

:boot_loop
set /a BOOT_WAIT+=1
if !BOOT_WAIT! gtr 60 (
    echo Boot timed out (10 min).
    goto :kill_and_retry
)
ping -n 11 127.0.0.1 >nul
%ADB% devices > "%TEMP%\devices.txt" 2>&1
findstr "%ADB_TARGET%.*device$" "%TEMP%\devices.txt" >nul
if !errorlevel! equ 0 (
    %ADB_CMD% shell getprop sys.boot_completed > "%TEMP%\boot_check.txt" 2>&1
    findstr "1" "%TEMP%\boot_check.txt" >nul
    del "%TEMP%\boot_check.txt" 2>nul
    if !errorlevel! equ 0 goto :boot_done
)
findstr "%ADB_TARGET%" "%TEMP%\devices.txt" >nul
if !errorlevel! equ 0 (
    echo Booting...
) else (
    echo Not detected yet...
)
del "%TEMP%\devices.txt" 2>nul
goto :boot_loop

:boot_done
del "%TEMP%\devices.txt" 2>nul
goto :verify_responsive

:verify_responsive
echo Verifying responsiveness...
%ADB% devices > "%TEMP%\resp.txt" 2>&1
findstr "%ADB_TARGET%.*device$" "%TEMP%\resp.txt" >nul
del "%TEMP%\resp.txt" 2>nul
if !errorlevel! equ 0 (
    set RETRY_COUNT=0
    echo Emulator ready.
    goto :emu_ready
)
echo Not responsive. Retrying...
goto :kill_and_retry

:kill_and_retry
set /a RETRY_COUNT+=1
if !RETRY_COUNT! gtr %MAX_RETRIES% (
    echo Unresponsive after %MAX_RETRIES% retries. Exiting.
    exit /b 1
)
echo Killing emulator (retry !RETRY_COUNT!/%MAX_RETRIES%)
%ADB_CMD% emu kill >nul 2>nul
ping -n 5 127.0.0.1 >nul
taskkill /f /im qemu-system-x86_64* >nul 2>nul
taskkill /f /im qemu-system-i386* >nul 2>nul
ping -n 3 127.0.0.1 >nul
goto :start_emu

:emu_ready
echo Rooting adb...
%ADB_CMD% root >nul 2>nul
ping -n 5 127.0.0.1 >nul

echo Setting SELinux...
%ADB_CMD% shell setenforce 0 >nul 2>nul

echo Killing old frida...
taskkill /f /im frida.exe >nul 2>nul
%ADB_CMD% shell killall frida-server >nul 2>nul
ping -n 2 127.0.0.1 >nul

echo Starting frida-server (background)...
start /b "" cmd /c "%ADB_CMD% shell /data/local/tmp/frida-server-17.15.0-android-x86_64 >nul 2>&1"
ping -n 4 127.0.0.1 >nul

echo Stopping app...
%ADB_CMD% shell am force-stop %PKG% >nul 2>nul
ping -n 3 127.0.0.1 >nul

echo Launching app...
%ADB_CMD% shell am start -n %PKG%/com.startive.courtside.MainActivity >nul 2>nul
ping -n 6 127.0.0.1 >nul

echo Finding PID...
echo ===== CAPTURE STARTED %date% %time% ===== > "%MAINLOG%"

set PID=
for /l %%j in (1,1,15) do (
    %ADB_CMD% shell ps -A > "%TEMP%\ps_out.txt" 2>&1
    findstr "%PKG%" "%TEMP%\ps_out.txt" >nul
    if !errorlevel! equ 0 (
        for /f "tokens=2" %%i in ('findstr "%PKG%" "%TEMP%\ps_out.txt"') do set PID=%%i
        del "%TEMP%\ps_out.txt" 2>nul
        goto :found
    )
    del "%TEMP%\ps_out.txt" 2>nul
    ping -n 3 127.0.0.1 >nul
)
echo PID not found after 45s.
exit /b 1

:found
echo PID: !PID!

echo Attaching Frida (60s)...
del "%FRIDALOG%" 2>nul
start /b "" "%FRIDA%" -D %ADB_TARGET% !PID! -l "%SCRIPT%" > "%FRIDALOG%" 2>&1

echo Capturing 60s -- interact with the app on emulator now...
echo Checking for completion every 5s (max 70s)...

set WAIT_COUNT=0
:capture_wait
ping -n 6 127.0.0.1 >nul
set /a WAIT_COUNT+=1
if !WAIT_COUNT! gtr 14 (
    echo Max wait reached. Proceeding...
    goto :end_capture
)
findstr "60s capture window ended" "%FRIDALOG%" >nul
if !errorlevel! equ 0 (
    echo Capture completed. Waiting 5s buffer...
    ping -n 6 127.0.0.1 >nul
    goto :end_capture
)
goto :capture_wait

:end_capture
echo Stopping capture...
taskkill /f /im frida.exe >nul 2>nul
ping -n 3 127.0.0.1 >nul

echo Pulling gzip files from app data...
%ADB_CMD% shell ls /data/data/com.startive.courtside.app/files/req_*.gz > "%TEMP%\gzlist.txt" 2>nul
%ADB_CMD% shell ls /data/data/com.startive.courtside.app/files/resp_*.gz >> "%TEMP%\gzlist.txt" 2>nul
set PULLED=0
for /f "usebackq delims=" %%f in ("%TEMP%\gzlist.txt") do (
    echo Pulling %%f...
    %ADB_CMD% pull "%%f" "%OUTDIR%" 2>&1
    if !errorlevel! equ 0 (
        set /a PULLED+=1
        %ADB_CMD% shell rm "%%f" >nul 2>nul
    ) else (
        echo FAILED to pull %%f
    )
)
if !PULLED! gtr 0 echo Saved !PULLED! gzip files to workspace
del "%TEMP%\gzlist.txt" 2>nul

echo ===== CAPTURE DONE =====

echo.
echo ===== FRIDA OUTPUT =====
if exist "%FRIDALOG%" (
    type "%FRIDALOG%"
    echo. >> "%MAINLOG%"
    echo ===== FRIDA OUTPUT ===== >> "%MAINLOG%"
    type "%FRIDALOG%" >> "%MAINLOG%"
    del "%FRIDALOG%"
) else (
    echo (no output)
)
echo.
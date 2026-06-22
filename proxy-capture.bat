@echo off
setlocal enabledelayedexpansion

set ADB=C:\Users\hp\AppData\Local\Android\Sdk\platform-tools\adb.exe
set ADB_TARGET=emulator-5554
set ADB_CMD=%ADB% -s %ADB_TARGET%
set FRIDA=C:\Users\hp\AppData\Local\Programs\Python\Python311\Scripts\frida.exe
set UNPIN_SCRIPT=C:\Workspace\courtside\ssl-unpin.js
set HOOK_SCRIPT=C:\Workspace\courtside\ssl-hook-debug.js
set MITM_CERT=C:\Users\hp\.mitmproxy\mitmproxy-ca-cert.pem
set OUTDIR=C:\Workspace\courtside\output
set PKG=com.startive.courtside.app

echo ===== PROXY-BASED FLUTTER CAPTURE =====

REM === Check emulator ===
%ADB% devices | findstr "%ADB_TARGET%.*device$" >nul
if !errorlevel! neq 0 (
    echo Emulator not running.
    exit /b 1
)

%ADB_CMD% root >nul 2>nul
ping -n 3 127.0.0.1 >nul

REM === Install mitmproxy CA cert as user cert ===
echo.
echo = STEP 1: Install mitmproxy CA cert on emulator =
copy "%MITM_CERT%" "%TEMP%\mitm-ca.pem" /Y >nul
REM Push to device
%ADB_CMD% push "%TEMP%\mitm-ca.pem" /sdcard/Download/mitmproxy-ca-cert.pem >nul 2>&1
REM Open cert installer via intent (user must tap "OK")
%ADB_CMD% shell am start -a android.intent.action.VIEW -d "content://com.android.externalstorage.documents/document/primary%3ADownload%2Fmitmproxy-ca-cert.pem" -t "application/x-x509-ca-cert" 2>nul
%ADB_CMD% shell am start -a android.intent.action.VIEW -d "file:///sdcard/Download/mitmproxy-ca-cert.pem" -t "application/x-x509-ca-cert" 2>nul
echo.
echo ^> A certificate install dialog should open on the emulator.
echo ^> Tap "Install" then "OK" to trust mitmproxy CA.
echo ^> If nothing opens, go to: Settings ^> Security ^> Install certificate
echo ^> and select /sdcard/Download/mitmproxy-ca-cert.pem
echo.
echo Press Enter AFTER installing the certificate...
pause >nul

REM === Start mitmproxy in transparent mode ===
echo.
echo = STEP 2: Start mitmproxy =
taskkill /f /im mitmweb.exe >nul 2>nul
taskkill /f /im mitmproxy.exe >nul 2>nul

echo Starting mitmweb (UI at http://127.0.0.1:8081)...
start "mitmproxy" cmd /c "mitmweb --listen-host 127.0.0.1 --listen-port 8080 --mode transparent --web-host 127.0.0.1 --web-port 8081"
ping -n 5 127.0.0.1 >nul

REM === ADB reverse port ===
echo.
echo = STEP 3: ADB reverse =
%ADB_CMD% reverse tcp:8080 tcp:8080
echo ADB reverse: emulator:8080 ^<-> host:8080

REM === iptables redirect ===
echo.
echo = STEP 4: iptables redirect =
%ADB_CMD% shell iptables -t nat -F OUTPUT >nul 2>nul
%ADB_CMD% shell iptables -t nat -A OUTPUT -p tcp --dport 80 -j REDIRECT --to-port 8080
%ADB_CMD% shell iptables -t nat -A OUTPUT -p tcp --dport 443 -j REDIRECT --to-port 8080
echo ^> All HTTP/HTTPS traffic redirected through mitmproxy.

REM === Launch app with Frida ===
echo.
echo = STEP 5: Launch app with Frida =
%ADB_CMD% shell am force-stop %PKG% >nul 2>nul
ping -n 3 127.0.0.1 >nul
%ADB_CMD% shell am start -n %PKG%/com.startive.courtside.MainActivity >nul 2>nul
ping -n 6 127.0.0.1 >nul

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
echo PID not found.
exit /b 1

:found
echo PID: !PID!

REM Attach Frida with BOTH scripts
del "%OUTDIR%\frida_proxy.log" 2>nul
echo Attaching Frida with SSL unpinning + hooks...
start /b "" "%FRIDA%" -D %ADB_TARGET% !PID! -l "%UNPIN_SCRIPT%" -l "%HOOK_SCRIPT%" > "%OUTDIR%\frida_proxy.log" 2>&1

echo.
echo ===== CAPTURING 60s =====
echo Open http://127.0.0.1:8081 in your browser to see traffic.
echo Interact with the app (tap courts, schedules, etc.)
ping -n 63 127.0.0.1 >nul

REM === Cleanup ===
echo Stopping...
taskkill /f /im frida.exe >nul 2>nul
taskkill /f /im mitmweb.exe >nul 2>nul
taskkill /f /im mitmproxy.exe >nul 2>nul
%ADB_CMD% shell iptables -t nat -F OUTPUT >nul 2>nul
%ADB_CMD% reverse --remove tcp:8080 >nul 2>nul

echo.
echo ===== CAPTURE DONE =====
echo Check mitmweb UI (http://127.0.0.1:8081) for captured traffic.
echo Frida log: %OUTDIR%\frida_proxy.log
echo.
pause
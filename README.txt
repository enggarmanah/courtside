=========================================
Courtside App - API Discovery Summary
=========================================

Project: C:\Workspace\courtside
Tools: Frida 17.15.0, Android Emulator (Google APIs image, root)
App: com.startive.courtside.app (Flutter + Firebase)
Date: 2026-06-21

=== ENVIRONMENT SETUP ===

Emulator: Google APIs AVD (supports adb root)
SELinux: Must be set to permissive (setenforce 0)
adb: Always running as root
frida-server: /data/local/tmp/frida-server-17.15.0-android-x86_64

NOTE: Proxy settings (Charles/mitmproxy) don't work with Flutter apps
because Flutter/Dart HTTP clients bypass the system proxy.
mitmproxy transparent mode requires WinDivert on Windows (not installed).

=== CAPTURE METHOD ===

Frida hooks (ssl-hook-debug.js):
  - libssl.so: SSL_write / SSL_read (decrypted Firebase traffic)
  - libcrypto.so: BIO_write / BIO_read (additional SSL hooks)
  - libc.so: connect/getaddrinfo/send/recv/write/read/sendmsg/recvmsg/sendto/recvfrom
  - All socket I/O: TLS detection (marks records starting with 0x16/0x17)
  - libflutter.so: Symbol scan for internal BoringSSL (stripped - no symbols found)
  - Module enumeration: 349+ modules scanned at startup

Key Frida API notes (v17.x):
  - Process.getModuleByName('libssl.so').findExportByName('SSL_write') works
  - Module.findExportByName is NOT available (API changed)
  - readByteArray -> use new Uint8Array(buf) to convert ArrayBuffer to bytes
  - Memory.readByteArray is NOT available
  - enumerateModules() returns array (object {onMatch, onComplete} NOT supported)

=== DISCOVERED API INFO ===

API Server: api.courtside.id -> 8.215.1.241:443 (resolves from DNS)
Website: https://courtside.id (DNS: 8.215.1.241)
Panel API: https://panel.courtside.id (from Nuxt config in website HTML)
API Server IP (old): 223.34.239.216 (Alibaba Cloud Singapore)

Firebase Project: courtside-9b438
  - API Key: AIzaSyAsKzBjP7NKtuxZ_9VbpVDN9W-v8KW1Zkg
  - App ID: 1:656492019116:android:71e4c9ca68411877780e09
  - Sender ID: 656492019116
  - Android Cert SHA1: 1E9B160B6C712105944A516E305FB7611E209B27
  - FCM Registration Token: (available from app data)

Remote Config Values:
  - base_url_site: https://courtside.id
  - store_version: 1.1.31
  - contact: 82123168944

=== CAPTURE RESULTS ===

Decrypted (via libssl.so SSL_write/SSL_read):
  1. POST /v1/projects/656492019116/namespaces/firebase:fetch
     -> firebaseremoteconfig.googleapis.com (Firebase Remote Config)
  2. POST /v1/firelog/legacy/batchlog
     -> firebaselogging-pa.googleapis.com (Firebase Analytics, batchlog)
  3. Firebase Auth token exchanges (FIS auth)

Metadata only (encrypted, via libc hooks):
  1. DNS: api.courtside.id (multiple queries throughout session)
  2. Connect: 8.215.1.241:443 (Flutter API server)
  3. TLS record sizes: 253 (ClientHello), 1299-1424 (application data)
  4. Flutter repeatedly opens/closes connections (aggressive keep-alive)

NOT captured (Flutter's BoringSSL inside stripped libflutter.so):
  - All actual courts/booking/user API payloads
  - Request/response bodies for api.courtside.id

Root cause: Flutter compiles BoringSSL statically into libflutter.so.
The binary is stripped (no export symbols). Memory scanning and
symbol enumeration failed. The engine version is not in reFlutter's
database, preventing APK patching.

=== FILES IN WORKSPACE ===

frida.bat              - Automated capture script (emulator check, auto-boot,
                         retry logic, health checks, 60s smart wait, result display)
ssl-hook-debug.js      - Main Frida script (SSL hooks + libc network hooks +
                         timestamps, module scan, gzip file saving)
send-hook.js           - Alternative: hooks libc send() (encrypted data only)
ssl-unpin.js           - SSL pinning bypass script (Java-level only)
native-hook.js         - Hooks libc connect() (for finding server IPs)
proxy-capture.bat      - mitmproxy transparent proxy setup (non-functional on Windows)
genhash.py             - Cert hash generation helper
base.apk               - App's base APK (pulled for analysis)
split_x86_64.apk       - x86_64 native lib split APK (contains libapp.so + libflutter.so)
output/                - All capture output files
  api_capture.log      - Full timestamped capture log (appended each run)
  frida_output.log     - Raw Frida output
  req_*.gz             - Saved gzip request bodies (Firebase traffic)
  resp_*.gz            - Saved gzip response bodies (Firebase traffic)

=== CONFIGURATION NOTES ===

frida.bat uses:
  - Device: emulator-5554 (change ADB_TARGET var if using different device)
  - AVD: Pixel_9x (change AVD_NAME var to use a different emulator image)
  - Activity: com.startive.courtside.MainActivity
  - Max retries: 3 (emulator boot failures)
  - Capture window: 60 seconds (smart wait detects completion)
  - Frida path: C:\Users\hp\AppData\Local\Programs\Python\Python311\Scripts\frida.exe
  - Output: C:\Workspace\courtside\output\

frida.bat features:
  - Auto-detects emulator status; boots if not running
  - Waits for boot_completed + responsiveness check
  - Periodic emulator health checks during capture
  - Kill-and-retry if emulator becomes unresponsive
  - Timestamps on all log output

ssl-hook-debug.js hooks:
  - libssl.so: SSL_write, SSL_read
  - libcrypto.so: BIO_write, BIO_read
  - libc.so: connect, getaddrinfo, send, recv, read, write,
             sendmsg, recvmsg, sendto, recvfrom
  - libflutter.so: symbol scan for SSL_write/SSL_read (stripped)
  - Module enumeration at startup

=== ATTEMPTED BUT FAILED APPROACHES ===

1. mitmproxy transparent mode + iptables REDIRECT
   -> Network blocked (Firebase also failed)
   -> Requires WinDivert/npcap on Windows
   -> mitmweb crashes without it

2. mitmproxy regular proxy mode
   -> Flutter bypasses system proxy settings

3. Native Flutter BoringSSL hooking
   -> libflutter.so is stripped (no symbol exports)
   -> Memory.scanSync causes access violations
   -> enumerateSymbols returns nothing

4. reFlutter APK patching
   -> Engine MD5 (2add49aff29bf6e04503d05db5c7451d) not in database
   -> APK patching requires apktool (too large to download)

5. reFlutter Frida script
   -> Requires specific engine offset from dump.dart
   -> Offset unknown for unrecognized engine

=== NEXT STEPS ===

Run: frida.bat
This automates everything:
  1. Check/start emulator, root, set SELinux permissive
  2. Start frida-server, launch the app
  3. Auto-detect PID, attach Frida with all hooks
  4. Capture 60 seconds (smart wait, health checks)
  5. Pull gzip files from device to output/
  6. Display full timestamped capture log

NOTE: The app loads cached data on cold launch. API calls to
api.courtside.id are triggered by user interaction (login, tapping
courts/schedules). Interact with the app during the 60s window
to trigger Flutter API calls (visible as encrypted TLS metadata)
and Firebase calls (fully decrypted with saved gzip bodies).

To capture decrypted Flutter API payloads, additional tooling is needed:
  - reFlutter with updated engine database
  - Custom patched Flutter engine
  - HTTP Toolkit Android companion app (VPN mode)
  - Rooted device with Xposed + JustTrustMe

=== PROGRESS UPDATE (2026-06-22) ===

1. BoringSSL Backtrace Discovery (test-backtrace.js / find-ssl-backtrace.js)
   - Successfully identified BoringSSL BIO connect caller in libflutter.so
   - libflutter.so+0x95fb0a = socket BIO function that calls libc::connect()
   - Backtrace approach works: libc connect() backtrace -> libflutter.so frames

2. CRITICAL: onEnter Memory Reads Break Connections
   - Interceptor.attach(connect, {onEnter: ...}) with ANY memory read (readU16,
     readByteArray, even args[0].toInt32()) SILENTLY kills TCP connections
   - zero-touch.js proved this: NO onEnter, only onLeave, captured 28+ connect events
   - All hooks MUST read args from this.context.rdi/rsi/rdx in onLeave only

3. CRITICAL: Hook Complexity Kills App Process
   - Multiple Interceptor.attach calls or complex callbacks silently kill the
     app process shortly after injection. Even hooking open() (which should fire
     constantly for file I/O) produces zero callbacks with complex scripts.
   - zero-touch.js (1 hook, no onEnter, just counting) is the ONLY script that
     survived and captured connections.

4. Scripts Created:
   capture-clean.js       - No onEnter, context reads in onLeave, backtrace,
                            auto-hooks BoringSSL candidates, plaintext detection
   capture-working.js     - v5: Same approach (syntax fixed)
   find-ssl-backtrace.js  - Pure backtrace approach
   auto-discover.js       - Auto-hooks discovered candidates
   plt-trace.js           - PLT hooking + BoringSSL string scanning
   stalker-find-ssl.js    - Frida Stalker execution tracing
   proxy_server.py        - Local TCP proxy for offline testing
   diag-hooks.js          - Hook diagnostic: tests open() + connect()
   zero-touch.js          - Proved onLeave-only hooks work (28 connects)

5. Script Index
   zero-touch.js         - Minimal hook, survived app process (28 connects)
   capture-clean.js      - Complex hook, kills app (no events)
   capture-working.js    - Previous version, kills app
   find-ssl-backtrace.js  - Backtrace approach, kills app
   auto-discover.js      - Auto-hooking, untested
   plt-trace.js          - PLT level, untested
   stalker-find-ssl.js   - Stalker trace, untested
   diag-hooks.js         - Diagnostic, kills app
   mini-connect.js       - Minimal test, kills app
   analyze_ssl.py        - Static analysis of libflutter.so

=== NEXT ACTIONS (2026-06-22, 12:07 WIB) ===

**New Understanding**: The app process survives only with the absolute minimum
hook footprint. zero-touch.js (1 hook, zero onEnter, zero memory reads, just
onLeave counting) captured 28 connects. Every script with multiple hooks or
complex callbacks kills the app silently.

**Theory**: Each Interceptor.attach + complex callback increases the chance of
Frida's injected code causing a crash. The app may have anti-tamper or the
injected .so conflicts with memory layout.

**Next Action: Minimal Incremental Hook**

1. User restarts emulator (cold boot - clean process state)
2. Launch app fresh
3. Attach zero-touch.js (proven to work - 1 hook, connect only, just count)
4. Verify it captures connects (as it did before)
5. If yes, add write hook (onLeave only, minimal)
6. If app survives, add backtrace capture
7. Gradually build up to full capture without killing the process

**Key Constraint**: Keep with the ABSOLUTE MINIMUM hooks. No setTimeout,
no setInterval, no try/catch in hot callbacks. No file I/O in callbacks.
Only log() and minimal reads in onLeave.

**Fallback**: If even zero-touch.js fails now, the emulator process state has
degraded beyond recovery. User restarts emulator and runs zero-touch.js FIRST
before any complex scripts.

=== KNOWN ISSUES ===

  - "Input redirection is not supported" messages are cosmetic (adb shell quirk)
  - Gzip decompression of HTTP bodies fails (Java GZIPInputStream errors in Frida)
  - setenforce "Permission denied" is common on non-root shells (adb root fixes it)
  - Frida spawn mode (-f) can NPE; attach mode (-D) is more reliable
  - Flutter API traffic encrypted by BoringSSL inside stripped libflutter.so
  - mitmproxy transparent mode requires WinDivert on Windows
  - reFlutter engine database outdated for this app version
  - libc read() hook causes excessive output (fd=14x reads 524288B of cache file)
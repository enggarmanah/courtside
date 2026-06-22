function ts() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
}

function log(msg) {
    console.log('[' + ts() + '] ' + msg);
}

function hex(addr, len) {
    return ptr(addr).toString(16).toUpperCase().padStart(len || 8, '0');
}

function hookFlutterInternalCalls() {
    var flutter = Process.findModuleByName('libflutter.so');
    if (!flutter) { log('[!] libflutter.so not found'); return false; }
    log('[+] libflutter.so base=' + flutter.base + ' size=0x' + flutter.size.toString(16));

    var trackedFds = {};
    var apiTargets = {};

    var sendsByFlutter = 0;
    var writesByFlutter = 0;

    // Find PLT section by scanning for known import patterns
    // In x86_64 ELF, PLT entries are:
    //   jmp *GOT[n]  (ff 25 XX XX XX XX)
    //   push $index   (68 XX XX XX XX)  
    //   jmp PLT0      (e9 XX XX XX XX)
    var pltStart = null;
    var pltEnd = null;

    try {
        var ranges = Process.enumerateRanges({protection: 'r-x', coalesce: true});
        for (var i = 0; i < ranges.length; i++) {
            var r = ranges[i];
            if (r.base.compare(flutter.base) >= 0 && r.base.add(r.size).compare(flutter.base.add(flutter.size)) <= 0) {
                if (r.size < 0x2000 || r.size > 0x5000) continue;
                // Scan for PLT signature: jmp *(%rip + offset) = ff 25
                try {
                    var hits = Memory.scanSync(r.base, r.size, 'ff 25');
                    if (hits.length > 10 && hits.length < 200) {
                        pltStart = hits[0].address;
                        pltEnd = hits[hits.length - 1].address;
                        log('[PLT] Found PLT at 0x' + pltStart.toString(16) + ' - 0x' + pltEnd.toString(16) + ' (' + hits.length + ' entries)');
                        break;
                    }
                } catch(e) {}
            }
        }
    } catch(e) { log('[PLT] Range scan failed: ' + e.message); }

    // Alternative: find GOT entries by looking at what BoringSSL imports
    // BoringSSL calls connect, write, read, send, recv from libc
    // In the GOT, these are filled by the dynamic linker with the actual libc addresses
    // We can find them by scanning for the PLT stubs that correspond to these functions

    function hookPLTStub(pltAddr, funcName) {
        try {
            Interceptor.attach(pltAddr, {
                onEnter: function(args) {
                    var fd = args[0].toInt32();
                    var caller = this.returnAddress;
                    
                    // Check if caller is inside libflutter.so
                    if (caller.compare(flutter.base) >= 0 && caller.compare(flutter.base.add(flutter.size)) < 0) {
                        if (funcName === 'connect') {
                            var sockaddr = args[1];
                            if (sockaddr) {
                                try {
                                    var family = sockaddr.readU16();
                                    if (family === 2) {
                                        var portRaw = sockaddr.add(2).readU16();
                                        var port = ((portRaw & 0xFF) << 8) | ((portRaw >> 8) & 0xFF);
                                        var ipData = sockaddr.add(4).readByteArray(4);
                                        if (ipData) {
                                            var ipBytes = new Uint8Array(ipData);
                                            var ip = ipBytes.join('.');
                                            var callerOff = caller.sub(flutter.base);
                                            log('[FLUTTER] connect fd=' + fd + ' to ' + ip + ':' + port + ' caller=0x' + callerOff.toString(16));
                                            trackedFds[fd] = {ip: ip, port: port, caller: caller};
                                            apiTargets[fd] = true;
                                        }
                                    }
                                } catch(e) {}
                            }
                        } else if (funcName === 'write') {
                            var len = args[2].toInt32();
                            var callerOff = caller.sub(flutter.base);
                            if (apiTargets[fd]) {
                                writesByFlutter++;
                                try {
                                    var buf = args[1].readByteArray(Math.min(len, 2000));
                                    if (buf) {
                                        var bytes = new Uint8Array(buf);
                                        // Check if it looks like HTTP
                                        var s = '';
                                        for (var b = 0; b < Math.min(bytes.length, 200); b++) {
                                            var byte = bytes[b];
                                            if (byte >= 32 && byte <= 126) s += String.fromCharCode(byte);
                                            else if (byte === 10) s += '\n';
                                            else if (byte === 13) s += '\r';
                                            else s += '.';
                                        }
                                        if (s.indexOf('GET') >= 0 || s.indexOf('POST') >= 0 || s.indexOf('HTTP') >= 0 || s.indexOf('{') === 0) {
                                            log('[CAPTURE] Flutter write fd=' + fd + ' len=' + len + ' caller=0x' + callerOff.toString(16));
                                            log('[CAPTURE] ' + s.substring(0, 500));
                                        } else {
                                            log('[FLUTTER] write fd=' + fd + ' len=' + len + ' caller=0x' + callerOff.toString(16) + ' (encrypted)');
                                        }
                                    }
                                } catch(e) {}
                            } else {
                                sendsByFlutter++;
                                if (sendsByFlutter <= 5) {
                                    log('[FLUTTER] write fd=' + fd + ' len=' + len + ' caller=0x' + callerOff.toString(16));
                                }
                            }
                        } else if (funcName === 'read') {
                            this.fd = fd;
                            this.caller = caller;
                        }
                    }
                },
                onLeave: function(retval) {
                    if (funcName === 'read' && this.fd && apiTargets[this.fd]) {
                        var bytesRead = retval.toInt32();
                        if (bytesRead > 10) {
                            var caller = this.returnAddress;
                            var callerOff = caller.sub(flutter.base);
                            try {
                                var buf = this.context.rdi ? this.context.rdi : null;
                                log('[FLUTTER] read fd=' + this.fd + ' returned ' + bytesRead + ' caller=0x' + callerOff.toString(16));
                            } catch(e) {}
                        }
                    }
                    if (funcName === 'connect') {
                        var result = retval.toInt32();
                    }
                }
            });
            return true;
        } catch(e) {
            log('[PLT] Failed to hook ' + funcName + ' at 0x' + pltAddr.toString(16) + ': ' + e.message);
            return false;
        }
    }

    // Strategy: hook the PLT entries in libflutter.so for connect, write, read
    // We need to find them. One approach: find the function that calls connect()
    // and trace backwards.
    // 
    // Alternative: hook Thread.backtrace() from inside the libc hooks we already have,
    // and walk the stack to find frames inside libflutter.so

    // Actually, the most reliable approach: hook connect/write/read in libc like before,
    // but additionally capture a backtrace and check if any frame is inside libflutter.so
    var libc = Process.getModuleByName('libc.so');
    if (!libc) { log('[!] libc.so not found'); return false; }

    var connectAddr = libc.findExportByName('connect');
    var writeAddr = libc.findExportByName('write');
    var readAddr = libc.findExportByName('read');

    if (connectAddr) {
        Interceptor.attach(connectAddr, {
            onEnter: function(args) {
                var sockaddr = args[1];
                if (!sockaddr) return;
                try {
                    var family = sockaddr.readU16();
                    if (family === 2) {
                        var portRaw = sockaddr.add(2).readU16();
                        var port = ((portRaw & 0xFF) << 8) | ((portRaw >> 8) & 0xFF);
                        var ipData = sockaddr.add(4).readByteArray(4);
                        if (ipData) {
                            var ipBytes = new Uint8Array(ipData);
                            var ip = ipBytes.join('.');
                            if (port === 443 && ip !== '127.0.0.1') {
                                this.tracked = true;
                                this.fd = -1;
                                this.ip = ip;
                                this.port = port;
                                log('[CONNECT] ' + ip + ':' + port);
                            }
                        }
                    }
                } catch(e) {}
            },
            onLeave: function(retval) {
                if (this.tracked) {
                    this.fd = retval.toInt32();
                    if (this.fd > 0) {
                        apiTargets[this.fd] = {ip: this.ip, port: this.port};
                        log('[CONNECT] fd=' + this.fd + ' -> ' + this.ip + ':' + this.port);
                        
                        // Capture backtrace to find Flutter caller
                        var bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
                        for (var i = 0; i < bt.length; i++) {
                            var addr = bt[i];
                            if (addr.compare(flutter.base) >= 0 && addr.compare(flutter.base.add(flutter.size)) < 0) {
                                var off = addr.sub(flutter.base);
                                log('[BT]   libflutter.so+0x' + off.toString(16) + ' (frame ' + i + ')');
                            }
                        }
                    }
                }
            }
        });
        log('[+] libc connect hooked (with backtrace)');
    }

    if (writeAddr) {
        Interceptor.attach(writeAddr, {
            onEnter: function(args) {
                var fd = args[0].toInt32();
                if (!apiTargets[fd]) return;
                var len = args[2].toInt32();
                this.fd = fd;
                this.len = len;
                
                // Capture backtrace to find where in libflutter.so this came from
                var bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
                var flutterFrames = [];
                for (var i = 0; i < bt.length; i++) {
                    var addr = bt[i];
                    if (addr.compare(flutter.base) >= 0 && addr.compare(flutter.base.add(flutter.size)) < 0) {
                        var off = addr.sub(flutter.base);
                        flutterFrames.push(off);
                    }
                }
                if (flutterFrames.length > 0) {
                    this.flutterFrames = flutterFrames;
                    log('[WRITE] fd=' + fd + ' len=' + len + ' Flutter frames: ' + flutterFrames.map(function(f) { return '0x' + f.toString(16); }).join(', '));
                }
            },
            onLeave: function(retval) {
                if (!apiTargets[this.fd]) return;
                // log('[WRITE] fd=' + this.fd + ' wrote ' + retval.toInt32() + '/' + this.len);
            }
        });
        log('[+] libc write hooked (with backtrace)');
    }

    if (readAddr) {
        Interceptor.attach(readAddr, {
            onEnter: function(args) {
                var fd = args[0].toInt32();
                if (!apiTargets[fd]) return;
                this.fd = fd;
            },
            onLeave: function(retval) {
                if (!apiTargets[this.fd]) return;
                var n = retval.toInt32();
                if (n > 50) {
                    log('[READ] fd=' + this.fd + ' ' + n + ' bytes');
                }
            }
        });
        log('[+] libc read hooked');
    }

    return true;
}

// Phase 2: attempt to find BoringSSL within libflutter.so by scanning for
// known BoringSSL cipher/cert strings and cross-referencing
function scanForBoringSSL() {
    var flutter = Process.findModuleByName('libflutter.so');
    if (!flutter) return;

    var boring = ['TLS_AES_128_GCM_SHA256', 'TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256',
                  'ECDHE', 'ECDSA', 'RSA', 'AES_128_GCM', 'AES_256_GCM', 'CHACHA20_POLY1305'];
    
    log('[SCAN] Searching libflutter.so for BoringSSL strings...');
    var ranges = Process.enumerateRanges({protection: 'r--', coalesce: true});
    var found = [];
    
    for (var ri = 0; ri < ranges.length; ri++) {
        var r = ranges[ri];
        if (r.base.compare(flutter.base) < 0) continue;
        if (r.base.add(r.size).compare(flutter.base.add(flutter.size)) > 0) break;
        if (r.size > 0x1000000) continue; // skip huge ranges
        
        for (var si = 0; si < boring.length; si++) {
            try {
                var hits = Memory.scanSync(r.base, r.size, boring[si].split('').map(function(c) { return ('0' + c.charCodeAt(0).toString(16)).slice(-2); }).join(' '));
                for (var hi = 0; hi < hits.length; hi++) {
                    found.push({addr: hits[hi].address, str: boring[si], rangeBase: r.base, rangeSize: r.size});
                    log('[SCAN] "' + boring[si] + '" at 0x' + hits[hi].address.toString(16) + ' (offset 0x' + hits[hi].address.sub(flutter.base).toString(16) + ')');
                }
            } catch(e) {}
        }
    }
    log('[SCAN] Found ' + found.length + ' BoringSSL string references');
}

Java.perform(function() {
    log('[+] Starting PLT trace + backtrace analysis');
    hookFlutterInternalCalls();
    scanForBoringSSL();
    log('[+] All hooks active. Interact with the app to trigger API calls.');
});

setTimeout(function() {
    log('[+] 120s capture window ended.');
}, 120000);
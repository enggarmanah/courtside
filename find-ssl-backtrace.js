function ts() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
}

function log(msg) { console.log('[' + ts() + '] ' + msg); }

function toAscii(bytes, maxLen) {
    var s = '';
    var limit = Math.min(bytes.length, maxLen || 256);
    for (var i = 0; i < limit; i++) {
        if (bytes[i] >= 32 && bytes[i] <= 126) s += String.fromCharCode(bytes[i]);
        else if (bytes[i] === 10) s += '\n';
        else if (bytes[i] === 13) {}
        else s += '.';
    }
    return s;
}

var flutter = null;
var boringSSLWrite = null;
var boringSSLRead = null;
var trackedFds = {};
var collectedWrites = [];
var collectedCallers = {};
var hooksInstalled = false;

function findSSLWriteFromBacktrace() {
    if (hooksInstalled) return;
    flutter = Process.findModuleByName('libflutter.so');
    if (!flutter) { log('[!] libflutter.so not found'); return; }
    log('[+] libflutter.so base=' + flutter.base + ' size=0x' + flutter.size.toString(16));
    hooksInstalled = true;

    var libc = Process.getModuleByName('libc.so');
    var connectAddr = libc.findExportByName('connect');
    var writeAddr = libc.findExportByName('write');
    var readAddr = libc.findExportByName('read');
    var sendtoAddr = libc.findExportByName('sendto');

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
                        if (port === 443) {
                            var ipData = sockaddr.add(4).readByteArray(4);
                            if (ipData) {
                                var ipBytes = new Uint8Array(ipData);
                                var ip = ipBytes.join('.');
                                this.tracked = true;
                                this.ip = ip;
                                this.port = port;
                            }
                        }
                    }
                } catch(e) {}
            },
            onLeave: function(retval) {
                if (this.tracked) {
                    var fd = retval.toInt32();
                    if (fd > 0) {
                        trackedFds[fd] = {ip: this.ip, port: this.port};
                        log('[CONNECT] fd=' + fd + ' -> ' + this.ip + ':' + this.port);
                    }
                }
            }
        });
        log('[+] connect hooked');
    }

    if (writeAddr) {
        Interceptor.attach(writeAddr, {
            onEnter: function(args) {
                var fd = args[0].toInt32();
                if (!trackedFds[fd]) return;
                var len = args[2].toInt32();
                if (len < 50) return;
                
                var bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
                var flutterFrames = [];
                for (var i = 0; i < bt.length; i++) {
                    var addr = bt[i];
                    if (addr.compare(flutter.base) >= 0 && addr.compare(flutter.base.add(flutter.size)) < 0) {
                        var off = addr.sub(flutter.base).toInt32();
                        if (flutterFrames.length < 5) {
                            flutterFrames.push(off);
                        }
                    }
                }
                
                if (flutterFrames.length >= 2) {
                    var sslWriteCandidate = flutterFrames[0]; // deepest frame - likely BoringSSL
                    var caller = flutterFrames[1];             // one level up
                    
                    if (!collectedCallers['0x' + sslWriteCandidate.toString(16)]) {
                        collectedCallers['0x' + sslWriteCandidate.toString(16)] = 0;
                    }
                    collectedCallers['0x' + sslWriteCandidate.toString(16)]++;
                    
                    if (collectedCallers['0x' + sslWriteCandidate.toString(16)] === 1) {
                        log('[BACKTRACE] write fd=' + fd + ' len=' + len);
                        log('[CANDIDATE] BoringSSL write @ libflutter.so+0x' + sslWriteCandidate.toString(16));
                        log('[CALLER]    Called from libflutter.so+0x' + caller.toString(16));
                        log('[BT] ' + flutterFrames.map(function(f) { return '0x' + f.toString(16); }).join(' <- '));
                    }
                }
            }
        });
        log('[+] write hooked for backtrace analysis');
    }

    if (readAddr) {
        Interceptor.attach(readAddr, {
            onEnter: function(args) {
                var fd = args[0].toInt32();
                if (!trackedFds[fd]) return;
                this.fd = fd;
                this.buf = args[1];
            },
            onLeave: function(retval) {
                if (!trackedFds[this.fd]) return;
                var n = retval.toInt32();
                if (n < 50) return;
                
                var bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
                var flutterFrames = [];
                for (var i = 0; i < bt.length; i++) {
                    var addr = bt[i];
                    if (addr.compare(flutter.base) >= 0 && addr.compare(flutter.base.add(flutter.size)) < 0) {
                        var off = addr.sub(flutter.base).toInt32();
                        flutterFrames.push(off);
                    }
                }
                
                if (flutterFrames.length >= 2) {
                    var sslReadCandidate = flutterFrames[0];
                    log('[SSL_READ candidate] libflutter.so+0x' + sslReadCandidate.toString(16) + ' fd=' + this.fd + ' bytes=' + n);
                    log('[BT] ' + flutterFrames.map(function(f) { return '0x' + f.toString(16); }).join(' <- '));
                }
            }
        });
        log('[+] read hooked for backtrace analysis');
    }

    if (sendtoAddr) {
        Interceptor.attach(sendtoAddr, {
            onEnter: function(args) {
                var fd = args[0].toInt32();
                if (!trackedFds[fd]) return;
                var len = args[2].toInt32();
                if (len < 50) return;
                
                var bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
                var flutterFrames = [];
                for (var i = 0; i < bt.length; i++) {
                    var addr = bt[i];
                    if (addr.compare(flutter.base) >= 0 && addr.compare(flutter.base.add(flutter.size)) < 0) {
                        flutterFrames.push(addr.sub(flutter.base).toInt32());
                    }
                }
                if (flutterFrames.length > 0) {
                    log('[SENDTO] fd=' + fd + ' len=' + len + ' Flutter: ' + flutterFrames.map(function(f) { return '0x' + f.toString(16); }).join(' <- '));
                }
            }
        });
        log('[+] sendto hooked');
    }

    // Periodically print summary
    setInterval(function() {
        var total = 0;
        for (var k in collectedCallers) {
            if (collectedCallers.hasOwnProperty(k)) total += collectedCallers[k];
        }
        if (total > 0) {
            log('[STATS] ' + Object.keys(collectedCallers).length + ' unique BoringSSL write candidates, ' + total + ' total calls');
        }
    }, 15000);
}

function dumpResults() {
    log('[RESULTS] === Unique BoringSSL candidates ===');
    var sorted = [];
    for (var k in collectedCallers) {
        if (collectedCallers.hasOwnProperty(k)) {
            sorted.push({addr: k, count: collectedCallers[k]});
        }
    }
    sorted.sort(function(a, b) { return b.count - a.count; });
    for (var i = 0; i < sorted.length; i++) {
        log('[RESULTS] ' + sorted[i].addr + ' (called ' + sorted[i].count + ' times)');
    }
    
    if (sorted.length > 0) {
        log('[RESULTS] Most likely SSL_write: ' + sorted[0].addr);
        log('[RESULTS] Offset from libflutter.so base: ' + sorted[0].addr);
    }
}

log('[+] Starting backtrace-based BoringSSL discovery');
log('[+] Waiting for libflutter.so to load...');

// In spawn mode, libflutter.so may not be loaded yet - retry
var retries = 0;
var interval = setInterval(function() {
    retries++;
    try {
        findSSLWriteFromBacktrace();
        if (flutter) {
            log('[+] libflutter.so loaded, hooks installed');
            clearInterval(interval);
            setTimeout(function() {
                log('[+] 120s capture window ended.');
                dumpResults();
            }, 120000);
        }
    } catch(e) {
        log('[+] Retry ' + retries + ': ' + e.message);
    }
    if (retries > 60) {
        log('[!] libflutter.so not found after 60 retries');
        clearInterval(interval);
    }
}, 1000);
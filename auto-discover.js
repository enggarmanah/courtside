function ts() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
}

function log(msg) { console.log('[' + ts() + '] ' + msg); }

var flutter = null;
var trackedFds = {};
var triedAddrs = {};
var hookedWrite = null;
var hookedRead = null;
var plaintextHits = 0;

function isGzipMagic(bytes) {
    return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function saveToFile(bytes, prefix) {
    try {
        Java.perform(function() {
            var arr = [];
            for (var i = 0; i < Math.min(bytes.length, 65536); i++) arr.push(bytes[i]);
            var javaBytes = Java.array('byte', arr);
            var FileOutputStream = Java.use('java.io.FileOutputStream');
            var path = '/data/local/tmp/' + prefix + '_' + Date.now() + '.bin';
            var fos = FileOutputStream.$new(path);
            fos.write(javaBytes);
            fos.close();
            log('[FILE] Saved ' + path + ' (' + bytes.length + ' bytes)');
        });
    } catch(e) {}
}

function tryHookCandidate(offset, backtraceFrames) {
    var key = '0x' + offset.toString(16);
    if (triedAddrs[key]) return;
    triedAddrs[key] = true;

    var addr = flutter.base.add(offset);
    
    // Check if address is valid (inside executable section)
    try {
        var test = addr.readByteArray(4);
        if (!test) return;
    } catch(e) { return; }

    log('[HOOK] Trying candidate at libflutter.so+0x' + offset.toString(16));

    Interceptor.attach(addr, {
        onEnter: function(args) {
            // SSL_write takes (SSL*, const void*, int) - args[1] is buffer, args[2] is len
            var len = 0;
            try { len = args[2].toInt32(); } catch(e) { return; }
            if (len < 10 || len > 100000) return;
            
            try {
                var buf = args[1].readByteArray(Math.min(len, 16384));
                if (!buf) return;
                var bytes = new Uint8Array(buf);
                var s = '';
                for (var i = 0; i < Math.min(bytes.length, 500); i++) {
                    if (bytes[i] >= 32 && bytes[i] <= 126) s += String.fromCharCode(bytes[i]);
                    else if (bytes[i] === 10) s += '\n';
                    else if (bytes[i] === 13) {}
                    else s += '.';
                }
                
                var isPlaintext = (s.indexOf('GET ') === 0 || s.indexOf('POST ') === 0 || s.indexOf('PUT ') === 0 || 
                                   s.indexOf('DELETE ') === 0 || s.indexOf('PATCH ') === 0 || s.indexOf('HTTP') >= 0 ||
                                   s.indexOf('{') === 0 || s.indexOf('Content-Type') >= 0 || s.indexOf('Host:') >= 0);
                
                if (isPlaintext) {
                    plaintextHits++;
                    log('[!!!] PLAINTEXT FOUND at libflutter.so+0x' + offset.toString(16) + ' len=' + len);
                    log('[DATA] ' + s.substring(0, 2000));
                    saveToFile(bytes, 'plaintext');
                    hookedWrite = offset;
                } else if (s.indexOf('0x16') >= 0 || s.indexOf('0x17') >= 0) {
                    // TLS encrypted data
                } else {
                    log('[CANDIDATE] Non-HTTP data at 0x' + offset.toString(16) + ': ' + s.substring(0, 200));
                }
            } catch(e) {}
        }
    });
}

function discoverAndHook() {
    flutter = Process.findModuleByName('libflutter.so');
    if (!flutter) { log('[!] libflutter.so not found'); return; }
    log('[+] libflutter.so base=' + flutter.base + ' size=0x' + flutter.size.toString(16));

    var libc = Process.getModuleByName('libc.so');
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
                        if (port === 443) {
                            var ipData = sockaddr.add(4).readByteArray(4);
                            if (ipData) {
                                var ipBytes = new Uint8Array(ipData);
                                this.ip = ipBytes.join('.');
                                this.port = port;
                                this.tracked = true;
                            }
                        }
                    }
                } catch(e) {}
            },
            onLeave: function(retval) {
                if (!this.tracked) return;
                var fd = retval.toInt32();
                if (fd > 0) {
                    trackedFds[fd] = {ip: this.ip, port: this.port};
                    log('[CONNECT] fd=' + fd + ' -> ' + this.ip + ':' + this.port);
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
                if (len < 30) return;
                
                var bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
                var flutterFrames = [];
                for (var i = 0; i < bt.length; i++) {
                    var addr = bt[i];
                    if (addr.compare(flutter.base) >= 0 && addr.compare(flutter.base.add(flutter.size)) < 0) {
                        flutterFrames.push(addr.sub(flutter.base).toInt32());
                    }
                }
                
                if (flutterFrames.length < 3) return;
                
                // Print backtrace for first few writes
                var key = flutterFrames.map(function(f) { return f.toString(16); }).join(',');
                if (trackedFds[fd].lastBt !== key) {
                    trackedFds[fd].lastBt = key;
                    log('[WRITE] fd=' + fd + ' len=' + len + ' bt=' + flutterFrames.map(function(f) { return '0x' + f.toString(16); }).join(' <- '));
                    
                    // Try hooking frames 2-5 up the stack (above the BIO write callback)
                    // Frame 0 = socket BIO write (encrypted)
                    // Frame 1 = BIO_write
                    // Frame 2 = ssl3_write_pending or similar
                    // Frame 3 = ssl3_write_bytes
                    // Frame 4 = SSL_write <-- THIS IS OUR TARGET
                    // Frame 5 = Dart socket layer <-- plaintext before SSL
                    
                    for (var j = 3; j < Math.min(flutterFrames.length, 7); j++) {
                        tryHookCandidate(flutterFrames[j], flutterFrames);
                    }
                }
            }
        });
        log('[+] write hooked for discovery and auto-hook');
    }

    if (readAddr) {
        Interceptor.attach(readAddr, {
            onEnter: function(args) {
                var fd = args[0].toInt32();
                if (!trackedFds[fd]) return;
                this.buf = args[1];
                this.fd = fd;
            },
            onLeave: function(retval) {
                if (!trackedFds[this.fd]) return;
                var n = retval.toInt32();
                if (n < 50) return;
                log('[READ] fd=' + this.fd + ' ' + n + ' bytes');
            }
        });
        log('[+] read hooked');
    }
}

Java.perform(function() {
    log('[+] Starting auto-discovery and hooking');
    discoverAndHook();
    log('[+] All hooks active. Interact with the app to trigger API calls.');
    log('[+] Will try hooking candidates discovered from backtraces.');
});

setTimeout(function() {
    log('[+] 120s window ended. Plaintext hits: ' + plaintextHits);
    if (hookedWrite) {
        log('[SUCCESS] SSL_write found at libflutter.so+0x' + hookedWrite.toString(16));
    }
}, 120000);
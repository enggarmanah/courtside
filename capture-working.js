function ts() { var d = new Date(); return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)+':'+('0'+d.getSeconds()).slice(-2); }
function log(m) { console.log('['+ts()+'] '+m); }

var flutter = null;
var trackedFds = {};
var collectedCallers = {};
var connectCount = 0;
var writeCount = 0;

// Wait for libflutter.so (spawn mode compat) - log immediately
log('[+] Script loaded at ' + ts() + ', waiting for libflutter.so...');
var retries = 0;
var initInterval = setInterval(function() {
    retries++;
    flutter = Process.findModuleByName('libflutter.so');
    if (flutter || retries > 30) {
        clearInterval(initInterval);
        if (flutter) {
            log('libflutter.so base=' + flutter.base + ' size=0x' + flutter.size.toString(16));
            installHooks();
        } else {
            log('libflutter.so not found, installing hooks anyway');
            installHooks();
        }
    }
}, 500);

function installHooks() {
    var libc = Process.getModuleByName('libc.so');

    // Hook connect - EXACTLY like zero-touch.js (NO onEnter, NO memory reads)
    Interceptor.attach(libc.findExportByName('connect'), {
        onLeave: function(ret) {
            connectCount++;
            var result = ret.toInt32();
            var fd = this.context.rdi.toInt32();
            if (result !== 0) return;
            // Read sockaddr from rsi (2nd arg in x86_64 calling convention)
            var sa = this.context.rsi;
            if (!sa || sa.isNull()) return;
            try {
                var family = sa.readU16();
                if (family === 2) {
                    var portRaw = sa.add(2).readU16();
                    var port = ((portRaw & 0xFF) << 8) | ((portRaw >> 8) & 0xFF);
                    var ipData = sa.add(4).readByteArray(4);
                    if (ipData) {
                        var ip = new Uint8Array(ipData).join('.');
                        if (port === 443) {
                            trackedFds[fd] = {ip: ip, port: port};
                            log('[CONNECT] fd=' + fd + ' -> ' + ip + ':' + port);
                        }
                    }
                }
            } catch(e) {}
        }
    });

    // Hook write - NO onEnter, read from context
    Interceptor.attach(libc.findExportByName('write'), {
        onLeave: function(ret) {
            var fd = this.context.rdi.toInt32();
            var buf = this.context.rsi;
            var len = this.context.rdx.toInt32();
            if (!trackedFds[fd]) return;
            if (len < 30) return;
            writeCount++;
            
            if (flutter) {
                var bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
                var frames = [];
                for (var i = 0; i < bt.length; i++) {
                    var addr = bt[i];
                    if (addr.compare(flutter.base) >= 0 && addr.compare(flutter.base.add(flutter.size)) < 0) {
                        frames.push(addr.sub(flutter.base).toInt32());
                    }
                }
                if (frames.length > 0) {
                    log('[WRITE] fd=' + fd + ' len=' + len + ' bt=' + frames.map(function(f){return '0x'+f.toString(16)}).join('<-'));
                    var key = frames[0];
                    if (!collectedCallers['0x'+key.toString(16)]) collectedCallers['0x'+key.toString(16)] = 0;
                    collectedCallers['0x'+key.toString(16)]++;
                    
                    // Also try hooking frames 3-5 (SSL_write candidates)
                    if (frames.length >= 4 && !triedAddrs['0x'+frames[3].toString(16)]) {
                        tryHookCandidate(frames[3]);
                    }
                    if (frames.length >= 5 && !triedAddrs['0x'+frames[4].toString(16)]) {
                        tryHookCandidate(frames[4]);
                    }
                }
            }
            
            // Try to read plaintext
            try {
                var data = buf.readByteArray(Math.min(len, 500));
                if (data) {
                    var bytes = new Uint8Array(data);
                    var preview = '';
                    for (var i = 0; i < Math.min(bytes.length, 100); i++) {
                        var b = bytes[i];
                        preview += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
                    }
                    if (preview.indexOf('GET ') === 0 || preview.indexOf('POST ') === 0 || preview.indexOf('{') === 0) {
                        log('[PLAINTEXT?] fd=' + this.fd + ': ' + preview.substring(0, 200));
                    }
                }
            } catch(e) {}
        }
    });

    // Hook read for API connections - NO onEnter
    Interceptor.attach(libc.findExportByName('read'), {
        onLeave: function(ret) {
            var fd = this.context.rdi.toInt32();
            if (!trackedFds[fd]) return;
            var n = ret.toInt32();
            if (n > 50) log('[READ] fd=' + fd + ' ' + n + ' bytes');
        }

(Showing lines 128-135 of 189. Use offset=136 to continue.)
    });

    log('[+] Hooks active. Interact with the app.');

    // Dump results after 120s
    setTimeout(function() {
        log('[RESULTS] Connections: ' + connectCount + ', API writes: ' + writeCount);
        var sorted = [];
        for (var k in collectedCallers) {
            if (collectedCallers.hasOwnProperty(k)) sorted.push({addr: k, count: collectedCallers[k]});
        }
        sorted.sort(function(a,b){return b.count - a.count});
        for (var i = 0; i < sorted.length; i++) {
            log('[SSL_write candidate] ' + sorted[i].addr + ' (x' + sorted[i].count + ')');
        }
        if (sorted.length > 0) log('[BEST CANDIDATE] ' + sorted[0].addr);
    }, 120000);
}

var triedAddrs = {};

function tryHookCandidate(offset) {
    var key = '0x' + offset.toString(16);
    if (triedAddrs[key]) return;
    triedAddrs[key] = true;
    if (!flutter) return;
    
    var addr = flutter.base.add(offset);
    try {
        Interceptor.attach(addr, {
            onEnter: function(args) {
                var len = 0;
                try { len = args[2].toInt32(); } catch(e) { return; }
                if (len < 10 || len > 50000) return;
                try {
                    var buf = args[1].readByteArray(Math.min(len, 2048));
                    if (!buf) return;
                    var bytes = new Uint8Array(buf);
                    var s = '';
                    for (var i = 0; i < Math.min(bytes.length, 200); i++) {
                        var b = bytes[i];
                        if (b >= 32 && b <= 126) s += String.fromCharCode(b);
                        else if (b === 10) s += '\n';
                        else break;
                    }
                    if (s.indexOf('GET ') >= 0 || s.indexOf('POST ') >= 0 || s.indexOf('HTTP') >= 0 || s.indexOf('{') >= 0) {
                        log('[!!! PLAINTEXT at 0x' + offset.toString(16) + '] ' + s.substring(0, 500));
                    }
                } catch(e) {}
            }
        });
        log('[HOOKED] Candidate at libflutter.so+0x' + offset.toString(16));
    } catch(e) {}
}
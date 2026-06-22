function ts() { var d = new Date(); return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)+':'+('0'+d.getSeconds()).slice(-2); }
function log(m) { console.log('['+ts()+'] '+m); }

log('Script started, waiting for libflutter.so...');

var flutter = null;
var trackedFds = {};
var collectedCallers = {};
var triedAddrs = {};
var connectCount = 0;
var writeCount = 0;

function waitForFlutter() {
    flutter = Process.findModuleByName('libflutter.so');
    if (flutter) {
        log('found libflutter.so base='+flutter.base+' size=0x'+flutter.size.toString(16));
        installHooks();
    } else {
        log('retrying...');
        setTimeout(waitForFlutter, 500);
    }
}
setTimeout(waitForFlutter, 10);

function installHooks() {
    var libc = Process.getModuleByName('libc.so');

    Interceptor.attach(libc.findExportByName('connect'), {
        onLeave: function(ret) {
            connectCount++;
            var fd = 0, sa = null;
            try {
                fd = this.context.rdi.toInt32();
                sa = this.context.rsi;
            } catch(e) { return; }
            if (ret.toInt32() !== 0) return;
            if (!sa || sa.isNull()) return;
            try {
                var family = sa.readU16();
                if (family !== 2) return;
                var portRaw = sa.add(2).readU16();
                var port = ((portRaw & 0xFF) << 8) | ((portRaw >> 8) & 0xFF);
                if (port !== 443) return;
                var ipData = sa.add(4).readByteArray(4);
                if (!ipData) return;
                var ip = new Uint8Array(ipData).join('.');
                trackedFds[fd] = {ip: ip, port: port};
                log('CONNECT fd='+fd+' -> '+ip+':'+port);
            } catch(e) {}
        }
    });

    Interceptor.attach(libc.findExportByName('write'), {
        onLeave: function(ret) {
            var fd = 0, buf = null, len = 0;
            try {
                fd = this.context.rdi.toInt32();
                buf = this.context.rsi;
                len = this.context.rdx.toInt32();
            } catch(e) { return; }
            if (!trackedFds[fd]) return;
            if (len < 30) return;
            writeCount++;

            if (flutter) {
                try {
                    var bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
                    var frames = [];
                    for (var i = 0; i < bt.length; i++) {
                        var addr = bt[i];
                        if (addr.compare(flutter.base) >= 0 && addr.compare(flutter.base.add(flutter.size)) < 0) {
                            frames.push(addr.sub(flutter.base).toInt32());
                        }
                    }
                    if (frames.length > 0) {
                        log('WRITE fd='+fd+' len='+len+' bt='+frames.map(function(f){return '0x'+f.toString(16)}).join('<-'));
                        var key = '0x'+frames[0].toString(16);
                        if (!collectedCallers[key]) collectedCallers[key] = 0;
                        collectedCallers[key]++;
                        if (frames.length >= 4) tryHook(frames[3]);
                        if (frames.length >= 5) tryHook(frames[4]);
                    }
                } catch(e) {}
            }

            try {
                var data = buf.readByteArray(Math.min(len, 500));
                if (!data) return;
                var bytes = new Uint8Array(data);
                var s = '';
                for (var i = 0; i < Math.min(bytes.length, 100); i++) {
                    s += (bytes[i] >= 32 && bytes[i] <= 126) ? String.fromCharCode(bytes[i]) : '.';
                }
                if (s.indexOf('GET ') === 0 || s.indexOf('POST ') === 0 || s.indexOf('{') === 0 || s.indexOf('Host:') >= 0) {
                    log('PLAINTEXT? fd='+fd+': '+s.substring(0,200));
                }
            } catch(e) {}
        }
    });

    Interceptor.attach(libc.findExportByName('read'), {
        onLeave: function(ret) {
            try {
                var fd = this.context.rdi.toInt32();
                if (!trackedFds[fd]) return;
                if (ret.toInt32() > 50) log('READ fd='+fd+' '+ret.toInt32()+' bytes');
            } catch(e) {}
        }
    });

    log('Hooks installed. Interact with app.');

    setTimeout(function() {
        log('=== RESULTS ===');
        log('Connections: '+connectCount+', API writes: '+writeCount);
        var sorted = [];
        for (var k in collectedCallers) {
            if (collectedCallers.hasOwnProperty(k)) sorted.push({addr: k, count: collectedCallers[k]});
        }
        sorted.sort(function(a,b){return b.count - a.count});
        for (var i = 0; i < sorted.length; i++) {
            log('SSL_write candidate '+sorted[i].addr+' (x'+sorted[i].count+')');
        }
        if (sorted.length > 0) log('BEST CANDIDATE '+sorted[0].addr);
    }, 120000);
}

function tryHook(offset) {
    var key = '0x'+offset.toString(16);
    if (triedAddrs[key]) return;
    triedAddrs[key] = true;
    if (!flutter) return;
    try {
        Interceptor.attach(flutter.base.add(offset), {
            onEnter: function(args) {
                try {
                    var len = args[2].toInt32();
                    if (len < 10 || len > 50000) return;
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
                        log('!!! PLAINTEXT at 0x'+offset.toString(16)+' '+s.substring(0,500));
                    }
                } catch(e) {}
            }
        });
        log('HOOKED candidate libflutter.so+0x'+offset.toString(16));
    } catch(e) {}
}
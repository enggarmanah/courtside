function log(msg) { console.log(msg); }

var flutter = Process.findModuleByName('libflutter.so');
if (!flutter) {
    log('[!] libflutter.so not found');
} else {
    log('[+] libflutter.so base=' + flutter.base + ' size=0x' + flutter.size.toString(16));
}

var libc = Process.getModuleByName('libc.so');
var connectAddr = libc.findExportByName('connect');
if (!connectAddr) {
    log('[!] connect not found');
} else {
    log('[+] connect at ' + connectAddr);
    
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
                        if (port === 443) {
                            this.tracked = true;
                            this.ip = ip;
                            log('[CONNECT] ' + ip + ':' + port);
                            
                            // Test backtrace
                            try {
                                var bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
                                log('[BT] ' + bt.length + ' frames');
                                for (var i = 0; i < Math.min(bt.length, 10); i++) {
                                    var addr = bt[i];
                                    if (addr.compare(flutter.base) >= 0 && addr.compare(flutter.base.add(flutter.size)) < 0) {
                                        log('[BT] frame ' + i + ': libflutter.so+0x' + addr.sub(flutter.base).toString(16));
                                    }
                                }
                            } catch(e) {
                                log('[BT] backtrace failed: ' + e.message);
                            }
                        }
                    }
                }
            } catch(e) {}
        },
        onLeave: function(retval) {
            if (this.tracked) {
                log('[CONNECT] returned fd=' + retval.toInt32() + ' to ' + this.ip);
            }
        }
    });
    log('[+] connect hooked');
}

log('[+] Test script loaded - interact with app');
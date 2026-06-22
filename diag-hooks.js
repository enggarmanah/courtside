function log(m) { console.log(new Date().toISOString().slice(11,19)+' '+m); }
log('diag started');

var libc = Process.getModuleByName('libc.so');

// 1. Hook open() - file ops are always happening
var openAddr = libc.findExportByName('open');
if (openAddr) {
    Interceptor.attach(openAddr, { onEnter: function(args) { this.path = args[0]; }, onLeave: function(ret) {
        if (ret.toInt32() > 0) { try { log('open '+this.path.readCString()+' = '+ret.toInt32()); } catch(e) {} }
    }});
    log('open hooked');
}

// 2. Hook connect() - minimal count only
var connectAddr = libc.findExportByName('connect');
var connCount = 0, apiCount = 0;
if (connectAddr) {
    Interceptor.attach(connectAddr, {
        onLeave: function(ret) {
            connCount++;
            if (ret.toInt32() === 0) {
                try {
                    var sa = this.context.rsi;
                    if (!sa || sa.isNull()) return;
                    var f = sa.readU16();
                    if (f !== 2) return;
                    var p = ((sa.add(2).readU8()<<8)|sa.add(3).readU8());
                    if (p === 443) {
                        var ip = new Uint8Array(sa.add(4).readByteArray(4)).join('.');
                        log('CONNECT '+ip+':443 (#'+connCount+')');
                        apiCount++;
                    }
                } catch(e) {}
            }
        }
    });
    log('connect hooked');
}

// 3. Report after 30s
setTimeout(function() {
    log('=== 30s DIAG ===');
    log('Total connects: '+connCount+'  API(443): '+apiCount);
}, 30000);
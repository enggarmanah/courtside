function log(m) { console.log(new Date().toISOString() + ' ' + m); }

var libc = Process.getModuleByName('libc.so');
var connect = libc.findExportByName('connect');

Interceptor.attach(connect, {
    onEnter: function(args) {
        var fd = args[0].toInt32();
        var sa = args[1];
        try {
            var family = sa.readU16();
            if (family === 2) {
                var port = ((sa.add(2).readU8() << 8) | sa.add(3).readU8());
                var ip = new Uint8Array(sa.add(4).readByteArray(4));
                this.info = ip.join('.') + ':' + port;
            }
        } catch(e) {}
    },
    onLeave: function(ret) {
        if (this.info) log('CONNECT ' + this.info + ' -> ret=' + ret.toInt32());
    }
});

log('Minimal connect hook active');
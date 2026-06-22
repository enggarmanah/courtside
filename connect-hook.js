var libc = Process.getModuleByName('libc.so');
var connectAddr = libc.findExportByName('connect');
Interceptor.attach(connectAddr, {
    onEnter: function(args) {
        var addr = args[1];
        if (addr) {
            var family = addr.readU16();
            if (family === 2) { // AF_INET
                var port = (addr.readU8(2) << 8) | addr.readU8(3);
                var ipBytes = addr.add(4).readByteArray(4);
                var ipStr = Array.from(ipBytes).join('.');
                console.log('[connect] ' + ipStr + ':' + port);
            }
        }
    }
});
console.log('connect hook installed - app connections will appear here');
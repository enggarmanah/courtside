var sslWriteCount = 0;
var sendCount = 0;

try {
    var ssl = Process.getModuleByName('libssl.so');
    var SSL_write = ssl.findExportByName('SSL_write');
    Interceptor.attach(SSL_write, {
        onEnter: function(args) {
            sslWriteCount++;
            console.log('[SSL_write #' + sslWriteCount + '] len=' + args[2]);
            try {
                var buf = args[1].readByteArray(Math.min(args[2].toInt32(), 500));
                var s = String.fromCharCode.apply(null, Array.from(buf));
                if (s.includes('GET') || s.includes('POST') || s.includes('HTTP') || s.includes('{')) {
                    console.log('>>> ' + s.substring(0, 1500));
                }
            } catch(e) {}
        }
    });
    console.log('SSL_write hooked at ' + SSL_write);
} catch(e) { console.log('SSL_write failed: ' + e); }

try {
    var libc = Process.getModuleByName('libc.so');
    var send = libc.findExportByName('send');
    Interceptor.attach(send, {
        onEnter: function(args) {
            sendCount++;
            console.log('[send #' + sendCount + '] fd=' + args[0] + ' len=' + args[2]);
        }
    });
    console.log('send hooked at ' + send);
} catch(e) { console.log('send failed: ' + e); }

console.log('hooks active');
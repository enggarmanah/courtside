var libc = Process.getModuleByName('libc.so');
var sendAddr = libc.findExportByName('send');

Interceptor.attach(sendAddr, {
    onEnter: function(args) {
        var fd = args[0].toInt32();
        var len = args[2].toInt32();
        if (len > 50 && len < 10000) {
            try {
                var data = args[1].readByteArray(Math.min(len, 200));
                if (data) {
                    var bytes = Array.from(data);
                    var s = '';
                    for (var i = 0; i < Math.min(bytes.length, 150); i++) {
                        s += String.fromCharCode(bytes[i]);
                    }
                    // Only show HTTP-like or JSON content
                    if (s.includes('POST') || s.includes('GET') || s.includes('HTTP') || s.includes('api') || s.includes('login') || s.includes('auth') || s.includes('court') || s.includes('{"') || s.includes('[{')) {
                        console.log('[send fd=' + fd + ' len=' + len + '] ' + s.substring(0, 500));
                    }
                } else {
                    console.log('[send fd=' + fd + ' len=' + len + '] null data');
                }
            } catch(e) {
                console.log('[send err: ' + e + ']');
            }
        }
    }
});

console.log('send hook active');
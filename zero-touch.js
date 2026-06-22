// Absolute minimal: only log, don't touch any memory
var libc = Process.getModuleByName('libc.so');
var connect = libc.findExportByName('connect');
var connectCount = 0;

Interceptor.attach(connect, {
    onLeave: function(ret) {
        connectCount++;
        if (connectCount <= 20) {
            console.log('connect #' + connectCount + ' ret=' + ret.toInt32());
        }
    }
});

console.log('MINIMAL hook: only onLeave, no memory reads. connect=' + connect);
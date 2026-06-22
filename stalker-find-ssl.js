function ts() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
}

function log(msg) { console.log('[' + ts() + '] ' + msg); }

var flutter = null;
var trackedFds = {};
var boringSSLWrite = null;
var boringSSLRead = null;
var callGraph = {};  // addr -> {count, highestAddr, lowestAddr}

function stalkerFindBoringSSL() {
    flutter = Process.findModuleByName('libflutter.so');
    if (!flutter) { log('[!] libflutter.so not found'); return; }
    log('[+] libflutter.so base=' + flutter.base + ' size=0x' + flutter.size.toString(16));

    // Strategy: hook connect() from libc, and for connections to 443,
    // use Stalker to trace execution within libflutter.so to discover
    // internal function entry points. Then we can analyze the collected
    // call graph to find SSL_write/SSL_read.

    var libc = Process.getModuleByName('libc.so');
    var connectAddr = libc.findExportByName('connect');
    var writeAddr = libc.findExportByName('write');
    var readAddr = libc.findExportByName('read');

    var stalkingActive = false;
    var stalkedThread = null;

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
                                var ip = ipBytes.join('.');
                                this.tracked = true;
                                this.ip = ip;
                                this.port = port;
                                this.fd = -1;
                            }
                        }
                    }
                } catch(e) {}
            },
            onLeave: function(retval) {
                if (this.tracked) {
                    this.fd = retval.toInt32();
                    if (this.fd > 0) {
                        trackedFds[this.fd] = {ip: this.ip, port: this.port};
                        log('[CONNECT] fd=' + this.fd + ' -> ' + this.ip + ':' + this.port);

                        if (!stalkingActive) {
                            stalkingActive = true;
                            stalkedThread = Process.getCurrentThreadId();
                            log('[STALKER] Starting Stalker on thread ' + stalkedThread + ' for libflutter.so');
                            
                            Stalker.follow(stalkedThread, {
                                transform: function(iterator) {
                                    var instruction;
                                    while ((instruction = iterator.next()) !== null) {
                                        // Collect all calls and jumps within libflutter.so
                                        if (instruction.address.compare(flutter.base) >= 0 && 
                                            instruction.address.compare(flutter.base.add(flutter.size)) < 0) {
                                            var off = instruction.address.sub(flutter.base);
                                            
                                            // Group operands that are references within libflutter.so
                                            if (instruction.mnemonic === 'call' || instruction.mnemonic === 'jmp') {
                                                try {
                                                    var target = instruction.operands[0];
                                                    if (target && target.type === 'imm') {
                                                        var targetAddr = target.value;
                                                        if (targetAddr.compare(flutter.base) >= 0 && targetAddr.compare(flutter.base.add(flutter.size)) < 0) {
                                                            send({type: 'callgraph', from: off.toInt32(), to: targetAddr.sub(flutter.base).toInt32()});
                                                        }
                                                    }
                                                } catch(e) {}
                                            }
                                        }
                                        iterator.keep();
                                    }
                                },
                                eventCallbacks: {
                                    compile: true
                                }
                            });
                            log('[STALKER] Stalker active - tracing execution within libflutter.so');
                        }
                    }
                }
            }
        });
        log('[+] libc connect hooked for Stalker triggering');
    }

    if (writeAddr) {
        Interceptor.attach(writeAddr, {
            onEnter: function(args) {
                var fd = args[0].toInt32();
                if (!trackedFds[fd]) return;
                var len = args[2].toInt32();
                if (len < 100) return;
                
                var buf = args[1];
                var caller = this.returnAddress;
                
                if (caller.compare(flutter.base) >= 0 && caller.compare(flutter.base.add(flutter.size)) < 0) {
                    var callerOff = caller.sub(flutter.base);
                    log('[WRITE-to-443] fd=' + fd + ' len=' + len + ' from libflutter.so+0x' + callerOff.toString(16));
                    
                    // Capture a backtrace at the point of the write
                    var bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
                    var frames = [];
                    for (var i = 0; i < bt.length; i++) {
                        var addr = bt[i];
                        if (addr.compare(flutter.base) >= 0 && addr.compare(flutter.base.add(flutter.size)) < 0) {
                            frames.push(addr.sub(flutter.base));
                        }
                    }
                    if (frames.length > 0) {
                        log('[BT] ' + frames.map(function(f) { return '0x' + f.toString(16); }).join(' <- '));
                    }
                }
            }
        });
        log('[+] libc write hooked for backtrace');
    }

    // Periodically dump collected call graph
    setInterval(function() {
        var entries = Object.keys(callGraph).length;
        if (entries > 0 && entries % 50 === 0) {
            log('[GRAPH] Collected ' + entries + ' unique call targets in libflutter.so');
        }
    }, 10000);
}

// Receive data from Stalker transform
recv(function(msg) {
    if (msg.type === 'callgraph') {
        var from = msg.from;
        var to = msg.to;
        var key = from + '->' + to;
        if (!callGraph[key]) {
            callGraph[key] = {count: 0, from: from, to: to};
        }
        callGraph[key].count++;
    }
});

// When done, dump the call graph
function dumpGraph() {
    var entries = [];
    for (var k in callGraph) {
        if (callGraph.hasOwnProperty(k)) {
            entries.push(callGraph[k]);
        }
    }
    entries.sort(function(a, b) { return b.count - a.count; });
    log('[GRAPH] === Top call targets in libflutter.so ===');
    for (var i = 0; i < Math.min(entries.length, 100); i++) {
        log('[GRAPH] 0x' + entries[i].from.toString(16) + ' -> 0x' + entries[i].to.toString(16) + ' (x' + entries[i].count + ')');
    }
    log('[GRAPH] === Total: ' + entries.length + ' call edges ===');
}

Java.perform(function() {
    log('[+] Starting Stalker-based BoringSSL discovery');
    stalkerFindBoringSSL();
    log('[+] Hooks active. Interact with the app to trigger API calls.');
});

setTimeout(function() {
    log('[+] 90s capture window ended.');
    dumpGraph();
    if (Stalker) {
        try { Stalker.unfollow(Process.getCurrentThreadId()); } catch(e) {}
    }
}, 90000);
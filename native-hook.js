Process.enumerateModules().forEach(function(mod) {
    if (mod.name === "libc.so") {
        console.log("Found libc.so");
        ["connect", "getaddrinfo", "send"].forEach(function(fn) {
            try {
                var addr = mod.findExportByName(fn);
                if (addr) {
                    console.log("  " + fn + " at " + addr);
                    Interceptor.attach(addr, {
                        onEnter: (function(fnName) {
                            return function(args) {
                                if (fnName === "connect") {
                                    var addr = args[1];
                                    if (addr) {
                                        var family = addr.readU16();
                                        if (family === 2) {
                                            var port = ((addr.readU8(2) << 8) | addr.readU8(3));
                                            var ipBytes = addr.add(4).readByteArray(4);
                                            var ipStr = Array.from(ipBytes).join('.');
                                            console.log("[connect] " + ipStr + ":" + port);
                                        }
                                    }
                                } else if (fnName === "getaddrinfo" && args[0]) {
                                    console.log("[DNS] " + args[0].readCString());
                                } else if (fnName === "send") {
                                    try {
                                        var buf = args[1].readByteArray(256);
                                        var str = String.fromCharCode.apply(null, Array.from(buf));
                                        if (str.includes("GET ") || str.includes("POST ") || str.includes("HTTP") || str.includes("CONNECT")) {
                                            console.log("[SEND] " + str.trim().substring(0, 300));
                                        }
                                    } catch(e) {}
                                }
                            };
                        })(fn)
                    });
                }
            } catch(e) { console.log("  " + fn + " error: " + e); }
        });
    }
});

console.log("Hooks installed");
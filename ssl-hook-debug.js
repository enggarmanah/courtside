function ts() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
}

function log(msg) {
    console.log('[' + ts() + '] ' + msg);
}

function isGzipMagic(bytes) {
    return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function findGzipOffset(bytes) {
    for (var i = 0; i < bytes.length - 1; i++) {
        if (bytes[i] === 0x1f && bytes[i+1] === 0x8b) return i;
    }
    return -1;
}

var gzipCounter = 0;

function saveGzip(bytes, prefix) {
    gzipCounter++;
    var label = prefix + '_' + gzipCounter + '.gz';
    try {
        Java.perform(function() {
            var arr = [];
            for (var i = 0; i < bytes.length; i++) arr.push(bytes[i]);
            var javaBytes = Java.array('byte', arr);
            var FileOutputStream = Java.use('java.io.FileOutputStream');
            var path = '/data/data/com.startive.courtside.app/files/' + label;
            var fos = FileOutputStream.$new(path);
            fos.write(javaBytes);
            fos.close();
            log('[FILE] Saved ' + path + ' (' + bytes.length + ' bytes)');
        });
    } catch(e) {
        log('[FILE] Error saving ' + label + ': ' + e.toString().substring(0, 60));
    }
}

function bytesToString(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) {
        s += String.fromCharCode(bytes[i]);
    }
    return s;
}

function bodyFromHttp(bytes) {
    for (var i = 0; i < bytes.length - 3; i++) {
        if ((bytes[i] === 13 && bytes[i+1] === 10 && bytes[i+2] === 13 && bytes[i+3] === 10) ||
            (bytes[i] === 10 && bytes[i+1] === 10)) {
            if (bytes[i] === 13) return bytes.slice(i + 4);
            else return bytes.slice(i + 2);
        }
    }
    return null;
}

function headerSection(bytes) {
    for (var i = 0; i < bytes.length - 3; i++) {
        if ((bytes[i] === 13 && bytes[i+1] === 10 && bytes[i+2] === 13 && bytes[i+3] === 10) ||
            (bytes[i] === 10 && bytes[i+1] === 10)) {
            if (bytes[i] === 13) return bytes.slice(0, i);
            else return bytes.slice(0, i);
        }
    }
    return null;
}

function hasHeader(headers, name) {
    var s = bytesToString(headers);
    var lower = s.toLowerCase();
    return lower.indexOf(name.toLowerCase()) >= 0;
}

function dechunk(body) {
    var result = [];
    var i = 0;
    while (i < body.length) {
        var chunkSizeEnd = -1;
        for (var j = i; j < body.length - 1; j++) {
            if (body[j] === 13 && body[j+1] === 10) {
                chunkSizeEnd = j;
                break;
            }
            if (body[j] === 10) {
                chunkSizeEnd = j;
                break;
            }
        }
        if (chunkSizeEnd < 0) break;
        var sizeLine = '';
        for (var k = i; k < chunkSizeEnd; k++) {
            sizeLine += String.fromCharCode(body[k]);
        }
        var semiIdx = sizeLine.indexOf(';');
        if (semiIdx >= 0) sizeLine = sizeLine.substring(0, semiIdx);
        var chunkSize = parseInt(sizeLine.trim(), 16);
        if (isNaN(chunkSize) || chunkSize === 0) break;
        var dataStart = chunkSizeEnd + (body[chunkSizeEnd] === 13 ? 2 : 1);
        for (var k = 0; k < chunkSize && (dataStart + k) < body.length; k++) {
            result.push(body[dataStart + k]);
        }
        i = dataStart + chunkSize + (body[dataStart + chunkSize] === 13 ? 2 : 1);
    }
    return new Uint8Array(result);
}

function toAscii(bytes, maxLen) {
    var s = '';
    var limit = maxLen ? Math.min(bytes.length, maxLen) : bytes.length;
    for (var i = 0; i < limit; i++) {
        var b = bytes[i];
        if (b >= 32 && b <= 126) s += String.fromCharCode(b);
        else if (b === 10) s += '\n';
        else if (b === 13) {}
        else if (b > 0) s += '.';
    }
    return s;
}

function printResponse(bytes, label) {
    var rawText = toAscii(bytes);

    var headers = headerSection(bytes);
    if (!headers) {
        log(label + ' ' + bytes.length + 'b:\n' + rawText);
        return;
    }

    var body = bodyFromHttp(bytes);
    var hdrText = bytesToString(headers);
    var isChunked = hasHeader(headers, 'Transfer-Encoding') && hasHeader(headers, 'chunked');
    var isGzipEncoded = hasHeader(headers, 'Content-Encoding') && hasHeader(headers, 'gzip');

    var rawBody = body;
    if (isChunked && body) {
        rawBody = dechunk(body);
    }

    if (rawBody && isGzipEncoded) {
        var gzipOff = findGzipOffset(rawBody);
        if (gzipOff >= 0) {
            var gzipData = gzipOff === 0 ? rawBody : rawBody.slice(gzipOff);
            saveGzip(gzipData, label.indexOf('REQUEST') >= 0 ? 'req' : 'resp');
            log(label + ' (gzip ' + bytes.length + 'b, saved ' + gzipData.length + ' bytes):\n' + hdrText + '\n--- body saved to files/ ---');
        } else {
            log(label + ' (gzip ' + bytes.length + 'b, no magic found):\n' + rawText);
        }
        return;
    }

    if (rawBody && rawBody.length > 0) {
        log(label + ' ' + bytes.length + 'b:\n' + hdrText + '\n\n--- BODY ---\n' + toAscii(rawBody) + '\n--- END ---');
    } else {
        log(label + ' ' + bytes.length + 'b:\n' + rawText);
    }
}

function hookSSLLibraries() {
    var hooked = false;
    var candidates = ['libssl.so', 'libboringssl.so', 'libcrypto.so', 'libcronet.so', 'libcronet.91.so', 'libcronet.97.so'];

    function tryHookModule(mod) {
        var exports = [];
        exports = exports.concat(['SSL_write', 'SSL_read']);
        exports = exports.concat(['SSL_write_ex', 'SSL_read_ex']);
        exports = exports.concat(['BIO_write', 'BIO_read']);
        exports = exports.concat(['ssl_write', 'ssl_read']);

        var writeAddr = null;
        var readAddr = null;
        for (var e = 0; e < exports.length; e++) {
            try {
                var addr = mod.findExportByName(exports[e]);
                if (!addr) continue;
                if (exports[e].indexOf('write') >= 0 || exports[e].indexOf('Write') >= 0) {
                    if (!writeAddr) writeAddr = addr;
                }
                if (exports[e].indexOf('read') >= 0 || exports[e].indexOf('Read') >= 0) {
                    if (!readAddr) readAddr = addr;
                }
            } catch(ex) {}
        }

        var nArgs = (writeAddr && readAddr) ? 2 : (writeAddr || readAddr) ? 1 : 0;
        if (nArgs === 0) {
            log('[!] No exports found in ' + mod.name);
            return false;
        }

        if (writeAddr) {
            Interceptor.attach(writeAddr, {
                onEnter: function(args) {
                    var len = args[2].toInt32();
                    if (len < 10) return;
                    try {
                        var buf = args[1].readByteArray(Math.min(len, 10000));
                        if (!buf) return;
                        var bytes = new Uint8Array(buf);
                        printResponse(bytes, '>>> REQUEST');
                    } catch(e) {}
                }
            });
            log('[+] Hooked write ' + writeAddr + ' in ' + mod.name);
        }

        if (readAddr) {
            Interceptor.attach(readAddr, {
                onEnter: function(args) {
                    this.buf = args[1];
                },
                onLeave: function(retval) {
                    var bytesRead = retval.toInt32();
                    if (bytesRead < 10) return;
                    try {
                        var buf = this.buf.readByteArray(Math.min(bytesRead, 100000));
                        if (!buf) return;
                        var bytes = new Uint8Array(buf);
                        printResponse(bytes, '<<< RESPONSE');
                    } catch(e) {}
                }
            });
            log('[+] Hooked read ' + readAddr + ' in ' + mod.name);
        }

        return true;
    }

    for (var i = 0; i < candidates.length; i++) {
        try {
            var mod = Process.getModuleByName(candidates[i]);
            log('[+] Found module: ' + candidates[i]);
            if (tryHookModule(mod)) hooked = true;
        } catch(e) {}
    }

    if (!hooked) {
        log('[!] No SSL modules found. Enumerating...');
        Process.enumerateModules({
            onMatch: function(m) {
                if (m.name.indexOf('ssl') >= 0 || m.name.indexOf('SSL') >= 0 ||
                    m.name.indexOf('cronet') >= 0 || m.name.indexOf('Cronet') >= 0 ||
                    m.name.indexOf('boringssl') >= 0) {
                    log('  Candidate: ' + m.name + ' base=' + m.base);
                }
            },
            onComplete: function() {
                log('[!] Enumeration complete. No hooks installed.');
            }
        });
    }

    return hooked;
}

function hookLibcNetwork() {
    try {
        var libc = Process.getModuleByName('libc.so');
        var connectAddr = libc.findExportByName('connect');
        var getaddrinfoAddr = libc.findExportByName('getaddrinfo');
        var sendAddr = libc.findExportByName('send');
        var recvAddr = libc.findExportByName('recv');

        if (getaddrinfoAddr) {
            Interceptor.attach(getaddrinfoAddr, {
                onEnter: function(args) {
                    try {
                        if (args[0]) {
                            var name = args[0].readCString();
                            if (name && name.indexOf('googleapis') < 0 && name.indexOf('firebase') < 0) {
                                log('[DNS] ' + name);
                            }
                        }
                    } catch(e) {}
                }
            });
            log('[+] libc getaddrinfo hooked');
        }

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
                            var ipData = sockaddr.add(4).readByteArray(4);
                            if (ipData) {
                                var ipBytes = new Uint8Array(ipData);
                                var ipStr = ipBytes.join('.');
                                log('[NET] connect ' + ipStr + ':' + port);
                            }
                        }
                    } catch(e) {}
                }
            });
            log('[+] libc connect hooked');
        }

        if (sendAddr) {
            Interceptor.attach(sendAddr, {
                onEnter: function(args) {
                    var fd = args[0].toInt32();
                    var len = args[2].toInt32();
                    if (len < 20) return;
                    try {
                        var raw = args[1].readByteArray(Math.min(len, 64));
                        if (raw) {
                            var bytes = new Uint8Array(raw);
                            var isTLS = (bytes[0] === 0x16 || bytes[0] === 0x17);
                            if (isTLS) {
                                var version = (bytes[1] << 8) | bytes[2];
                                var content = '';
                                for (var i = 5; i < Math.min(bytes.length, 20); i++) {
                                    var b = bytes[i];
                                    if (b >= 32 && b <= 126) content += String.fromCharCode(b);
                                }
                                log('[SEND fd=' + fd + ' TLS ver=' + version + '] ' + content.substring(0, 40));
                            } else {
                                var s = '';
                                for (var i = 0; i < bytes.length; i++) {
                                    var b = bytes[i];
                                    if (b >= 32 && b <= 126) s += String.fromCharCode(b);
                                }
                                if (s.length > 5) {
                                    log('[SEND fd=' + fd + ' raw] ' + s.substring(0, 40));
                                }
                            }
                        }
                    } catch(e) {}
                }
            });
            log('[+] libc send hooked');
        }

        if (recvAddr) {
            Interceptor.attach(recvAddr, {
                onEnter: function(args) {
                    this.buf = args[1];
                },
                onLeave: function(retval) {
                    var bytesRead = retval.toInt32();
                    if (bytesRead < 20) return;
                    try {
                        var raw = this.buf.readByteArray(Math.min(bytesRead, 64));
                        if (raw) {
                            var bytes = new Uint8Array(raw);
                            var isTLS = (bytes[0] === 0x16 || bytes[0] === 0x17);
                            if (isTLS) {
                                var version = (bytes[1] << 8) | bytes[2];
                                log('[RECV fd=' + ' TLS ver=' + version + '] len=' + bytesRead);
                            }
                        }
                    } catch(e) {}
                }
            });
            log('[+] libc recv hooked');
        }

        var extraSock = ['read', 'write', 'sendmsg', 'recvmsg', 'sendto', 'recvfrom'];
        for (var e = 0; e < extraSock.length; e++) {
            try {
                var addr = libc.findExportByName(extraSock[e]);
                if (addr) {
                    (function(fnName) {
                        Interceptor.attach(addr, {
                            onEnter: function(args) {
                                var fd = args[0].toInt32();
                                var len = args[2] ? args[2].toInt32() : 0;
                                if (len < 20 && fnName !== 'connect') return;
                                try {
                                    var raw = args[1] ? args[1].readByteArray(Math.min(len || 64, 64)) : null;
                                    if (raw) {
                                        var bytes = new Uint8Array(raw);
                                        var isTLS = (bytes[0] === 0x16 || bytes[0] === 0x17 || bytes[0] === 0x15);
                                        if (isTLS) {
                                            log('[SOCK] ' + fnName + '(fd=' + fd + ') TLS len=' + len);
                                        }
                                    }
                                } catch(ex) {}
                            }
                        });
                    })(extraSock[e]);
                    log('[+] libc ' + extraSock[e] + ' hooked');
                }
            } catch(ex) {}
        }
    } catch(e) {
        log('[!] libc hook error: ' + e);
    }
}

function findTlsLibraries() {
    console.log('[SCAN] Enumerating all modules...');
    try {
        var mods = Process.enumerateModules();
        console.log('[SCAN] ' + mods.length + ' modules loaded');
        for (var i = 0; i < mods.length; i++) {
            var m = mods[i];
            var name = m.name.toLowerCase();
            if (name.indexOf('ssl') >= 0 || name.indexOf('crypto') >= 0 || name.indexOf('cronet') >= 0 || name.indexOf('flutter') >= 0 || name.indexOf('boringssl') >= 0) {
                console.log('[MODULE] ' + m.name + ' size=' + m.size + ' base=' + m.base);
            }
        }
        console.log('[SCAN] Scan complete.');
    } catch(e) {
        console.log('[SCAN] Error: ' + e);
    }
}

function hookFlutterBoringSSL() {
    try {
        var flutter = Process.findModuleByName('libflutter.so');
        if (!flutter) {
            console.log('[FSSL] libflutter.so not found');
            return false;
        }
        console.log('[FSSL] Scanning libflutter.so for BoringSSL functions...');

        // Strategy: search for unique BoringSSL strings in .rodata
        // then cross-reference to find SSL_write/SSL_read
        var foundWrite = false, foundRead = false;

        // Try enumerating symbols (might work on non-stripped builds)
        var symCount = 0;
        try {
            flutter.enumerateSymbols({
                onMatch: function(sym) {
                    symCount++;
                    if (sym.name.indexOf('SSL_write') >= 0 || sym.name.indexOf('ssl_write') >= 0) {
                        try {
                            Interceptor.attach(sym.address, {
                                onEnter: function(args) {
                                    var len = args[2].toInt32();
                                    if (len < 10) return;
                                    try {
                                        var buf = args[1].readByteArray(Math.min(len, 10000));
                                        if (!buf) return;
                                        var bytes = new Uint8Array(buf);
                                        printResponse(bytes, '>>> FLUTTER_REQ');
                                    } catch(e) {}
                                }
                            });
                            console.log('[FSSL] SSL_write hooked at ' + sym.address + ' via symbol');
                            foundWrite = true;
                        } catch(e) {}
                    }
                    if (sym.name.indexOf('SSL_read') >= 0 || sym.name.indexOf('ssl_read') >= 0) {
                        try {
                            Interceptor.attach(sym.address, {
                                onEnter: function(args) {
                                    this.buf = args[1];
                                },
                                onLeave: function(retval) {
                                    var bytesRead = retval.toInt32();
                                    if (bytesRead < 10) return;
                                    try {
                                        var buf = this.buf.readByteArray(Math.min(bytesRead, 100000));
                                        if (!buf) return;
                                        var bytes = new Uint8Array(buf);
                                        printResponse(bytes, '<<< FLUTTER_RESP');
                                    } catch(e) {}
                                }
                            });
                            console.log('[FSSL] SSL_read hooked at ' + sym.address + ' via symbol');
                            foundRead = true;
                        } catch(e) {}
                    }
                },
                onComplete: function() {
                    console.log('[FSSL] Symbol scan: ' + symCount + ' symbols checked');
                }
            });
        } catch(e) {
            console.log('[FSSL] enumerateSymbols failed: ' + e);
        }

        if (foundWrite && foundRead) return true;

        console.log('[FSSL] Scanning readable ranges for "SSL_write" string...');
        var ranges = [];
        try {
            ranges = ranges.concat(Process.enumerateRanges('r--'));
        } catch(e) {}
        try {
            ranges = ranges.concat(Process.enumerateRanges('rw-'));
        } catch(e) {}
        var flutterEnd = flutter.base.add(flutter.size);
        var sslWriteAddrs = [];
        for (var ri = 0; ri < ranges.length; ri++) {
            var r = ranges[ri];
            if (r.base.compare(flutter.base) < 0 && r.base.add(r.size).compare(flutter.base) <= 0) continue;
            if (r.base.compare(flutterEnd) >= 0) continue;
            try {
                var hits = Memory.scanSync(r.base, r.size, '53 53 4C 5F 77 72 69 74 65');
                for (var hi = 0; hi < hits.length; hi++) {
                    sslWriteAddrs.push(hits[hi].address);
                }
            } catch(e) {
                console.log('[FSSL]   range ' + r.base + ' size=' + r.size + ' scan failed');
            }
        }
        if (sslWriteAddrs.length > 0) {
            console.log('[FSSL] Found "SSL_write" string at ' + sslWriteAddrs.length + ' location(s)');
            for (var si = 0; si < sslWriteAddrs.length; si++) {
                console.log('[FSSL]   ' + sslWriteAddrs[si]);
            }
        } else {
            console.log('[FSSL] No "SSL_write" string found in libflutter.so ranges');
        }

        return foundWrite || foundRead;
    } catch(e) {
        console.log('[FSSL] Error: ' + e);
        return false;
    }
}

Java.perform(function() {
    var hooked = hookSSLLibraries();
    hookLibcNetwork();
    if (hooked) {
        log('[+] Hooks active. Capturing for 60 seconds...\n');
    } else {
        log('[!] SSL hooks not installed. Will exit after 60s.\n');
    }
});

function hookFlutterSSL() {
    try {
        var flutter = Process.getModuleByName('libflutter.so');
        if (!flutter) return false;
        var found = 0;
        flutter.enumerateSymbols({
            onMatch: function(sym) {
                var name = sym.name;
                if (name.indexOf('SSL_write') >= 0 || name.indexOf('SSL_write_EX') >= 0) {
                    try {
                        Interceptor.attach(sym.address, {
                            onEnter: function(args) {
                                var len = args[2].toInt32();
                                if (len < 10) return;
                                try {
                                    var buf = args[1].readByteArray(Math.min(len, 10000));
                                    if (!buf) return;
                                    var bytes = new Uint8Array(buf);
                                    printResponse(bytes, '>>> FLUTTER_REQ');
                                } catch(e) {}
                            }
                        });
                        console.log('[+] Flutter SSL_write hooked at ' + sym.address + ' (' + name + ')');
                        found++;
                    } catch(e) {}
                }
                if (name.indexOf('SSL_read') >= 0 || name.indexOf('SSL_read_EX') >= 0) {
                    try {
                        Interceptor.attach(sym.address, {
                            onEnter: function(args) {
                                this.buf = args[1];
                            },
                            onLeave: function(retval) {
                                var bytesRead = retval.toInt32();
                                if (bytesRead < 10) return;
                                try {
                                    var buf = this.buf.readByteArray(Math.min(bytesRead, 100000));
                                    if (!buf) return;
                                    var bytes = new Uint8Array(buf);
                                    printResponse(bytes, '<<< FLUTTER_RESP');
                                } catch(e) {}
                            }
                        });
                        console.log('[+] Flutter SSL_read hooked at ' + sym.address + ' (' + name + ')');
                        found++;
                    } catch(e) {}
                }
            },
            onComplete: function() {
                if (found === 0) console.log('[!] Flutter SSL symbols not found (stripped binary)');
                else console.log('[+] Flutter SSL hooks: ' + found);
            }
        });
        return found > 0;
    } catch(e) {
        console.log('[!] Flutter SSL hook error: ' + e);
        return false;
    }
}

findTlsLibraries();
hookFlutterBoringSSL();

setTimeout(function() {
    log('\n[+] 60s capture window ended.');
}, 60000);

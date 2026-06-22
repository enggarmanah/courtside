Java.perform(function() {
    var ArrayList = Java.use('java.util.ArrayList');

    // Log OkHttp requests
    try {
        var OkHttpClient = Java.use('okhttp3.OkHttpClient');
        OkHttpClient.newCall.overload('okhttp3.Request').implementation = function(request) {
            console.log("[OkHttp] " + request.method() + " " + request.url());
            return this.newCall(request);
        };
    } catch(e) { console.log("OkHttpClient.newCall not found"); }

    // Log HttpURLConnection requests
    try {
        var HttpURLConnection = Java.use('java.net.HttpURLConnection');
        HttpURLConnection.connect.implementation = function() {
            console.log("[HttpURLConnection] " + this.getURL());
            this.connect();
        };
    } catch(e) { console.log("HttpURLConnection.connect not found"); }

    // Log URL.openConnection
    try {
        var URL = Java.use('java.net.URL');
        URL.openConnection.overload().implementation = function() {
            console.log("[URL.openConnection] " + this.toString());
            return this.openConnection();
        };
        URL.openConnection.overload('java.net.Proxy').implementation = function(proxy) {
            console.log("[URL.openConnection(proxy)] " + this.toString() + " proxy=" + proxy);
            return this.openConnection(proxy);
        };
    } catch(e) { console.log("URL.openConnection not found"); }

    // Log Socket connections (bypasses proxy)
    try {
        var Socket = Java.use('java.net.Socket');
        Socket.connect.overload('java.net.SocketAddress', 'int').implementation = function(address, timeout) {
            console.log("[Socket.connect] " + address.toString());
            this.connect(address, timeout);
        };
    } catch(e) { console.log("Socket.connect not found"); }

    // Log SSLSocket connections
    try {
        var SSLSocket = Java.use('javax.net.ssl.SSLSocket');
        SSLSocket.connect.overload('java.net.SocketAddress', 'int').implementation = function(address, timeout) {
            console.log("[SSLSocket.connect] " + address.toString());
            this.connect(address, timeout);
        };
    } catch(e) { console.log("SSLSocket.connect not found"); }

    // OkHttp v3+ pinning bypass
    try {
        var CertificatePinner = Java.use('okhttp3.CertificatePinner');
        CertificatePinner.check.overload('java.lang.String', 'java.util.List').implementation = function(hostname, peerCertificates) {
            return;
        };
        CertificatePinner.check.overload('java.lang.String', 'java.security.cert.Certificate').implementation = function(hostname, certificate) {
            return;
        };
    } catch(e) { console.log("OkHttp pinning not found"); }

    // TrustAll X509TrustManager
    var TrustAllManager = Java.registerClass({
        name: 'com.courtside.TrustAll',
        implements: [Java.use('javax.net.ssl.X509TrustManager')],
        methods: {
            checkClientTrusted: function(chain, authType) {},
            checkServerTrusted: function(chain, authType) {},
            getAcceptedIssuers: function() { return []; }
        }
    });
    var trustAll = TrustAllManager.$new();

    // Hook SSLContext.init to inject trust all
    var SSLContext = Java.use('javax.net.ssl.SSLContext');
    SSLContext.init.overload('[Ljavax.net.ssl.KeyManager;', '[Ljavax.net.ssl.TrustManager;', 'java.security.SecureRandom').implementation = function(km, tm, sr) {
        var trustManagers = [trustAll];
        this.init(km, trustManagers, sr);
    };

    // Hostname verifier bypass
    var HostnameVerifier = Java.use('javax.net.ssl.HostnameVerifier');
    HostnameVerifier.verify.implementation = function(hostname, session) {
        return true;
    };

    console.log("SSL unpinning + URL logging hooks installed");
});
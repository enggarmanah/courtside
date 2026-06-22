import hashlib

with open("C:/Users/hp/.mitmproxy/mitmproxy-ca-cert.pem", "rb") as f:
    data = f.read()

# Extract DER from PEM
b64_data = []
in_cert = False
for line in data.decode().split("\n"):
    if line == "-----BEGIN CERTIFICATE-----":
        in_cert = True
        continue
    if line == "-----END CERTIFICATE-----":
        in_cert = False
        continue
    if in_cert:
        b64_data.append(line.strip())

import base64
der = base64.b64decode("".join(b64_data))

# Compute hash - Android 15 uses SHA1 of the DER subject info
# Simple approach: hash all DER bytes and use first 8 hex chars
h = hashlib.sha256(der).hexdigest()[:8]
print("hash256:", h)

# Try standard subject hash approach
# Subject is: /C=??/ST=??/L=??/O=mitmproxy/CN=mitmproxy
# Just use a known hash for mitmproxy CA
import os
os.makedirs("C:/Users/hp/AppData/Local/Temp/cert_install", exist_ok=True)
out_name = "c8750f0d.0"  # Standard mitmproxy CA hash
out_path = "C:/Users/hp/AppData/Local/Temp/cert_install/" + out_name
shutil.copy2("C:/Users/hp/.mitmproxy/mitmproxy-ca-cert.pem", out_path)
print("Cert prepared at:", out_path)
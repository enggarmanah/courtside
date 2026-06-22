"""Simple TCP server to accept connections and echo back data."""
import socket
import sys

def main():
    port = 8443
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(('0.0.0.0', port))
    s.listen(5)
    print(f"[*] Listening on port {port}. Waiting for app connections...")
    
    while True:
        try:
            conn, addr = s.accept()
            print(f"[+] Connection from {addr}")
            # Read whatever the app sends (TLS ClientHello)
            data = conn.recv(4096)
            print(f"[<] Received {len(data)} bytes")
            hex_preview = data[:100].hex()
            print(f"    First bytes: {hex_preview}...")
            # Send back dummy TLS ServerHello-like data
            # 0x16 = TLS handshake, 0x03 0x03 = TLS 1.2
            response = bytes([
                0x16, 0x03, 0x03, 0x00, 0x51,
                0x02, 0x00, 0x00, 0x4D, 0x03, 0x03
            ] + [0x00] * 80)
            conn.send(response)
            print(f"[>] Sent {len(response)} bytes (dummy ServerHello)")
            # Keep connection alive a bit
            import time
            time.sleep(2)
            conn.close()
            print(f"[*] Connection closed")
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"[!] Error: {e}")
    
    s.close()
    print("[*] Server stopped")

if __name__ == '__main__':
    main()
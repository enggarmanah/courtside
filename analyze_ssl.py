"""
Static analysis: Find BoringSSL SSL_write/SSL_read in libflutter.so
Strategy:
1. Parse ELF, find .text section
2. Scan for function prologues
3. Use known connect caller offset (0x95fb0a) as anchor
4. Find functions nearby that match SSL_write/SSL_read signatures
"""
import struct
import sys

def read_elf_sections(path):
    with open(path, 'rb') as f:
        data = f.read()

    # ELF header
    e_shoff = struct.unpack_from('<Q', data, 0x28)[0]
    e_shentsize = struct.unpack_from('<H', data, 0x3A)[0]
    e_shnum = struct.unpack_from('<H', data, 0x3C)[0]
    e_shstrndx = struct.unpack_from('<H', data, 0x3E)[0]

    sections = []
    for i in range(e_shnum):
        off = e_shoff + i * e_shentsize
        sh_name = struct.unpack_from('<I', data, off)[0]
        sh_type = struct.unpack_from('<I', data, off + 4)[0]
        sh_flags = struct.unpack_from('<Q', data, off + 8)[0]
        sh_addr = struct.unpack_from('<Q', data, off + 16)[0]
        sh_offset = struct.unpack_from('<Q', data, off + 24)[0]
        sh_size = struct.unpack_from('<Q', data, off + 32)[0]
        sections.append({
            'idx': i, 'type': sh_type, 'flags': sh_flags,
            'addr': sh_addr, 'offset': sh_offset, 'size': sh_size,
            'name_idx': sh_name
        })

    # Get section names from .shstrtab
    shstr = sections[e_shstrndx]
    shstrtab = data[shstr['offset']:shstr['offset']+shstr['size']]

    for s in sections:
        end = shstrtab.find(b'\0', s['name_idx'])
        s['name'] = shstrtab[s['name_idx']:end].decode('ascii', errors='replace')

    return data, sections

def find_text_section(sections):
    for s in sections:
        if s['name'] == '.text':
            return s
    return None

def scan_function_prologues(data, start, end):
    """Scan for x86_64 function prologues and return their offsets"""
    funcs = []
    i = start
    while i < end - 4:
        b = data[i:i+4]

        # Common x86_64 prologues:
        # push rbp; mov rbp, rsp  = 55 48 89 e5
        # push r15; push r14       = 41 57 41 56
        # push rbp; sub rsp, N     = 55 48 83 ec
        # endbr64 (for CET)        = f3 0f 1e fa

        if (b == b'\x55\x48\x89\xe5' or              # push rbp; mov rbp, rsp
            b == b'\x41\x57\x41\x56' or               # push r15; push r14
            (b[0:2] == b'\x55\x48' and b[2] == 0x83 and b[3] & 0xf8 == 0xe8) or  # push rbp; sub rsp, N
            b == b'\xf3\x0f\x1e\xfa'):                # endbr64
            # Check that we have enough bytes for a real function
            if i > start and data[i-1] in (0x90, 0xcc, 0xc3, 0x0f):
                funcs.append(i)
        i += 1
    return funcs

def find_xrefs_to(data, funcs, target_offset):
    """Find functions that call/jump to target_offset"""
    callers = []
    target_bytes = struct.pack('<i', target_offset - 5)  # relative offset for call
    for func_addr in funcs:
        # Search within reasonable function size (16KB max)
        end = min(func_addr + 0x4000, len(data))
        pos = func_addr
        while pos < end - 5:
            if data[pos] == 0xe8:  # call rel32
                rel = struct.unpack_from('<i', data, pos+1)[0]
                if rel + pos + 5 == target_offset:
                    callers.append((func_addr, pos, target_offset))
                    break
            pos += 1
    return callers

def find_boring_functions(data, text_section, known_connect_offset):
    """Find BoringSSL functions near the known connect caller"""
    text_start = text_section['offset']
    text_size = text_section['size']
    text_addr = text_section['addr']

    print(f"[*] .text section at file offset 0x{text_start:X}, size 0x{text_size:X}")
    # Convert known connect offset (virtual/libflutter-relative) to file offset
    connect_file_off = text_start + (known_connect_offset - text_addr)

    print(f"[*] Connect caller at file offset 0x{connect_file_off:X}")

    # Focus area: BoringSSL code around the connect caller
    search_start = max(text_start, connect_file_off - 0x80000)
    search_end = min(text_start + text_size, connect_file_off + 0x20000)

    print(f"[*] Scanning for functions at file 0x{search_start:X} - 0x{search_end:X}")

    funcs = scan_function_prologues(data, int(search_start), int(search_end))
    print(f"[*] Found {len(funcs)} function prologues in scan range")

    # Convert file offsets to libflutter.so-relative virtual offsets
    func_offsets = [(f - text_start + text_addr) for f in funcs]

    # Find functions that call our known connect offset
    target_file = connect_file_off
    callers = find_xrefs_to(data, funcs, target_file)

    if callers:
        print(f"\n[*] Functions that call connect wrapper (0x{known_connect_offset:X}):")
        for caller_addr, call_pos, target in callers[:20]:
            caller_off = caller_addr - text_start + text_addr
            print(f"    libflutter.so+0x{caller_off:X} (call instruction at +0x{call_pos - caller_addr:X})")
    else:
        print(f"\n[!] No xrefs to connect wrapper found (may need disassembly)")

    # Print all functions sorted by offset
    # Filter to functions near connect caller
    nearby = sorted([off for off in func_offsets if abs(off - known_connect_offset) < 0x30000])
    
    print(f"\n[*] Top 30 functions near connect caller (sorted):")
    for off in nearby[:30]:
        marker = " <-- CONNECT CALLER" if off == known_connect_offset else ""
        print(f"    libflutter.so+0x{off:X}{marker}")

    # Search for SSL-related strings near functions
    print(f"\n[*] Searching for SSL-related strings in BoringSSL region...")
    ssl_strings = [b'ssl_write', b'SSL_write', b'ssl_read', b'SSL_read',
                   b'ssl3_write', b'ssl3_read', b'write_bytes', b'read_bytes',
                   b'BIO_write', b'BIO_read', b'handshake', b'ssl3_',
                   b'boringssl', b'BORINGSSL', b'TLS_method', b'DTLS_method']

    for pattern in ssl_strings:
        pos = int(search_start)
        found_count = 0
        while pos < search_end:
            idx = data.find(pattern, pos, int(search_end))
            if idx == -1 or found_count >= 5:
                break
            found_count += 1
            # Find nearest function entry before this string
            nearby_func = None
            min_dist = 0x10000
            for f in funcs:
                if f <= idx and (idx - f) < min_dist:
                    min_dist = idx - f
                    nearby_func = f
            func_off = (nearby_func - text_start + text_addr) if nearby_func else 0
            print(f"    '{pattern.decode()}' at file 0x{idx:X} near libflutter.so+0x{func_off:X} (+0x{min_dist:X})")
            pos = idx + 1

    return func_offsets

def main():
    libflutter_path = r"C:\Workspace\courtside\lib\x86_64\libflutter.so"
    print(f"[*] Analyzing {libflutter_path}")

    data, sections = read_elf_sections(libflutter_path)
    print(f"[*] Found {len(sections)} sections")

    text = find_text_section(sections)
    if not text:
        print("[!] .text section not found")
        return

    print(f"[*] .text: file 0x{text['offset']:X}, vaddr 0x{text['addr']:X}, size 0x{text['size']:X}")

    known_connect = 0x95fb0a  # Discovered from backtrace test

    funcs = find_boring_functions(data, text, known_connect)

    # Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY: Use these offsets in Frida hooks:")
    print(f"  libflutter.so base varies per run (ASLR)")
    print(f"  Connect caller: libflutter.so + 0x{known_connect:X}")
    print(f"  Found {len(funcs)} function entries in BoringSSL region")
    print(f"  Total libflutter.so size: 0x{len(data):X} ({len(data)} bytes)")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
import argparse
import concurrent.futures as futures
import ipaddress
import platform
import socket
import struct
import subprocess
import sys
import time
from typing import Optional, Tuple, List

IS_WINDOWS = platform.system().lower().startswith('win')

def ping_host(ip: str, timeout_ms: int = 800) -> Tuple[bool, Optional[float]]:
    """Ping usando el binario del SO. Devuelve (alive, rtt_ms)."""
    if IS_WINDOWS:
        cmd = ["ping", "-n", "1", "-w", str(timeout_ms), ip]
    else:
        cmd = ["ping", "-c", "1", "-W", str(max(1, timeout_ms // 1000)), ip]

    t0 = time.perf_counter()
    try:
        proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        alive = (proc.returncode == 0)
    except Exception:
        return False, None
    dt = (time.perf_counter() - t0) * 1000.0
    return alive, (round(dt, 1) if alive else None)

def reverse_dns(ip: str, timeout: float = 1.0) -> Optional[str]:
    """Intenta resolver nombre por PTR (DNS reverso)."""
    orig_to = socket.getdefaulttimeout()
    socket.setdefaulttimeout(timeout)
    try:
        name, _, _ = socket.gethostbyaddr(ip)
        return name
    except Exception:
        return None
    finally:
        socket.setdefaulttimeout(orig_to)

# --------- NetBIOS NBSTAT (UDP/137) ---------
def _encode_netbios_name(name16: bytes) -> bytes:
    out = bytearray()
    for b in name16:
        out.append(ord('A') + ((b >> 4) & 0x0F))
        out.append(ord('A') + (b & 0x0F))
    return bytes(out)

def _nbns_build_node_status_query() -> bytes:
    import random
    tid = random.randint(0, 0xFFFF)
    header = struct.pack("!HHHHHH", tid, 0x0000, 1, 0, 0, 0)  # flags=0, 1 pregunta
    name16 = b'*' + b' ' * 15
    encoded = _encode_netbios_name(name16)
    qname = b'\x20' + encoded + b'\x00'
    qtype = 0x0021  # NBSTAT
    qclass = 0x0001 # IN
    return header + qname + struct.pack("!HH", qtype, qclass)

def _nbns_parse_node_status_response(data: bytes) -> Optional[str]:
    if len(data) < 12:
        return None
    idx = 12
    while idx < len(data) and data[idx] != 0x00:
        idx += 1
    idx += 1  # null
    idx += 4  # qtype+qclass
    if idx + 10 > len(data):
        return None
    idx += 2 + 2 + 2 + 4  # name ptr + type + class + ttl
    if idx + 2 > len(data):
        return None
    rdlength = struct.unpack_from("!H", data, idx)[0]
    idx += 2
    if idx + rdlength > len(data) or rdlength < 1:
        return None
    rdata = data[idx:idx+rdlength]
    num = rdata[0]
    pos = 1
    for _ in range(num):
        if pos + 18 > len(rdata):
            break
        raw_name15 = rdata[pos:pos+15]
        suffix = rdata[pos+15]
        flags = struct.unpack("!H", rdata[pos+16:pos+18])[0]
        pos += 18
        is_group = bool(flags & 0x8000)
        # Workstation Service <00>, Unique
        if suffix == 0x00 and not is_group:
            try:
                name = raw_name15.decode('ascii', errors='ignore').rstrip()
                if name:
                    return name
            except Exception:
                pass
    # fallback: primer nombre legible
    pos = 1
    if num > 0 and 1 + 15 <= len(rdata):
        try:
            name = rdata[1:1+15].decode('ascii', errors='ignore').rstrip()
            return name or None
        except Exception:
            return None
    return None

def netbios_name_udp137(ip: str, timeout: float = 1.2) -> Optional[str]:
    pkt = _nbns_build_node_status_query()
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.settimeout(timeout)
        try:
            s.sendto(pkt, (ip, 137))
            data, _ = s.recvfrom(4096)
            return _nbns_parse_node_status_response(data)
        except Exception:
            return None

# --------- Escaneo ---------
def expand_targets(cidr: Optional[str], ips_csv: Optional[str]) -> List[str]:
    targets = []
    if cidr:
        net = ipaddress.ip_network(cidr, strict=False)
        targets = [str(ip) for ip in net.hosts()]
    if ips_csv:
        for x in ips_csv.split(','):
            x = x.strip()
            if not x:
                continue
            if '/' in x:
                net = ipaddress.ip_network(x, strict=False)
                targets.extend(str(ip) for ip in net.hosts())
            elif '-' in x:
                parts = x.split('.')
                prefix = '.'.join(parts[:3])
                start, end = parts[3].split('-')
                for i in range(int(start), int(end)+1):
                    targets.append(f"{prefix}.{i}")
            else:
                targets.append(x)
    # deduplicar
    seen, uniq = set(), []
    for t in targets:
        if t not in seen:
            uniq.append(t); seen.add(t)
    return uniq

def scan_ip(ip: str, dns_timeout: float, nb_timeout: float, do_ping: bool) -> dict:
    alive, rtt = (True, None)
    if do_ping:
        alive, rtt = ping_host(ip)
        if not alive:
            return {"ip": ip, "alive": False, "rtt_ms": None,
                    "hostname_dns": None, "hostname_netbios": None, "best_name": None}
    rdns = reverse_dns(ip, timeout=dns_timeout)
    nbn = netbios_name_udp137(ip, timeout=nb_timeout)
    best = rdns or nbn
    return {"ip": ip, "alive": True, "rtt_ms": rtt,
            "hostname_dns": rdns, "hostname_netbios": nbn, "best_name": best}

def main():
    NombrePc = ""
    parser = argparse.ArgumentParser(description="Escáner de IP con nombre (DNS reverso + NetBIOS UDP/137).")
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--cidr", help="Rango CIDR, p.ej. 192.168.2.0/24")
    g.add_argument("--ips", help="IPs/rangos separados por coma. Ej: 192.168.2.1,192.168.2.10-50")
    parser.add_argument("--threads", type=int, default=120, help="Hilos simultáneos (default 120)")
    parser.add_argument("--no-ping", action="store_true", help="No hacer ping previo")
    parser.add_argument("--dns-timeout", type=float, default=1.0, help="Timeout DNS (s)")
    parser.add_argument("--nb-timeout", type=float, default=1.2, help="Timeout NetBIOS (s)")
    parser.add_argument("-o", "--csv", help="Guardar resultados en CSV")
    args = parser.parse_args()



    #
    # ...existing code...
    parser = argparse.ArgumentParser(description="Escáner de IP con nombre (DNS reverso + NetBIOS UDP/137).")
    parser.add_argument("--cidr", help="Rango CIDR, p.ej. 192.168.2.0/24")
    parser.add_argument("--ips", help="IPs/rangos separados por coma. Ej: 192.168.2.1,192.168.2.10-50,192.168.3.0/24")
    # ...existing code...
    
    targets = []
    if args.cidr:
        targets += expand_targets(args.cidr, None)
    if args.ips:
        targets += expand_targets(None, args.ips)
    if not targets:
        print("No hay objetivos."); sys.exit(1)
    # ...existing code...


    targets = expand_targets(args.cidr, args.ips)
    if not targets:
        print("No hay objetivos."); sys.exit(1)

    results = []
    with futures.ThreadPoolExecutor(max_workers=args.threads) as ex:
        futs = [ex.submit(scan_ip, ip, args.dns_timeout, args.nb_timeout, not args.no_ping) for ip in targets]
        for i, f in enumerate(futures.as_completed(futs), 1):
            try:
                results.append(f.result())
            except Exception as e:
                print(f"[!] Error en tarea: {e}")
            if i % 50 == 0:
                print(f"  Progreso: {i}/{len(targets)}")

    results.sort(key=lambda r: tuple(int(x) for x in r["ip"].split('.')))

    for r in results:
        NombrePc = f"{(r['hostname_dns'] or ''):<32}"
    
    if NombrePc and len(NombrePc.strip()) > 0:
        print(NombrePc)
    else:
        print("DEFAULT")

if __name__ == "__main__":
    main()

# python ipscaner.py --ips 192.168.2.140 --no-ping
"""
IEC 104 IOA kashfiyot skripti.

Har bir qurilmaga General Interrogation yuboradi va
BARCHA kelgan IOA raqamlarini ko'rsatadi.
Shu natijaga qarab to'g'ri katalog tuzasiz.

Foydalanish:
    python3 discover_ioa.py
    python3 discover_ioa.py 192.168.199.12        # bitta host
    python3 discover_ioa.py 192.168.199.10-32     # diapazon
"""
import socket
import struct
import sys
from dataclasses import dataclass

PORT            = 2404
CONNECT_TIMEOUT = 5.0
READ_TIMEOUT    = 8.0
CASDU           = 1       # standart CASDU, agar boshqa bo'lsa o'zgartiring

TYPE_NAMES = {
    1:  "SP",     # Single-point
    3:  "DP",     # Double-point
    9:  "NVA",    # Normalized
    11: "SVA",    # Scaled
    13: "IEEE_F", # IEEE float
    30: "SP+T",
    31: "DP+T",
    35: "SVA+T",
    36: "IEEE_F+T",
}

@dataclass
class State:
    send_seq: int = 0
    recv_seq: int = 0

def recv_exact(sock, n):
    buf = bytearray()
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("ulanish uzildi")
        buf.extend(chunk)
    return bytes(buf)

def recv_apdu(sock):
    s = recv_exact(sock, 1)
    if s != b"\x68":
        raise RuntimeError(f"noto'g'ri boshlang'ich bayt: {s.hex()}")
    l = recv_exact(sock, 1)[0]
    return s + bytes([l]) + recv_exact(sock, l)

def make_gi(state, casdu):
    asdu = bytes([100, 1, 6, 0, casdu & 0xFF, (casdu >> 8) & 0xFF, 0, 0, 0, 20])
    ctrl = struct.pack("<HH", state.send_seq << 1, state.recv_seq << 1)
    state.send_seq += 1
    return bytes([0x68, len(ctrl) + len(asdu)]) + ctrl + asdu

def parse(apdu, state):
    body = apdu[2: 2 + apdu[1]]
    if len(body) < 4 or body[0] & 1:
        return []
    state.recv_seq = max(state.recv_seq, (struct.unpack("<H", body[:2])[0] >> 1) + 1)
    asdu = body[4:]
    if len(asdu) < 6:
        return []

    type_id = asdu[0]
    count   = asdu[1] & 0x7F
    seq     = bool(asdu[1] & 0x80)
    casdu   = asdu[4] | (asdu[5] << 8)
    off     = 6
    rows    = []
    ioa     = 0

    for i in range(count):
        if seq and i > 0:
            ioa += 1
        else:
            if off + 3 > len(asdu): break
            ioa = asdu[off] | (asdu[off+1]<<8) | (asdu[off+2]<<16)
            off += 3

        if type_id in (13, 36):
            if off + 5 > len(asdu): break
            val = struct.unpack("<f", asdu[off:off+4])[0]
            off += 5 + (7 if type_id == 36 and off+5+7 <= len(asdu) else 0)
        elif type_id in (11, 35):
            if off + 3 > len(asdu): break
            val = float(struct.unpack("<h", asdu[off:off+2])[0])
            off += 3 + (7 if type_id == 35 and off+3+7 <= len(asdu) else 0)
        elif type_id in (1, 3, 30, 31):
            if off + 2 > len(asdu): break
            val = float(asdu[off] & (0x01 if type_id in (1,30) else 0x03))
            off += 2 + (7 if type_id in (30,31) and off+2+7 <= len(asdu) else 0)
        else:
            break

        rows.append({
            "ioa": ioa, "type": TYPE_NAMES.get(type_id, str(type_id)),
            "value": round(val, 4), "casdu": casdu,
        })
    return rows


def scan(host, port=PORT, casdu=CASDU):
    state = State()
    rows  = []
    try:
        with socket.create_connection((host, port), timeout=CONNECT_TIMEOUT) as sock:
            sock.settimeout(READ_TIMEOUT)
            sock.sendall(bytes.fromhex("68 04 07 00 00 00"))
            recv_apdu(sock)
            sock.sendall(make_gi(state, casdu))
            while True:
                try:
                    apdu = recv_apdu(sock)
                    rows.extend(parse(apdu, state))
                except socket.timeout:
                    break
        return rows, None
    except Exception as e:
        return [], str(e)


def ip_list(arg=None):
    if arg is None:
        # Mavjud qurilmalar ro'yxati
        import urllib.request, json
        with urllib.request.urlopen("http://localhost:8001/api/devices") as r:
            devs = json.loads(r.read())
        return [(d["iec104_host"], d["iec104_common_address"], d["name"]) for d in devs]
    # bitta IP yoki diapazon
    if "-" in arg.split(".")[-1]:
        prefix = ".".join(arg.split(".")[:3])
        start, end = arg.split(".")[-1].split("-")
        return [(f"{prefix}.{i}", CASDU, "") for i in range(int(start), int(end)+1)]
    return [(arg, CASDU, "")]


def main():
    arg  = sys.argv[1] if len(sys.argv) > 1 else None
    devs = ip_list(arg)
    print(f"Tekshirilayotgan: {len(devs)} ta qurilma\n")

    found_any = False
    for host, casdu, name in devs:
        label = f"{name} ({host})" if name else host
        print(f">>> {label}  CASDU={casdu}")
        rows, err = scan(host, casdu=casdu)
        if err:
            print(f"    [XATO] {err}")
        elif not rows:
            print(f"    [bo'sh] — ma'lumot kelmadi")
        else:
            found_any = True
            # Turlar bo'yicha guruhlash
            analog  = [r for r in rows if r["type"] in ("IEEE_F","SVA","NVA","IEEE_F+T","SVA+T")]
            status  = [r for r in rows if r["type"] in ("SP","DP","SP+T","DP+T")]
            print(f"    {len(rows)} ta signal:  {len(analog)} analog  {len(status)} holat")
            for r in sorted(rows, key=lambda x: x["ioa"]):
                cat = "analog" if r["type"] in ("IEEE_F","SVA","NVA","IEEE_F+T","SVA+T") else "holat"
                print(f"    IOA {r['ioa']:6}  [{r['type']:8}]  {cat:6}  = {r['value']}")
        print()

    if found_any:
        print("=" * 60)
        print("Yuqoridagi IOA raqamlarini import_catalog.py ga kiriting")
        print("keyin: python3 import_catalog.py")


if __name__ == "__main__":
    main()

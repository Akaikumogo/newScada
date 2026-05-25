"""
IEC 104 to'liq skaner.

Har bir IP uchun:
  1) TCP port 2404 tekshiradi
  2) STARTDT yuboradi
  3) Turli CASDU lar bilan GI yuboradi (3, 1, 2, 4, 5 ...)
  4) Spontan ma'lumotni ham eshitadi
  5) Barcha topilgan IOA larni yig'adi

Natija:  scan_result.txt

Foydalanish:
    python full_scan.py
    python full_scan.py 192.168.199.10-32
"""

import socket
import struct
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime

PORT = 2404
CONNECT_TIMEOUT = 4.0
READ_TIMEOUT = 6.0

# Sinab ko'riladigan CASDU lar (tartib bo'yicha)
CASDU_LIST = [3, 1, 2, 4, 5, 10, 20, 50, 100]

TYPE_NAMES = {
    1:   "M_SP_NA_1",   # Single-point
    3:   "M_DP_NA_1",   # Double-point
    9:   "M_ME_NA_1",   # Normalized
    11:  "M_ME_NB_1",   # Scaled
    13:  "M_ME_NC_1",   # IEEE float
    30:  "M_SP_TB_1",   # SP + time
    31:  "M_DP_TB_1",   # DP + time
    34:  "M_ME_TD_1",   # Normalized + time
    35:  "M_ME_TE_1",   # Scaled + time
    36:  "M_ME_TF_1",   # IEEE float + time
    70:  "M_EI_NA_1",   # End of init
    100: "C_IC_NA_1",   # GI command
}

TYPE_SHORT = {
    1: "SP", 3: "DP", 9: "NVA", 11: "SVA", 13: "IEEE_F",
    30: "SP+T", 31: "DP+T", 34: "NVA+T", 35: "SVA+T", 36: "IEEE_F+T",
}

CATEGORY = {
    "SP": "status", "DP": "status", "SP+T": "status", "DP+T": "status",
    "NVA": "analog", "SVA": "analog", "IEEE_F": "analog",
    "NVA+T": "analog", "SVA+T": "analog", "IEEE_F+T": "analog",
}


@dataclass
class ScanResult:
    ip: str
    port: int = PORT
    tcp_open: bool = False
    iec104_ok: bool = False
    working_casdu: int | None = None
    error: str | None = None
    signals: list = field(default_factory=list)  # [{ioa, type, category, value, casdu}]
    raw_notes: list = field(default_factory=list)


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
        raise RuntimeError(f"noto'g'ri start: 0x{s.hex()}")
    ln = recv_exact(sock, 1)[0]
    return s + bytes([ln]) + recv_exact(sock, ln)


def make_gi(state, casdu):
    asdu = bytes([100, 1, 6, 0, casdu & 0xFF, (casdu >> 8) & 0xFF, 0, 0, 0, 20])
    ctrl = struct.pack("<HH", state.send_seq << 1, state.recv_seq << 1)
    state.send_seq += 1
    return bytes([0x68, len(ctrl) + len(asdu)]) + ctrl + asdu


def make_s_frame(recv_seq):
    """S-frame: qabul qilganligimizni tasdiqlash"""
    return bytes([0x68, 0x04, 0x01, 0x00,
                  (recv_seq << 1) & 0xFF, (recv_seq << 1) >> 8 & 0xFF])


def parse_cp56(data):
    """CP56Time2a -> datetime string"""
    if len(data) < 7:
        return ""
    ms = data[0] | (data[1] << 8)
    mi = data[2] & 0x3F
    hr = data[3] & 0x1F
    dy = data[4] & 0x1F
    mo = (data[5] & 0x0F)
    yr = (data[6] & 0x7F) + 2000
    sec = ms // 1000
    msec = ms % 1000
    try:
        return f"{yr:04d}-{mo:02d}-{dy:02d} {hr:02d}:{mi:02d}:{sec:02d}.{msec:03d}"
    except:
        return ""


def parse_asdu(apdu, state):
    """ASDU ni parse qilish -> [{ioa, type_id, type_name, short, category, value, casdu, timestamp}]"""
    body = apdu[2: 2 + apdu[1]]
    if len(body) < 4:
        return [], None

    # U-frame yoki S-frame?
    if body[0] & 1:
        return [], None

    # I-frame
    state.recv_seq = max(state.recv_seq, (struct.unpack("<H", body[:2])[0] >> 1) + 1)
    asdu = body[4:]
    if len(asdu) < 6:
        return [], None

    type_id = asdu[0]
    count = asdu[1] & 0x7F
    sq = bool(asdu[1] & 0x80)
    cot_raw = asdu[2]
    cot = cot_raw & 0x3F
    pn = (cot_raw >> 6) & 1
    casdu = asdu[4] | (asdu[5] << 8)
    off = 6
    rows = []

    # GI actcon/actterm?
    if type_id == 100:
        status = "actcon" if cot == 7 else ("actterm" if cot == 10 else f"cot={cot}")
        status += " OK" if pn == 0 else " NACK"
        return [], {"type": "GI", "status": status, "casdu": casdu}

    # End of init
    if type_id == 70:
        return [], {"type": "M_EI_NA_1", "status": "initialized", "casdu": casdu}

    ioa = 0
    for i in range(count):
        if sq and i > 0:
            ioa += 1
        else:
            if off + 3 > len(asdu):
                break
            ioa = asdu[off] | (asdu[off + 1] << 8) | (asdu[off + 2] << 16)
            off += 3

        val = None
        ts = ""
        short = TYPE_SHORT.get(type_id, str(type_id))

        if type_id in (13, 36):  # IEEE float
            if off + 4 > len(asdu):
                break
            val = struct.unpack("<f", asdu[off:off + 4])[0]
            qds = asdu[off + 4] if off + 5 <= len(asdu) else 0
            off += 5
            if type_id == 36 and off + 7 <= len(asdu):
                ts = parse_cp56(asdu[off:off + 7])
                off += 7
        elif type_id in (11, 35):  # Scaled
            if off + 2 > len(asdu):
                break
            val = float(struct.unpack("<h", asdu[off:off + 2])[0])
            off += 3
            if type_id == 35 and off + 7 <= len(asdu):
                ts = parse_cp56(asdu[off:off + 7])
                off += 7
        elif type_id in (9, 34):  # Normalized
            if off + 2 > len(asdu):
                break
            val = struct.unpack("<h", asdu[off:off + 2])[0] / 32768.0
            off += 3
            if type_id == 34 and off + 7 <= len(asdu):
                ts = parse_cp56(asdu[off:off + 7])
                off += 7
        elif type_id in (1, 30):  # Single-point
            if off + 1 > len(asdu):
                break
            val = float(asdu[off] & 0x01)
            off += 1
            if type_id == 30 and off + 7 <= len(asdu):
                ts = parse_cp56(asdu[off:off + 7])
                off += 7
        elif type_id in (3, 31):  # Double-point
            if off + 1 > len(asdu):
                break
            val = float(asdu[off] & 0x03)
            off += 1
            if type_id == 31 and off + 7 <= len(asdu):
                ts = parse_cp56(asdu[off:off + 7])
                off += 7
        else:
            break

        cat = CATEGORY.get(short, "unknown")
        rows.append({
            "ioa": ioa,
            "type_id": type_id,
            "type_name": TYPE_NAMES.get(type_id, f"type_{type_id}"),
            "short": short,
            "category": cat,
            "value": round(val, 6) if val is not None else None,
            "casdu": casdu,
            "timestamp": ts,
        })

    return rows, None


def scan_device(ip, port=PORT) -> ScanResult:
    """Bitta qurilmani to'liq skanerlash"""
    result = ScanResult(ip=ip, port=port)

    # 1) TCP tekshirish
    try:
        sock = socket.create_connection((ip, port), timeout=CONNECT_TIMEOUT)
        result.tcp_open = True
    except socket.timeout:
        result.error = "TCP timeout"
        return result
    except ConnectionRefusedError:
        result.error = "TCP refused"
        return result
    except OSError as e:
        result.error = f"TCP error: {e}"
        return result

    try:
        sock.settimeout(READ_TIMEOUT)

        # 2) STARTDT
        sock.sendall(bytes.fromhex("6804070000 00".replace(" ", "")))
        try:
            startdt_resp = recv_apdu(sock)
            result.iec104_ok = True
        except Exception as e:
            result.error = f"STARTDT javob kelmadi: {e}"
            sock.close()
            return result

        # 3) Spontan ma'lumot kutish (qisqa)
        sock.settimeout(2.0)
        state = State()
        spontan_signals = []
        try:
            while True:
                apdu = recv_apdu(sock)
                rows, info = parse_asdu(apdu, state)
                spontan_signals.extend(rows)
                if info:
                    result.raw_notes.append(f"Spontan: {info}")
        except socket.timeout:
            pass

        # 4) Turli CASDU bilan GI sinash
        best_casdu = None
        gi_signals = []

        for casdu in CASDU_LIST:
            state2 = State()
            try:
                # Yangi ulanish (har bir CASDU uchun alohida)
                sock.close()
                sock = socket.create_connection((ip, port), timeout=CONNECT_TIMEOUT)
                sock.settimeout(READ_TIMEOUT)

                # STARTDT
                sock.sendall(bytes.fromhex("6804070000 00".replace(" ", "")))
                recv_apdu(sock)

                # Spontan paketlarni o'qib tashlaymiz
                sock.settimeout(1.5)
                try:
                    while True:
                        apdu = recv_apdu(sock)
                        rows, info = parse_asdu(apdu, state2)
                        # Spontan data ham yig'iladi
                        for r in rows:
                            r["casdu"] = casdu
                        spontan_signals.extend(rows)
                except socket.timeout:
                    pass

                # GI yuborish
                sock.settimeout(READ_TIMEOUT)
                sock.sendall(make_gi(state2, casdu))

                # Javob kutish
                casdu_signals = []
                gi_accepted = False
                gi_finished = False

                sock.settimeout(READ_TIMEOUT)
                while not gi_finished:
                    try:
                        apdu = recv_apdu(sock)
                        rows, info = parse_asdu(apdu, state2)

                        if info:
                            if info.get("type") == "GI":
                                if "OK" in info["status"] and "NACK" not in info["status"]:
                                    gi_accepted = True
                                if "actterm" in info["status"]:
                                    gi_finished = True
                            result.raw_notes.append(f"CASDU={casdu}: {info}")

                        casdu_signals.extend(rows)

                        # S-frame yuborish (ACK)
                        if state2.recv_seq > 0 and state2.recv_seq % 8 == 0:
                            sock.sendall(make_s_frame(state2.recv_seq))

                    except socket.timeout:
                        gi_finished = True
                    except ConnectionError:
                        gi_finished = True

                if casdu_signals:
                    if not best_casdu or len(casdu_signals) > len(gi_signals):
                        best_casdu = casdu
                        gi_signals = casdu_signals
                    # Topilsa keyingisiga o'tish shart emas
                    break

                if gi_accepted:
                    best_casdu = casdu
                    break

            except (ConnectionError, ConnectionRefusedError, OSError):
                continue
            except Exception as e:
                result.raw_notes.append(f"CASDU={casdu}: xato - {e}")
                continue

        # 5) Natijalarni birlashtirish
        all_signals = {}
        for sig in spontan_signals + gi_signals:
            key = sig["ioa"]
            if key not in all_signals or sig.get("timestamp"):
                all_signals[key] = sig
            # Eng katta (abs) qiymatni saqlash
            elif abs(sig.get("value", 0) or 0) > abs(all_signals[key].get("value", 0) or 0):
                all_signals[key] = sig

        result.signals = sorted(all_signals.values(), key=lambda x: x["ioa"])
        result.working_casdu = best_casdu if best_casdu else (3 if result.iec104_ok else None)

    except Exception as e:
        result.error = f"Umumiy xato: {e}"
    finally:
        try:
            sock.close()
        except:
            pass

    return result


def ip_list(arg=None):
    """IP ro'yxatini olish"""
    if arg is None:
        import urllib.request, json
        try:
            with urllib.request.urlopen("http://localhost:8001/api/devices") as r:
                devs = json.loads(r.read())
            return [(d["iec104_host"], d["name"]) for d in devs]
        except:
            print("Backend ishlamayapti, IP diapazonini bering")
            sys.exit(1)

    if "-" in arg.split(".")[-1]:
        prefix = ".".join(arg.split(".")[:3])
        start, end = arg.split(".")[-1].split("-")
        return [(f"{prefix}.{i}", "") for i in range(int(start), int(end) + 1)]

    return [(arg, "")]


def format_results(results: list[ScanResult]) -> str:
    """Natijalarni txt formatga aylantirish"""
    lines = []
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines.append("=" * 70)
    lines.append(f"  IEC 104 TO'LIQ SKAN NATIJASI")
    lines.append(f"  Sana: {now}")
    lines.append(f"  Qurilmalar soni: {len(results)}")
    lines.append("=" * 70)
    lines.append("")

    # Umumiy statistika
    tcp_ok = sum(1 for r in results if r.tcp_open)
    iec_ok = sum(1 for r in results if r.iec104_ok)
    has_data = sum(1 for r in results if r.signals)
    lines.append(f"  TCP ochiq:      {tcp_ok} / {len(results)}")
    lines.append(f"  IEC 104 javob:  {iec_ok} / {len(results)}")
    lines.append(f"  Ma'lumot bor:   {has_data} / {len(results)}")
    lines.append("")
    lines.append("-" * 70)

    for res in results:
        lines.append("")
        label = f"{res.ip}:{res.port}"
        lines.append(f">>> {label}")

        if not res.tcp_open:
            lines.append(f"    TCP:     YOPIQ ({res.error})")
            lines.append(f"    IEC104:  -")
            lines.append(f"    Signal:  -")
            continue

        lines.append(f"    TCP:     OCHIQ")

        if not res.iec104_ok:
            lines.append(f"    IEC104:  XATO ({res.error})")
            lines.append(f"    Signal:  -")
            continue

        lines.append(f"    IEC104:  OK")
        lines.append(f"    CASDU:   {res.working_casdu or '?'}")

        if not res.signals:
            lines.append(f"    Signal:  0 ta (ma'lumot kelmadi)")
            if res.error:
                lines.append(f"    Izoh:    {res.error}")
        else:
            analog = [s for s in res.signals if s["category"] == "analog"]
            status = [s for s in res.signals if s["category"] == "status"]
            lines.append(f"    Signal:  {len(res.signals)} ta ({len(analog)} analog, {len(status)} holat)")
            lines.append("")
            lines.append(f"    {'IOA':>8}  {'Tur':<12} {'Kategoriya':<10} {'Qiymat':<14} {'Vaqt'}")
            lines.append(f"    {'---':>8}  {'---':<12} {'---':<10} {'---':<14} {'---'}")

            for sig in res.signals:
                val_str = f"{sig['value']}" if sig["value"] is not None else "-"
                ts_str = sig.get("timestamp", "") or ""
                lines.append(
                    f"    {sig['ioa']:>8}  {sig['short']:<12} {sig['category']:<10} {val_str:<14} {ts_str}"
                )

        lines.append("")

    # IOA xulosa jadvali
    lines.append("")
    lines.append("=" * 70)
    lines.append("  IOA XULOSA JADVALI (faqat ma'lumot bor qurilmalar)")
    lines.append("=" * 70)

    for res in results:
        if not res.signals:
            continue
        lines.append(f"\n  {res.ip} (CASDU={res.working_casdu}):")
        for sig in res.signals:
            val_str = f"{sig['value']}" if sig['value'] is not None else "-"
            lines.append(f"    IOA {sig['ioa']:>6}  {sig['short']:<10}  {sig['category']:<8}  = {val_str}")

    # import_catalog.py uchun shablon
    lines.append("")
    lines.append("=" * 70)
    lines.append("  KATALOG SHABLONI (import_catalog.py uchun)")
    lines.append("=" * 70)
    lines.append("")

    all_ioas = {}
    for res in results:
        for sig in res.signals:
            key = sig["ioa"]
            if key not in all_ioas:
                all_ioas[key] = sig

    if all_ioas:
        lines.append("ANALOG_POINTS = {")
        for ioa, sig in sorted(all_ioas.items()):
            if sig["category"] == "analog":
                val_str = f"{sig['value']}" if sig['value'] is not None else "?"
                lines.append(
                    f'    {ioa}: {{"code": "ioa_{ioa}", "title": "IOA {ioa} ({sig["short"]}, qiymat={val_str})", "unit": ""}},'
                )
        lines.append("}")
        lines.append("")
        lines.append("STATUS_POINTS = {")
        for ioa, sig in sorted(all_ioas.items()):
            if sig["category"] == "status":
                val_str = f"{sig['value']}" if sig['value'] is not None else "?"
                lines.append(
                    f'    {ioa}: {{"code": "ts_{ioa}", "title": "IOA {ioa} ({sig["short"]}, qiymat={val_str})", "unit": ""}},'
                )
        lines.append("}")

    lines.append("")
    lines.append("=" * 70)
    lines.append(f"  Skan tugadi: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("=" * 70)

    return "\n".join(lines)


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    devs = ip_list(arg)

    print(f"IEC 104 to'liq skan boshlandi: {len(devs)} ta qurilma")
    print(f"Har bir qurilma uchun {len(CASDU_LIST)} ta CASDU sinab ko'riladi")
    print()

    results = []
    for i, (ip, name) in enumerate(devs, 1):
        label = f"{name} ({ip})" if name else ip
        print(f"[{i}/{len(devs)}] {label} ...", end=" ", flush=True)

        res = scan_device(ip)
        results.append(res)

        if not res.tcp_open:
            print("YOPIQ")
        elif res.signals:
            print(f"{len(res.signals)} ta signal topildi!")
        else:
            print("signal yo'q")

    # Natijani faylga yozish
    output = format_results(results)
    out_path = "scan_result.txt"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(output)

    print()
    print(f"Natija saqlandi: {out_path}")
    print()

    # Qisqa xulosa
    has_data = [r for r in results if r.signals]
    print(f"Jami: {len(results)} ta qurilma")
    print(f"  TCP ochiq:   {sum(1 for r in results if r.tcp_open)}")
    print(f"  IEC104 OK:   {sum(1 for r in results if r.iec104_ok)}")
    print(f"  Signal bor:  {len(has_data)}")

    if has_data:
        print()
        for r in has_data:
            a = sum(1 for s in r.signals if s["category"] == "analog")
            st = sum(1 for s in r.signals if s["category"] == "status")
            print(f"  {r.ip}: {len(r.signals)} signal ({a} analog, {st} holat), CASDU={r.working_casdu}")


if __name__ == "__main__":
    main()

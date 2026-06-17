# -*- coding: utf-8 -*-
"""
Yunusobod qurilmalarining signal_name'larini kanoniklashtirish.

ai_644 -> P, ai_645 -> Q, ai_641 -> IA ...  (signal_title prefiksidan, masalan
"P: P, кВт | L-Savdo-35 kV | IOA 644" -> "P").  Balansga ta'sir qilmaydi
(balans IOA orqali ishlaydi), faqat sxema/o'qish uchun toza nomlar.

Idempotent: qayta ishga tushirish xavfsiz. Faqat REST API (PUT /signals/{id}).
"""
import json
import re
import urllib.request

BASE = "http://localhost:8000/api"
SUB_MATCH = "unus"   # substation name substring

# IOA fallback (standart BMRZ-152 analog blok) — title prefiksi bo'lmaganda
IOA_FALLBACK = {
    641: "IA", 642: "IC", 643: "IB", 644: "P", 645: "Q", 646: "S",
    647: "cos", 648: "freq", 649: "UA", 650: "UB", 651: "UC",
    652: "UAB", 653: "UBC", 654: "UCA",
    1921: "Ktr_IA", 1922: "Ktr_IB", 1923: "Ktr_IC", 1924: "Ktr_3I0",
    1925: "Ktr_UAB", 1926: "Ktr_UBC", 1927: "Ktr_3U0", 1928: "Ktr_UBC2",
}
# faqat shu IP lar uchun IOA_FALLBACK qo'llanadi (P/Q li 15 qurilma + ularning ulushi)
PQ_OCTETS = {10, 11, 12, 13, 14, 15, 24, 25, 26, 27, 28, 29, 30, 31, 32}


def _get(url):
    return json.load(urllib.request.urlopen(url, timeout=10))


def _put(url, data):
    req = urllib.request.Request(
        url, data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"}, method="PUT")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def canon_from_title(title: str):
    if not title:
        return None
    m = re.match(r'^\s*([A-Za-z][A-Za-z0-9_]*)\s*:', title)
    if not m:
        return None
    name = m.group(1)
    if name.upper() in ("COS", "FREQ"):
        name = name.lower()
    return name


def octet(host):
    try:
        return int(host.split(".")[-1])
    except Exception:
        return None


def main():
    subs = _get(f"{BASE}/substations?limit=100")["items"]
    sub = next(s for s in subs if SUB_MATCH in s["name"].lower())
    print(f"Substation: id={sub['id']}  {sub['name']}")

    devices = [d for d in _get(f"{BASE}/devices?limit=200")["items"]
               if d["substation_id"] == sub["id"]]
    print(f"Devices: {len(devices)}")

    total_changed = total_skipped = total_kept = 0
    for d in devices:
        sigs = _get(f"{BASE}/signals?device_id={d['id']}&limit=400")
        sigs = sigs["items"] if isinstance(sigs, dict) else sigs
        oc = octet(d["iec104_host"])
        used = set()
        changes = []
        # birinchi: maqsad nomlarni hisobla
        for s in sorted(sigs, key=lambda x: x["register_code"]):
            cur = s["signal_name"]
            cand = canon_from_title(s.get("signal_title"))
            if cand is None and oc in PQ_OCTETS:
                cand = IOA_FALLBACK.get(s["register_code"])
            if cand is None:
                cand = cur  # tegmaymiz (monitoring/noaniq)
            # dedup per device
            base = cand
            if cand in used and cand != cur:
                cand = f"{base}_{s['register_code']}"
            if cand in used:
                cand = f"{base}_{s['register_code']}"
            used.add(cand)
            if cand != cur:
                changes.append((s["id"], cur, cand, s["register_code"]))

        for sid, cur, new, ioa in changes:
            try:
                _put(f"{BASE}/signals/{sid}", {"signal_name": new})
                total_changed += 1
            except Exception as e:
                print(f"  ! dev {d['id']} ioa {ioa}: {cur}->{new} FAILED {e}")
                total_skipped += 1
        kept = len(sigs) - len(changes)
        total_kept += kept
        print(f"  dev {d['id']:>3} {d['iec104_host']:<16} changed={len(changes):>2} kept={kept:>2}")

    print(f"\nDONE  changed={total_changed}  kept={total_kept}  failed={total_skipped}")


if __name__ == "__main__":
    main()

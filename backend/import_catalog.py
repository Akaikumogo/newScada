"""
BMRZ-152 signal katalogini DB ga import qilish skripti.

Foydalanish:
  1. ANALOG_POINTS va STATUS_POINTS ni to'ldiring
     (boshqa loyihadan nusxalasangiz bo'ladi)
  2. MODEL_ID ni tekshiring (default: 1 = BMRZ 152)
  3. Backend ishga tushgan holda:
       python3 import_catalog.py

Qayta ishlatish xavfsiz — mavjud IOAlar o'tkazib yuboriladi.
"""

import json
import urllib.request

BASE     = "http://localhost:8001/api"
MODEL_ID = 1   # BMRZ 152

# ── Shu yerga boshqa loyihadan nusxalang ─────────

ANALOG_POINTS: dict[int, dict] = {
    # Oqim o'lchagichlari (MMXU.A)
    641: {"code": "ia",    "title": "I(a) faza toki",   "unit": "A"},
    642: {"code": "ib",    "title": "I(b) faza toki",   "unit": "A"},
    643: {"code": "ic",    "title": "I(c) faza toki",   "unit": "A"},
    # Kuchlanish / quvvat o'lchagichlari (IOA 1921-1928)
    # Aniq nomlar Konfigurator-MT dan olinadi
    1921: {"code": "analog_1921", "title": "Analog 1921 (= 80.0)",  "unit": ""},
    1922: {"code": "analog_1922", "title": "Analog 1922 (= 80.0)",  "unit": ""},
    1923: {"code": "analog_1923", "title": "Analog 1923 (= 80.0)",  "unit": ""},
    1924: {"code": "analog_1924", "title": "Analog 1924 (= 1.0)",   "unit": ""},
    1925: {"code": "analog_1925", "title": "Analog 1925 (= 350.0)", "unit": ""},
    1926: {"code": "analog_1926", "title": "Analog 1926 (= 350.0)", "unit": ""},
    1927: {"code": "analog_1927", "title": "Analog 1927 (= 1.0)",   "unit": ""},
    1928: {"code": "analog_1928", "title": "Analog 1928 (= 350.0)", "unit": ""},
}

STATUS_POINTS: dict[int, dict] = {
    1: {"code": "ts_1", "title": "Holat signali 1",  "unit": ""},
    2: {"code": "ts_2", "title": "Holat signali 2",  "unit": ""},
}

# ─────────────────────────────────────────────────


def _post(url: str, data: dict) -> dict:
    body = json.dumps(data).encode()
    req  = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def build_payload() -> list[dict]:
    payload = []
    for ioa, item in ANALOG_POINTS.items():
        payload.append({
            "register_code": ioa,
            "signal_name":   item["code"],
            "signal_title":  item.get("title"),
            "unit":          item.get("unit", ""),
            "value_type":    "float",
        })
    for ioa, item in STATUS_POINTS.items():
        payload.append({
            "register_code": ioa,
            "signal_name":   item["code"],
            "signal_title":  item.get("title"),
            "unit":          item.get("unit", ""),
            "value_type":    "status",
        })
    return payload


def main() -> None:
    payload = build_payload()
    print(f"Jami yuklash: {len(payload)} ta signal  ->  model_id={MODEL_ID}")

    url    = f"{BASE}/device-models/{MODEL_ID}/signals/bulk"
    result = _post(url, payload)

    print(f"  Qo'shildi : {result['applied']} ta")
    print(f"  O'tkazildi: {result['skipped']} ta (allaqachon mavjud)")
    print()
    print("Endi 'Barcha qurilmalarga qo'lla' uchun:")
    print(f"  curl -X POST {BASE}/device-models/{MODEL_ID}/apply-all")


if __name__ == "__main__":
    main()

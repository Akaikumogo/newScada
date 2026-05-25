---
type: feature
feature_id: "F08"
title: "History Recording"
status: planned
priority: 1
tags: [feature, backend, collector, database]
created: 2026-05-24
related: ["[[ADR/ADR-004 Change-only Recording]]", "[[ADR/ADR-005 Redis Cache]]", "[[Architecture/DB Strategy]]"]
---

# F08 · History Recording — Tarix yozish mantiq'i

## Maqsad
IEC104 dan kelgan qiymatlarni faqat o'zganganda DB ga yozish — DB joyini tejash va keraksiz yozuvlarni kamaytirish.

## Mohiyat
Collector har polling siklida yangi qiymatni oldingi (cache da saqlangan) qiymat bilan solishtiradi. Agar farq bo'lsa — yozadi, bo'lmasa — o'tkazib yuboradi.

## Nimaga kerak
- Yirik tizimda har 2 soniyada barcha signallarni yozish — DB ni tez to'ldiradi
- Aksariyat signallar uzoq vaqt o'zgarmaydi (masalan: kechasi tok = 0)
- O'zgarish nuqtalari — operatorlar uchun eng muhim ma'lumot

## Qanday ishlaydi

```
Collector loop (har 2 soniya):
  1. IEC104 dan barcha signallar keladi
  2. Har bir signal uchun:
     a) cache[device_id][signal_name] = oxirgi yozilgan qiymat
     b) Yangi qiymat ≠ cache qiymati?
        → Ha: record ga yoz, cache ni yangilash
        → Yo'q: o'tkazib yubor
  3. Cache xotira (Python dict) — dastur qayta ishga tushsa tozalanadi
     → Keyingi birinchi qiymat doim yoziladi (bu to'g'ri xulq)
```

### Epsilon solishtirish (float uchun)
```python
EPSILON = 0.001  # 0.001 A farq ahamiyatsiz

def has_changed(old: float, new: float) -> bool:
    if old is None:
        return True
    return abs(new - old) > EPSILON
```

### Status signal uchun
```python
def has_changed(old: float, new: float) -> bool:
    return old != new  # 0 va 1 — aniq solishtirish
```

---

## Misol

| Vaqt  | IOA 641 | Kelgan | Cache | Yozildimi? |
|-------|---------|--------|-------|------------|
| 12:00 | ia      | 245.3  | None  | ✅ Ha      |
| 12:02 | ia      | 245.3  | 245.3 | ❌ Yo'q    |
| 12:04 | ia      | 245.4  | 245.3 | ❌ Yo'q (epsilon) |
| 12:06 | ia      | 246.1  | 245.3 | ✅ Ha      |
| 12:30 | ia      | 0.0    | 246.1 | ✅ Ha      |

---

## DB yozuvi

```sql
record (
  id          SERIAL PRIMARY KEY,
  device_id   INT NOT NULL,         -- faqat shu, ierarxiya JOIN orqali
  signal_name VARCHAR(64) NOT NULL,
  value       FLOAT NOT NULL,
  quality     INT DEFAULT 0,
  captured_at TIMESTAMP NOT NULL    -- UTC
)
```

### Ierarxiya JOIN misoli
```sql
SELECT
  b.name  AS branch,
  s.name  AS substation,
  d.name  AS device,
  r.signal_name,
  r.value,
  r.captured_at
FROM record r
JOIN device    d ON d.id = r.device_id
JOIN substation s ON s.id = d.substation_id
JOIN branch    b ON b.id = s.branch_id
WHERE r.device_id = 5
ORDER BY r.captured_at DESC
LIMIT 300;
```

---

## Ulanish holati

```python
# Muvaffaqiyatli poll:
cache.set_status(device_id, online=True, "received N points")

# Xato (timeout, connection refused...):
cache.set_status(device_id, online=False, str(exception))
# record YOZILMAYDI — faqat holat yangilanadi
```

---

## Shartlar
- Cache xotiradan boshqa hech qayerda saqlanmaydi (DB ga yozilmaydi)
- Dastur qayta ishga tushsa: birinchi qiymat doim yoziladi
- `quality != 0` bo'lsa ham yoziladi (lekin dispatcher unda sariq rang ko'rsatadi)
- Null / NaN kelsa: yozilmaydi, log yoziladi

---

## Bog'liq
- [[F05 - IEC104 Signal Config]] — collector signal konfigdan o'qiydi
- [[06 - IEC104 Config]] — protokol texnik tafsilotlari
- [[F07 - Dispatcher View]] — tarix dispatcher da ko'rsatiladi

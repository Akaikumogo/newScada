---
type: feature
feature_id: "F05"
title: "IEC104 Signal Config"
status: planned
priority: 1
tags: [feature, backend, iec104]
created: 2026-05-24
related: ["[[features/F03 - Device Management]]", "[[features/F08 - History Recording]]", "[[Technical/IEC104 Deep Dive]]"]
---

# F05 · IEC104 Signal Config — Signal konfiguratsiyasi

## Maqsad
Har bir qurilma uchun IEC104 dan qaysi IOA (register) ni qanday nom bilan saqlashni sozlash.

## Mohiyat
Collector eski tizimda `signal_catalog.py` dan o'qirdi — bu hardcode edi. Yangi tizimda har bir qurilmaning signallari `device_signal` jadvalida saqlanadi va collector DB dan o'qiydi. Demak yangi qurilma qo'shilganda kod o'zgarmaydi.

## Nimaga kerak
- Har bir qurilma turli IOA lardan ma'lumot olishi mumkin
- Dinamik konfiguratsiya: kod yozmasdan yangi signal qo'shish
- Collector universal bo'lsin: DB dan o'qisin

## Qanday ishlaydi

```
Foydalanuvchi:
  1. Qurilma sahifasidan "Signallar" tugmasini bosadi
  2. "Signal qo'shish" → modal
  3. Modal maydonlari:
     - register_code: IOA raqami (641 kabi)
     - signal_name: kod nomi (ia, ib, ic kabi)
     - signal_title: to'liq nomi (I(a) B-B-A-2)
     - unit: birlik (A, kV, kW...)
     - value_type: float | status
  4. Saqlaydi → device_signal jadvaliga yoziladi

Collector:
  1. DB dan barcha device_signal larni o'qiydi
  2. IEC104 so'rovi yuboradi
  3. Kelgan IOA → device_signal da qidiradi
  4. Topilsa → record ga yozadi (o'zgansa)
```

## Shartlar
- register_code musbat butun son bo'lishi kerak
- signal_name bo'sh bo'lmasligi kerak
- Bir qurilmada bir xil register_code takrorlanmasligi kerak
- value_type: faqat 'float' yoki 'status'

## DB
```sql
device_signal (
  id             SERIAL PRIMARY KEY,
  device_id      INT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  register_code  INT NOT NULL,
  signal_name    VARCHAR(64) NOT NULL,
  signal_title   VARCHAR(160),
  unit           VARCHAR(24) NOT NULL DEFAULT '',
  value_type     VARCHAR(32) NOT NULL DEFAULT 'float'

  UNIQUE(device_id, register_code)
)
```

## API
```
GET    /api/devices/:id/signals
POST   /api/devices/:id/signals   { register_code, signal_name, signal_title, unit, value_type }
PUT    /api/signals/:id           { signal_name, signal_title, unit, value_type }
DELETE /api/signals/:id
```

## UI
- Jadval: IOA | Signal kodi | Nomi | Birlik | Turi | Amallar
- Modal: 5 ta maydon

## Bog'liq
- [[F03 - Device Management]] — device_id
- [[F08 - History Recording]] — collector shu konfigdan o'qiydi
- [[06 - IEC104 Config]] — protokol texnik tafsilotlari

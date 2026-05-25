---
type: feature
feature_id: "F03"
title: "Device Management"
status: planned
priority: 1
tags: [feature, backend, editor]
created: 2026-05-24
related: ["[[features/F02 - Substation Management]]", "[[features/F04 - Model Catalog]]", "[[features/F05 - IEC104 Signal Config]]"]
---

# F03 · Device Management — Qurilma boshqaruvi

## Maqsad
Podstansiyaga joylashgan fizik qurilmalarni (BMRZ, relay, o'lchov asboblari) ro'yxatga olish va sozlash.

## Mohiyat
Qurilma — tarmoqda o'z **IP manzili** bo'lgan va IEC104 orqali ma'lumot uzatuvchi fizik asbob (BMRZ, relay va boshqalar). Har bir qurilmaga: model, IP:port, CASDU va signal ro'yxati biriktiriladi. Collector shu IP ga TCP ulanib ma'lumot oladi.

## Nimaga kerak
- IEC104 collector qaysi qurilmadan nima o'qishini bilishi uchun
- Dispatcherda qurilma darajasida ko'rish uchun
- Sxemada qurilma bloki sifatida joylashishi uchun
- Tarixni qurilma bo'yicha saqlash uchun

## Qanday ishlaydi

```
Foydalanuvchi:
  1. Podstansiya sahifasidan "Qurilmalar" bo'limiga kiradi
  2. "Yangi qurilma" → modal
  3. Modal maydonlari:
     - Nomi (masalan: BMRZ-153 №1)
     - Model → SELECT (device_model katalogidan)
     - Protokol → SELECT (hozircha faqat "IEC104")
     - IEC104 Host (masalan: 192.168.199.10)
     - IEC104 Port (default: 2404)
     - CASDU / Common Address (default: 1)
     - Poll interval, soniya (default: 2.0)
  4. Saqlaydi → device jadvaliga yoziladi
  5. Qurilma qatoridan → "Signallar" tugmasi → IEC104 sozlash
```

## Shartlar
- Nomi bo'sh bo'lmasligi kerak
- Model tanlash majburiy
- Protokol tanlash majburiy (hozircha faqat IEC104)
- `iec104_host` — to'g'ri IP format bo'lishi kerak (IPv4: `x.x.x.x`)
- `iec104_port` — 1–65535 oralig'ida bo'lishi kerak
- `iec104_common_address` — 1–65535 oralig'ida bo'lishi kerak
- `poll_interval_seconds` — 1.0 dan kam bo'lmasligi kerak
- O'chirishda: bog'liq signallar va recordlar haqida ogohlantirish

## DB
```sql
device (
  id, substation_id, model_id, name,
  protocol,                        -- 'iec104'
  iec104_host,                     -- masalan: '192.168.199.10'
  iec104_port,                     -- masalan: 2404
  iec104_common_address,           -- masalan: 3
  poll_interval_seconds,           -- masalan: 2.0
  created_at
)
```

## API
```
GET    /api/devices?substation_id=
POST   /api/devices       { substation_id, model_id, name, protocol }
PUT    /api/devices/:id   { name, model_id, protocol }
DELETE /api/devices/:id
```

## UI
- Jadval: Nomi | Modeli | Protokol | Signallar soni | Amallar
- Amallar: Tahrirlash | O'chirish | Signallar
- Model select: `device_model` dan keladi
- Protokol select: `['IEC104']` — backend dan statik

## Bog'liq
- [[F02 - Substation Management]] — substation_id
- [[F04 - Model Catalog]] — model_id
- [[F05 - IEC104 Signal Config]] — signallar shu yerda
- [[F06 - Schema Editor]] — sxemada blok sifatida ko'rinadi

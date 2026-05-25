---
type: feature
feature_id: "F02"
title: "Substation Management"
status: planned
priority: 1
tags: [feature, backend, editor]
created: 2026-05-24
related: ["[[features/F01 - Branch Management]]", "[[features/F06 - Schema Editor]]"]
---

# F02 · Substation Management — Podstansiya boshqaruvi

## Maqsad
Filiallarga bog'liq podstansiyalarni yaratish va boshqarish. Qurilmalar va sxema shu darajada joylashadi.

## Mohiyat
Podstansiya — real elektr qurilmasi joylashgan fizik ob'ekt. Har bir podstansiyada bir yoki ko'p qurilma bo'ladi va unga bitta sxema chiziladi.

## Nimaga kerak
- Qurilmalarni joylashtirish uchun konteyner
- Sxema chizishning asosi (har bir sxema bitta podstansiyaga tegishli)
- Dispatcherda podstansiya darajasida ko'rish

## Qanday ishlaydi

```
Foydalanuvchi:
  1. Editor → Filial sahifasidan "Podstansiyalar" ga o'tadi
  2. "Yangi podstansiya" tugmasi → modal
  3. Modal: Nomi + Manzili + Filial (auto-tanlanadi)
  4. Saqlaydi → substation jadvaliga yoziladi
  5. Yaratilgan podstansiyadan → Qurilmalar va Sxema bo'limlari ochiladi
```

## Shartlar
- Nomi bo'sh bo'lmasligi kerak
- Filial tanlanishi shart
- O'chirishda: bog'liq qurilmalar bo'lsa ogohlantirish
- Har bir podstansiyaning o'z sxemasi bor (bitta yoki nol)

## DB
```sql
substation (id, branch_id, name, address, created_at)
substation_schema (id, substation_id, canvas_json, updated_at)
```

## API
```
GET    /api/substations?branch_id=
POST   /api/substations           { branch_id, name, address }
PUT    /api/substations/:id       { name, address }
DELETE /api/substations/:id

GET    /api/substations/:id/schema
PUT    /api/substations/:id/schema   { canvas_json }
```

## UI
- Jadval: Nomi | Manzili | Qurilmalar soni | Sxema holati | Amallar
- Amallar: Tahrirlash | O'chirish | Qurilmalar | Sxema
- Sxema tugmasi → Schema Editor sahifasiga o'tadi

## Bog'liq
- [[F01 - Branch Management]] — branch_id
- [[F03 - Device Management]] — qurilmalar shu yerda
- [[F06 - Schema Editor]] — sxema shu podstansiyaga tegishli

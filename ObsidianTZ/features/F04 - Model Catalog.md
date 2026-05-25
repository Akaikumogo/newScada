---
type: feature
feature_id: "F04"
title: "Model Catalog"
status: planned
priority: 2
tags: [feature, backend, editor]
created: 2026-05-24
related: ["[[features/F03 - Device Management]]"]
---

# F04 · Model Catalog — Qurilma modeli katalogi

## Maqsad
Tizimda ishlatilayotgan qurilma turlarini markazlashgan holda boshqarish.

## Mohiyat
Model — qurilmaning texnik turi. Bir xil model bir nechta qurilmada ishlatilishi mumkin. Masalan: "BMRZ-153" modeli uchun 5 ta qurilma bo'lishi mumkin.

## Nimaga kerak
- Qurilma yaratishda takroriy ma'lumot yozmaslik
- Kelajakda model bo'yicha filter va hisobot qilish
- Foydalanuvchiga tanish qurilma nomlarini tezda tanlash imkoni

## Qanday ishlaydi

```
Foydalanuvchi:
  1. Editor → "Modellar" sahifasiga kiradi
  2. "Yangi model" → modal
  3. Modal: Nomi + Ishlab chiqaruvchi + Tavsif (ixtiyoriy)
  4. Saqlaydi → device_model jadvaliga yoziladi
  5. Endi qurilma yaratishda bu model SELECT da ko'rinadi
```

## Shartlar
- Nomi bo'sh bo'lmasligi kerak
- Bir xil nom + ishlab chiqaruvchi kombinatsiyasi takrorlanmasligi kerak
- O'chirishda: qurilmalarda ishlatilsa ogohlantirish

## DB
```sql
device_model (id, name, manufacturer, description, created_at)
```

## API
```
GET    /api/models
POST   /api/models       { name, manufacturer, description }
PUT    /api/models/:id   { name, manufacturer, description }
DELETE /api/models/:id
```

## UI
- Jadval: Nomi | Ishlab chiqaruvchi | Tavsif | Qurilmalar soni | Amallar
- Modal: 3 ta maydon
- Qurilma yaratish modalida: model select (qidiruv bilan)

## Bog'liq
- [[F03 - Device Management]] — device.model_id → device_model.id

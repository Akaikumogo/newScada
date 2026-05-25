---
type: feature
feature_id: "F01"
title: "Branch Management"
status: planned
priority: 1
tags: [feature, backend, editor]
created: 2026-05-24
related: ["[[features/F02 - Substation Management]]"]
---

# F01 · Branch Management — Filial boshqaruvi

## Maqsad
Tizimning eng yuqori darajali tuzilmaviy birligini boshqarish. Barcha podstansiyalar biror filiallga tegishli bo'ladi.

## Mohiyat
Filial — geografik yoki ma'muriy bo'linma. Bosh boshqarma ham tizimda filial sifatida mavjud bo'ladi, faqat `type = 'bosh_boshqarma'` bilan farq qiladi.

## Nimaga kerak
- Katta tarmoqlarda podstansiyalarni guruhlash
- Dispatcherda filial bo'yicha ko'rish imkoni
- Huquqlar keyinchalik filial bo'yicha ajratilishi mumkin

## Qanday ishlaydi

```
Foydalanuvchi:
  1. Editor → "Filiallar" sahifasiga kiradi
  2. "Yangi filial" tugmasiga bosadi
  3. Modal ochiladi: Nomi + Turi (filial / bosh_boshqarma)
  4. Saqlaydi → branch jadvaliga yoziladi
  5. Ro'yxatda yangi qator paydo bo'ladi
```

## Shartlar
- Filial nomi bo'sh bo'lmasligi kerak
- O'chirishdan oldin: bog'liq podstansiya yo'qligini tekshirish
- Bosh boshqarma bitta bo'lishi tavsiya etiladi (lekin cheklov qo'yilmaydi)

## DB
```sql
branch (id, name, type, created_at)
type: 'filial' | 'bosh_boshqarma'
```

## API
```
GET    /api/branches
POST   /api/branches        { name, type }
PUT    /api/branches/:id    { name, type }
DELETE /api/branches/:id
```

## UI
- Jadval: ID | Nomi | Turi | Podstansiyalar soni | Amallar
- Modal: 2 ta maydon (nomi, turi select)
- O'chirishda confirm dialog

## Bog'liq
- [[F02 - Substation Management]] — har bir substation branch_id ga ega

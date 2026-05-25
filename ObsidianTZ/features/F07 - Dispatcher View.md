---
type: feature
feature_id: "F07"
title: "Dispatcher View"
status: planned
priority: 2
tags: [feature, frontend, dispatcher, websocket]
created: 2026-05-24
related: ["[[Architecture/WebSocket Strategy]]", "[[features/F06 - Schema Editor]]", "[[features/F08 - History Recording]]"]
---

# F07 · Dispatcher View — Operator ko'rinishi

## Maqsad
Elektr tarmoq operatorlari uchun real-vaqt monitoring paneli. Faqat o'qish rejimi — hech qanday o'zgartirish yo'q.

## Mohiyat
Dispatcher — alohida sayt (yoki tab). Operator bunga kiradi va barcha podstansiyalar, qurilmalar, signallar holatini ko'radi. Sxemani ham ko'radi — uning ustida real-vaqt qiymatlar yangilanib turadi.

## Nimaga kerak
- Operatorlar konfiguratsiyaga kirmasligi kerak
- Oddiylashtirilgan, tezkor monitoring interfeysi
- Sxema + metrik kartalar bir joyda

## Qanday ishlaydi

```
Operator:
  1. Dispatcher saytini ochadi
  2. Barcha filiallar ko'rinadi (kartochkalar)
  3. Filialni bosadi → podstansiyalar ro'yxati
  4. Podstansiyani bosadi → 2 xil ko'rinish:
     a) Dashboard: MetricCard + TrendChart + jadval
     b) Sxema: podstansiya chizmasi + real-vaqt qiymatlar
  5. Qiymatlar har 2 soniyada avtomatik yangilanadi
```

## Sahifalar tuzilmasi

### `/` — Bosh sahifa
- Barcha filiallar kartochkasi grid ko'rinishda
- Har bir kartochkada: Nomi, podstansiyalar soni, umumiy holat (online/offline)

### `/branch/:id` — Filial sahifasi
- Filial nomi sarlavhada
- Podstansiyalar ro'yxati (kartochkalar)
- Har bir kartochkada: nomi, qurilmalar soni, holat indikatori

### `/substation/:id` — Podstansiya sahifasi
**2 tab:**
- **Dashboard tab**: barcha qurilmalar MetricCard grid
- **Sxema tab**: Schema Editor ning read-only ko'rinishi

### `/device/:id` — Qurilma sahifasi
- Sarlavha: qurilma nomi + model + podstansiya (breadcrumb)
- MetricCard × signallar soni
- TrendChart (3 ta yonma-yon)
- Xronologiya (virtual scroll jadval) — Jonli/Kunlik/Haftalik/Oylik/Yillik tablar

---

## Sxema read-only ko'rinish
- Sxema muharrir yo'q
- Drag yo'q, tanlash yo'q
- Signal Display widgetlari real-vaqt qiymatlarni ko'rsatadi
- Qiymat ranglanadi: yashil (normal), sariq (ogohlantirish), qizil (xato)
- IEC104 holati (online/offline) sxema ustida ko'rsatiladi

---

## Auto-refresh
- `/api/telemetry/latest` → har 2 soniya (TanStack Query `refetchInterval`)
- Ulanish uzilsa: "Aloqa yo'q" banner chiqadi
- Tiklanganda avtomatik davom etadi

---

## IEC104 holati
- Har sahifada yuqori o'ngda: `● ONLINE` (yashil) yoki `● OFFLINE` (qizil)
- Oxirgi yangilanish vaqti ko'rsatiladi

---

## Shartlar
- Hech qanday POST/PUT/DELETE so'rov yo'q
- Foydalanuvchi autentifikatsiyasi (keyinchalik — hozircha yo'q)
- Mobil qurilmalarda ham to'g'ri ko'rinishi (responsive)

---

## UI komponentlar (TZ dan olinadi)
- `MetricCard` — mavjud, kichik o'zgarishlar bilan
- `TrendChart` — mavjud
- `VirtualTable` — mavjud (DashboardPage dan)
- `StatusCard` — mavjud
- `useTelemetry` hooks — qayta yoziladi (device_id parametri bilan)

---

## Bog'liq
- [[F06 - Schema Editor]] — sxema read-only ko'rinish
- [[F08 - History Recording]] — tarix ma'lumotlari
- [[05 - Dispatcher]] — umumiy spesifikatsiya

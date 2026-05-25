---
type: adr
adr_number: "004"
decision: "Faqat o'zgargan qiymatlar DB ga yoziladi"
status: accepted
date: 2026-05-24
tags: [adr, backend, database, collector]
---

# ADR-004 · Change-only Recording

## Kontekst
IEC104 har 2 soniyada barcha signallarni qaytaradi.  
3 qurilma × 10 signal = 30 yozuv/2s = **15 yozuv/sekund** = **1.3M yozuv/kun**.

## Qaror
**Faqat qiymat o'zganda yozish** qabul qilindi.

## Hisob-kitob
| Stsenariy | Har poll yozish | Change-only |
|-----------|----------------|-------------|
| Tok o'zgarmas (kechasi) | 1.3M/kun | ~10/kun |
| Faol ish kuni | 1.3M/kun | ~5 000/kun |
| 1 yil | ~475M qator | ~2M qator |

## Implementatsiya
- In-memory cache: `dict[device_id][signal_name] → last_value`
- Epsilon: float uchun `|new - old| > 0.001`, status uchun `new != old`
- Cache dastur qayta ishga tushsa tozalanadi → birinchi qiymat doim yoziladi

## Oqibat
- Tarix "nol o'zgarish" davrlarini ko'rsatmaydi (intentional)
- Dispatcher "oxirgi ma'lum qiymat" ni Redis cache dan o'qiydi
- DB tarix faqat haqiqiy o'zgarishlarni saqlaydi

→ [[features/F08 - History Recording]]

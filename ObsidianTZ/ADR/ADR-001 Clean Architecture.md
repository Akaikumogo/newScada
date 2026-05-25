---
type: adr
adr_number: "001"
decision: "Clean Architecture 4 qatlami qabul qilindi"
status: accepted
date: 2026-05-24
tags: [adr, architecture, backend]
---

# ADR-001 · Clean Architecture

## Kontekst
Backend yozishda qatlam ajratish kerak. 2 ta variant ko'rildi:
- **A)** Oddiy FastAPI "fat router" — hamma narsa routerda
- **B)** Clean Architecture — domain / application / infrastructure / api

## Qaror
**B) Clean Architecture** qabul qilindi.

## Sabablar
| Mezon | Fat Router | Clean Arch |
|-------|-----------|------------|
| Tezlik | Tez yoziladi | Sekinroq boshlanish |
| Test qilish | DB mock kerak | Domain logic izolyatsiya |
| Kengaytirilish | Murakkablashadi | Yangi protokol = faqat infra |
| Bog'liqlik | FastAPI + SQLAlchemy hamma joyda | Faqat tashqi qatlamda |

## Oqibat
- Papka tuzilmasi: `domain/ application/ infrastructure/ api/`
- Repository pattern majburiy
- Domain entities — tashqi kutubxonalarsiz
- Yangi protokol qo'shilsa faqat `infrastructure/` o'zgaradi, qolgan qatlamlar tegmas

→ [[Architecture/Clean Architecture]]

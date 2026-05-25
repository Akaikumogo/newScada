---
type: adr
adr_number: "005"
decision: "Redis real-vaqt cache sifatida tanlandi"
status: accepted
date: 2026-05-24
tags: [adr, backend, redis, cache]
---

# ADR-005 · Redis vs In-Memory Cache

## Kontekst
TZ loyihasida `TelemetryCache` — oddiy Python dict (in-process).  
newScada da ko'p jarayon (collector + API workers) bo'lishi mumkin.

## Muammo
```
uvicorn --workers 4
  → Worker 1: collector (yozadi)
  → Worker 2,3,4: API (o'qiydi)
  → In-memory: har worker o'z dictionarysi — SINXRONIZATSIYA YO'Q
```

## Qaror
**Redis** qabul qilindi.

## Taqqoslash
| Mezon                | In-Memory | Redis                 |
| -------------------- | --------- | --------------------- |
| Ko'p worker          | Muammo    | Markazlashgan         |
| Tezlik               | ~ns       | ~100μs (localhost)    |
| WebSocket pub/sub    | Qo'lda    | Redis Pub/Sub tayyor  |
| Restart da yo'qolish | Ha        | Ixtiyoriy persistence |
| Sozlash              | Nol       | Redis server kerak    |

## Oqibat
- `redis-py asyncio` klient
- Docker Compose da `redis:7-alpine` servisi
- Key sxema: `device:{id}:latest`, `device:{id}:status`
- TTL: latest = 10s, status = 60s
- Pub/Sub: `telemetry:{device_id}` kanal — WS Manager subscribe qiladi

→ [[Architecture/Data Flow]]

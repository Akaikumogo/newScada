---
type: adr
adr_number: "002"
decision: "WebSocket qabul qilindi, HTTP polling rad etildi"
status: accepted
date: 2026-05-24
tags: [adr, websocket, realtime]
---

# ADR-002 · WebSocket vs HTTP Polling

## Kontekst
Dispatcher real-vaqt yangilanishi kerak. 2 ta yo'l:
- **A)** HTTP Polling — har 2 soniya `/api/telemetry/latest` so'rov
- **B)** WebSocket — server push, doimiy ulanish

## Qaror
**B) WebSocket** asosiy, **HTTP Polling** fallback sifatida.

## Taqqoslash
| Mezon | HTTP Polling | WebSocket |
|-------|-------------|-----------|
| Kechikish | ~2 000 ms | ~10-50 ms |
| Server yuki (100 client) | 100 req/2s = 50 req/s | 100 ulanish (idle) |
| Tarmoq | Header × har so'rov | Minimal frame |
| Murakkablik | Minimal | Reconnect logika kerak |
| Firewall/Proxy | Har doim ishlaydi | Ba'zan bloklanishi mumkin |

## Oqibat
- Backend: `ConnectionManager` + FastAPI WebSocket endpoint
- Frontend: `useTelemetrySocket` hook (reconnect + backoff)
- Fallback: WS ulanolmasa → 5s polling

→ [[Architecture/WebSocket Strategy]]

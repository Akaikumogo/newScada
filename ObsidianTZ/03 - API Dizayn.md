---
type: reference
tags: [architecture, api, backend, endpoints]
status: approved
created: 2026-05-24
related: ["[[Architecture/Clean Architecture]]", "[[Architecture/WebSocket Strategy]]"]
---

# API Dizayn

Base URL: `http://localhost:8000`

---

## Branch

| Method | URL | Status | Nima |
|--------|-----|--------|------|
| GET    | `/api/branches` | 200 | Barcha filiallar |
| POST   | `/api/branches` | 201 | Yangi filial |
| PUT    | `/api/branches/{id}` | 200 | Tahrirlash |
| DELETE | `/api/branches/{id}` | 204 | O'chirish |

---

## Substation

| Method | URL                            | Status | Nima                   |
| ------ | ------------------------------ | ------ | ---------------------- |
| GET    | `/api/substations?branch_id=`  | 200    | Filial podstansiyalari |
| POST   | `/api/substations`             | 201    | Yangi podstansiya      |
| PUT    | `/api/substations/{id}`        | 200    | Tahrirlash             |
| DELETE | `/api/substations/{id}`        | 204    | O'chirish              |
| GET    | `/api/substations/{id}/schema` | 200    | Sxema yuklash          |
| PUT    | `/api/substations/{id}/schema` | 200    | Sxema saqlash          |

---

## Device Model

| Method | URL | Status | Nima |
|--------|-----|--------|------|
| GET    | `/api/models` | 200 | Barcha modellar |
| POST   | `/api/models` | 201 | Yangi model |
| PUT    | `/api/models/{id}` | 200 | Tahrirlash |
| DELETE | `/api/models/{id}` | 204 | O'chirish |

---

## Device

| Method | URL | Status | Nima |
|--------|-----|--------|------|
| GET    | `/api/devices?substation_id=` | 200 | Podstansiya qurilmalari |
| GET    | `/api/devices/{id}` | 200 | Qurilma + signallar |
| POST   | `/api/devices` | 201 | Yangi qurilma |
| PUT    | `/api/devices/{id}` | 200 | Tahrirlash |
| DELETE | `/api/devices/{id}` | 204 | O'chirish |

**POST / PUT body:**
```json
{
  "substation_id": 1,
  "model_id": 2,
  "name": "BMRZ-153 №1",
  "protocol": "iec104",
  "iec104_host": "192.168.199.10",
  "iec104_port": 2404,
  "iec104_common_address": 3,
  "poll_interval_seconds": 2.0
}
```

---

## Device Signal

| Method | URL | Status | Nima |
|--------|-----|--------|------|
| GET    | `/api/devices/{id}/signals` | 200 | Qurilma signallari |
| POST   | `/api/devices/{id}/signals` | 201 | Signal qo'shish |
| PUT    | `/api/signals/{id}` | 200 | Signal tahrirlash |
| DELETE | `/api/signals/{id}` | 204 | Signal o'chirish |

---

## Telemetriya

| Method | URL | Status | Nima |
|--------|-----|--------|------|
| GET    | `/api/telemetry/latest?device_id=` | 200 | Oxirgi qiymatlar (Redis) |
| GET    | `/api/telemetry/snapshot` | 200 | Hamma qurilmalar holati |
| GET    | `/api/telemetry/history?device_id=&from=&to=&limit=` | 200 | Tarix (PostgreSQL) |

---

## WebSocket

| Protokol | URL | Nima |
|----------|-----|------|
| WS | `/ws/telemetry` | Barcha qurilmalar real-vaqt stream |
| WS | `/ws/telemetry?device_id={id}` | Bitta qurilma stream |

### WS xabar turlari (server → client)
```typescript
{ type: "snapshot";  data: LiveSnapshot }          // Ulanishdagi dastlabki holat
{ type: "signal";    device_id, signal_name,
                     value, unit, quality, ts }     // Qiymat o'zgandi
{ type: "online";    device_id, points_count }      // Qurilma onlayn bo'ldi
{ type: "offline";   device_id, reason }            // Qurilma oflayn bo'ldi
```

---

## Sog'liq

| Method | URL | Nima |
|--------|-----|------|
| GET    | `/health` | Umumiy holat |
| GET    | `/health/db` | PostgreSQL pool holati |
| GET    | `/health/collectors` | Collector tasklar holati |

---

## Xato kodlari

| HTTP | Holat | Sabab |
|------|-------|-------|
| 400 | Bad Request | Validatsiya xatosi |
| 404 | Not Found | Entity topilmadi |
| 409 | Conflict | Takroriy ma'lumot (UNIQUE buzilish) |
| 422 | Unprocessable | Pydantic validatsiya |
| 500 | Server Error | Kutilmagan xato |

---
type: architecture
tags: [architecture, events, realtime]
status: approved
created: 2026-05-24
related: ["[[Architecture/WebSocket Strategy]]", "[[Architecture/Clean Architecture]]"]
---

# Data Flow — Ma'lumot oqimi va Event-Driven dizayn

---

## Umumiy oqim

```mermaid
sequenceDiagram
    participant BMRZ as Qurilma (IP: 192.168.199.10:2404)
    participant COL as Collector Service
    participant CACHE as Redis Cache
    participant DB as PostgreSQL
    participant BUS as Event Bus
    participant WS as WebSocket Manager
    participant DIS as Dispatcher (Browser)

    Note over COL,DB: Startup: DB dan device.iec104_host, port, casdu o'qiladi

    loop Har poll_interval_seconds (masalan: 2s)
        COL->>BMRZ: TCP connect → STARTDT → C_IC_NA_1 (GI)
        BMRZ-->>COL: ASDU frames (IOA + value)
        COL->>COL: Parse ASDU → SignalValue list
        COL->>COL: Har signal: o'zgandimi? (epsilon check)

        alt Qiymat o'zgandi
            COL->>DB: INSERT record
            COL->>CACHE: SET latest[device_id][signal_name]
            COL->>BUS: emit SignalChangedEvent
            BUS->>WS: push to subscribers
            WS-->>DIS: JSON frame (WebSocket)
        else O'zgarmadi
            COL->>CACHE: SET latest (yangilash)
        end
    end

    DIS->>WS: WS connect /ws/telemetry?device_id=5
    WS-->>DIS: initial snapshot (Redis dan)
```

---

## Domain Events

```python
# domain/events/signal_events.py
from dataclasses import dataclass, field
from datetime import datetime

@dataclass(frozen=True)
class DomainEvent:
    occurred_at: datetime = field(default_factory=datetime.utcnow)

@dataclass(frozen=True)
class SignalChangedEvent(DomainEvent):
    device_id:   int
    signal_name: str
    old_value:   float | None
    new_value:   float
    unit:        str
    quality:     int

@dataclass(frozen=True)
class DeviceOfflineEvent(DomainEvent):
    device_id: int
    reason:    str

@dataclass(frozen=True)
class DeviceOnlineEvent(DomainEvent):
    device_id:    int
    points_count: int
```

---

## Event Bus (in-process)

```python
# infrastructure/events/bus.py
from collections import defaultdict
from typing import Callable, Awaitable

Handler = Callable[[DomainEvent], Awaitable[None]]

class EventBus:
    def __init__(self):
        self._handlers: dict[type, list[Handler]] = defaultdict(list)

    def subscribe(self, event_type: type, handler: Handler):
        self._handlers[event_type].append(handler)

    async def publish(self, event: DomainEvent):
        for handler in self._handlers[type(event)]:
            await handler(event)

# Startup da:
bus = EventBus()
bus.subscribe(SignalChangedEvent, ws_manager.broadcast_signal)
bus.subscribe(SignalChangedEvent, record_writer.on_signal_change)
bus.subscribe(DeviceOfflineEvent, ws_manager.broadcast_offline)
```

---

## Redis Cache strategiyasi

```mermaid
graph LR
    COL[Collector] -->|HSET device:5:latest ia 245.3| R[(Redis)]
    COL -->|PUBLISH telemetry:5| R
    WS[WS Manager] -->|SUBSCRIBE telemetry:*| R
    Q[GetLatestQuery] -->|HGETALL device:5:latest| R
    Q -->|Cache miss| DB[(PostgreSQL)]
```

### Redis key sxemasi
```
device:{id}:latest   HASH    {signal_name → JSON(value,unit,quality,ts)}
device:{id}:status   HASH    {online, message, updated_at}
telemetry:{id}       PubSub  channel (WS Manager subscribe qiladi)
```

> [!NOTE] Tarix Redis da saqlanmaydi
> `record` tarixini Redis ZSET da kesh qilish keraksiz murakkablik.  
> `GET /api/telemetry/history` — **doim PostgreSQL** (partitioned) dan o'qiydi.  
> Redis faqat **oxirgi qiymat** va **WS pub/sub** uchun.

### TTL strategiyasi
```
device:{id}:latest  →  TTL = poll_interval × 5  (10 soniya)
device:{id}:status  →  TTL = 60 soniya
```

---

## Collector holat mashina (State Machine)

```mermaid
stateDiagram-v2
    [*] --> IDLE

    IDLE --> CONNECTING: start()
    CONNECTING --> CONNECTED: socket.connect() OK
    CONNECTING --> ERROR: timeout / refused
    CONNECTED --> INTERROGATING: send C_IC_NA_1
    INTERROGATING --> RECEIVING: ACK keldi
    RECEIVING --> PROCESSING: timeout (ma'lumot tugadi)
    PROCESSING --> IDLE: sleep(poll_interval)
    PROCESSING --> ERROR: parse xatosi

    ERROR --> IDLE: retry_delay o'tdi
    ERROR --> [*]: max_retries oshdi (critical alert)
```

```python
# infrastructure/iec104/state_machine.py
from enum import Enum, auto

class CollectorState(Enum):
    IDLE         = auto()
    CONNECTING   = auto()
    CONNECTED    = auto()
    INTERROGATING= auto()
    RECEIVING    = auto()
    PROCESSING   = auto()
    ERROR        = auto()
```

---

## Xato boshqaruv strategiyasi

```python
# application/services/collector.py
RETRY_DELAYS = [2, 5, 10, 30, 60]  # eksponensial backoff

async def collector_loop(device: Device, bus: EventBus):
    retry_count = 0
    while True:
        try:
            rows = await collect_once(device)
            retry_count = 0  # muvaffaqiyatda reset
            for row in rows:
                await bus.publish(SignalChangedEvent(...))
        except ConnectionRefusedError:
            delay = RETRY_DELAYS[min(retry_count, len(RETRY_DELAYS)-1)]
            retry_count += 1
            await bus.publish(DeviceOfflineEvent(device.id, "connection refused"))
            await asyncio.sleep(delay)
        except Exception as exc:
            log.exception(f"device {device.id} collector error")
            await asyncio.sleep(RETRY_DELAYS[0])
```

---

## Bog'liq
- [[Architecture/WebSocket Strategy]]
- [[Architecture/Clean Architecture]]
- [[Technical/IEC104 Deep Dive]]
- [[Technical/Collector Design]]

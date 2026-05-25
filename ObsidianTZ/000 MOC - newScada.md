---
type: moc
tags: [moc, newscada]
created: 2026-05-24
---

# newScada — Master Map of Content

> **MOC** (Map of Content) — bu vault ning markaziy navigatsiya nuqtasi.  
> Hamma yo'l shu yerdan boshlanadi.

---

## Tizim holati

```dataview
TABLE status AS "Holat", priority AS "Muhimlik", tags AS "Teglar"
FROM "features"
SORT priority ASC
```

---

## Arxitektura qarorlari (ADR)

```dataview
TABLE decision AS "Qaror", status AS "Holat"
FROM "ADR"
SORT file.name ASC
```

---

## Feature progress

```dataview
TASK
FROM "features"
GROUP BY file.link
```

---

## Navigatsiya

### Boshlovchi uchun
- [[EXPLAIN]] — Barcha terminlar izohi (MOC, ADR, CQRS, IOA, ASDU...)
- [[Requirements]] — To'liq stack ro'yxati (alternativ + sabab)

### Arxitektura
- [[Architecture/Clean Architecture]] — 4 qatlam dizayn
- [[Architecture/Data Flow]] — ma'lumot oqimi + Event-driven
- [[Architecture/WebSocket Strategy]] — real-vaqt strategiya
- [[Architecture/DB Strategy]] — migratsiya, partitioning, indekslar

### Texnik chuqurlik
- [[Technical/IEC104 Deep Dive]] — protokol state machine
- [[Technical/React Flow Patterns]] — Schema Editor arxitekturasi
- [[Technical/FastAPI Patterns]] — Dependency injection, middleware
- [[Technical/Collector Design]] — Background task dizayni

### Featurelar
- [[features/F01 - Branch Management]]
- [[features/F02 - Substation Management]]
- [[features/F03 - Device Management]]
- [[features/F04 - Model Catalog]]
- [[features/F05 - IEC104 Signal Config]]
- [[features/F06 - Schema Editor]]
- [[features/F07 - Dispatcher View]]
- [[features/F08 - History Recording]]

### Qarorlar jurnali
- [[ADR/ADR-001 Clean Architecture]]
- [[ADR/ADR-002 WebSocket vs Polling]]
- [[ADR/ADR-003 React Flow]]
- [[ADR/ADR-004 Change-only Recording]]
- [[ADR/ADR-005 Redis Cache]]

### UI/UX Dizayn
- [[Design/Design Index]] — Barcha dizayn hujjatlari indeksi

**Dispatcher (frontend):**
- [[Design/frontend/UI/Color System]] — Dark tema, status ranglari
- [[Design/frontend/UI/Typography]] — Inter + mono, type scale
- [[Design/frontend/UI/Component Library]] — StatusBadge, DeviceCard, HistoryChart
- [[Design/frontend/UI/Layout]] — Sidebar layout, grid
- [[Design/frontend/UX/User Flows]] — 7 ta operator flow
- [[Design/frontend/UX/Wireframes]] — ASCII wireframlar
- [[Design/frontend/UX/Interaction Patterns]] — Flash, WS reconnect, hover

**Editor (EDITOR):**
- [[Design/editor/UI/Color System]] — Light/dark dual tema
- [[Design/editor/UI/Typography]] — Form tipografiyasi
- [[Design/editor/UI/Component Library]] — Button, DataTable, Modal, Schema Node
- [[Design/editor/UI/Layout]] — TopBar tabs, Schema Editor 3-panel
- [[Design/editor/UX/User Flows]] — 7 ta admin flow
- [[Design/editor/UX/Wireframes]] — CRUD + Schema Editor wireframlar
- [[Design/editor/UX/Interaction Patterns]] — Validation, undo/redo, optimistic update

### Shablonlar
- [[Templates/Feature Template]]
- [[Templates/ADR Template]]

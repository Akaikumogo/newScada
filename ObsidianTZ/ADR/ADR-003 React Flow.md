---
type: adr
adr_number: "003"
decision: "React Flow + Zustand + zundo qabul qilindi"
status: accepted
date: 2026-05-24
tags: [adr, frontend, schema-editor]
---

# ADR-003 · Schema Editor kutubxona tanlovi

## Kontekst
Schema Editor uchun canvas kutubxona tanlash kerak. Ko'rilganlar:
- **A)** Konva.js — low-level canvas, to'liq nazorat
- **B)** Fabric.js — object model, eskirib qolgan
- **C)** React Flow — node/edge, React-native

## Qaror
**C) React Flow** (`@xyflow/react`) qabul qilindi.

## Sabablar
| Mezon | Konva | Fabric | React Flow |
|-------|-------|--------|------------|
| React integratsiya | Manual | Manual | Native |
| Node/edge tizim | Qurilishi kerak | Cheklangan | Tayyor |
| Custom node | Canvas API | Canvas API | JSX komponent |
| Performans | Yuqori | O'rtacha | Yuqori (virtualizatsiya) |
| Undo/Redo | Qurilishi kerak | Cheklangan | `zundo` bilan |
| Faollik | Faol | Kam | Juda faol |

**State management:** Zustand + `immer` + `zundo` (undo/redo)

## Oqibat
- Har bir node turi alohida React komponenti
- `NODE_TYPES` registri — markazlashgan
- `useEditorStore` (Zustand) — barcha editor holati
- 50 ta undo qadam (zundo `limit: 50`)

→ [[Technical/React Flow Patterns]]

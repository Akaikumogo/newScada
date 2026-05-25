---
type: design
tags: [design, editor, ux, wireframe]
status: approved
created: 2026-05-24
related: ["[[Design/editor/UX/User Flows]]", "[[Design/editor/UI/Layout]]", "[[04 - Editor]]", "[[07 - Schema Editor]]"]
---

# Editor — Wireframlar

---

## W1 — Qurilmalar ro'yxati (asosiy sahifa)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ⚡ newSCADA Editor  [Filiallar][Podstansiyalar][Qurilmalar✓][Modellar]  [🌙][A]│
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Qurilmalar                                         [+ Qurilma qo'shish]       │
│  14 ta qurilma · 3 podstansiya                                                  │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  [Filial: Barchasi ▼]  [Podstansiya: Barchasi ▼]       [🔍 Qidirish...      ] │
│                                                                                 │
│  ┌────┬──────────────┬──────────────────┬──────────────────┬───────┬──────┬───────────┐│
│  │ #  │ Nomi         │ Podstansiya      │ IP : Port        │ CASDU │ Intv │ Amallar   ││
│  ├────┼──────────────┼──────────────────┼──────────────────┼───────┼──────┼───────────┤│
│  │ 1  │ BMRZ-153 №1  │ Yunusobod PS     │ 192.168.199.10:2404│  3  │  2s  │[📡][✏][🗑]││
│  │ 2  │ BMRZ-153 №2  │ Yunusobod PS     │ 192.168.199.11:2404│  1  │  2s  │[📡][✏][🗑]││
│  │ 3  │ Relay №1     │ Chilonzor PS     │ 192.168.199.20:2404│  5  │  5s  │[📡][✏][🗑]││
│  │ ...│              │                  │                  │       │      │           ││
│  └────┴──────────────┴──────────────────┴──────────────────┴───────┴──────┴───────────┘│
│                                                                                 │
│  [← Oldingi]  1 / 2  [Keyingi →]                                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**[📡]** — Signal konfiguratsiyaga o'tish  
**[✏]** — Tahrirlash modali  
**[🗑]** — O'chirish (tasdiqlash bilan)

---

## W2 — Qurilma qo'shish/tahrirlash modali

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Yangi qurilma                                                  [✕]  │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Nomi *                   Model *                                   │   │
│  │  [BMRZ-153 №1          ] [BMRZ-153 ▼                              ] │   │
│  │                                                                      │   │
│  │  Podstansiya *                                                       │   │
│  │  [Yunusobod PS ▼                                                   ] │   │
│  │                                                                      │   │
│  │  ─── IEC104 Ulanish sozlamalari ───────────────────────────────────  │   │
│  │                                                                      │   │
│  │  IP manzil *              Port *                                    │   │
│  │  [192.168.199.10       ] [2404     ]                                │   │
│  │                                                                      │   │
│  │  CASDU *                  So'rov intervali (sek) *                  │   │
│  │  [3                    ] [2.0      ]                                │   │
│  │  ⓘ Common Address (1-65535)  ⓘ Minimal: 0.5s                      │   │
│  │                                                                      │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                 [Bekor qilish]  [Saqlash]           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## W3 — Signal konfiguratsiya sahifasi

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ⚡ newSCADA Editor  [Filiallar][Podstansiyalar][Qurilmalar✓][Modellar]  [🌙][A]│
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  [← Qurilmalar]  BMRZ-153 №1 — Signallar          [+ Signal qo'shish]         │
│  192.168.199.10:2404  ·  CASDU: 3  ·  Interval: 2s                            │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  ┌──────┬──────────────┬─────────────────────────┬──────┬──────────┬──────────┐│
│  │ IOA  │ Signal Name  │ Title                   │ Unit │ Type     │ Amallar  ││
│  ├──────┼──────────────┼─────────────────────────┼──────┼──────────┼──────────┤│
│  │ 1000 │ Ia           │ Tok A fazasi             │ A    │ float    │ [✏][🗑] ││
│  │ 1001 │ Ib           │ Tok B fazasi             │ A    │ float    │ [✏][🗑] ││
│  │ 1002 │ Ic           │ Tok C fazasi             │ A    │ float    │ [✏][🗑] ││
│  │ 2000 │ Ua           │ Kuchlanish A             │ kV   │ float    │ [✏][🗑] ││
│  │ 3000 │ CB_status    │ Kommutator holati        │      │ status   │ [✏][🗑] ││
│  └──────┴──────────────┴─────────────────────────┴──────┴──────────┴──────────┘│
│                                                                                 │
│  5 ta signal                                                                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## W4 — Schema Editor

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [← Podstansiyalar]  Yunusobod PS — Sxema Muharriri            [● Saqlanmagan] │
│ [↩ Bekor][↺ Qayta]  [+ Node ▼]  [🗑 O'chirish]  [⊡ Ko'rish]    [💾 Saqlash] │
├──────────────────────────────────────────────────────────────────────┬──────────┤
│                                                                       │          │
│   CANVAS                                               DOT GRID       │ XUSUSIYAT│
│                                                                       │ PANELI   │
│                    ┌──────────────────┐                               │          │
│                    │ ≡ Шина 110кВ     │                               │ Tanlangan│
│                    │ [Bus]            │                               │ element: │
│                    └────────┬─────────┘                               │ ─────────│
│                             │                                         │ Label:   │
│         ┌──────────────────┐│┌────────────────┐                      │ [Шина   ]│
│         │  BMRZ-153 №1     ││ │  BMRZ-153 №2  │                      │          │
│         │  [Relay]  ●      ││ │  [Relay]  ●   │                      │ Device:  │
│         │  Ia: 245 A       ││ │  Ia: 244 A    │                      │ [None ▼ ]│
│         └──────────────────┘│└───────────────┘                       │          │
│                              │                                        │ Color:   │
│                              │                                        │ [██████] │
│                                                                       │          │
│                                                   Zoom: 85%  [-][+]  │          │
└──────────────────────────────────────────────────────────────────────┴──────────┘
```

---

## W5 — O'chirish tasdiqlash dialogi

```
                    ┌──────────────────────────────────┐
                    │  Qurilmani o'chirish         [✕] │
                    ├──────────────────────────────────┤
                    │                                  │
                    │  ⚠  BMRZ-153 №1 ni              │
                    │     o'chirmoqchimisiz?           │
                    │                                  │
                    │  Bu qurilmaga oid:               │
                    │  · 5 ta signal                   │
                    │  · 12,453 ta yozuv               │
                    │  ham o'chib ketadi.              │
                    │                                  │
                    │  Bu amalni bekor qilib           │
                    │  bo'lmaydi!                     │
                    │                                  │
                    │  [Bekor qilish]  [Ha, o'chirish] │
                    └──────────────────────────────────┘
```

---

## W6 — Validation xatosi

```
  Nomi *
  [                        ]
  
  IP manzil *
  [192.168.199.999         ]
  ╰── ⚠ Noto'g'ri IP manzil format
  
  Port *
  [99999                   ]
  ╰── ⚠ Port 1-65535 oralig'ida bo'lishi kerak
  
  CASDU *
  [                        ]
  ╰── ⚠ Bu maydon to'ldirilishi shart
```

---

## Bog'liq
- [[Design/editor/UX/User Flows]]
- [[Design/editor/UI/Layout]]
- [[Design/editor/UI/Component Library]]
- [[07 - Schema Editor]]

---
type: design
tags: [design, editor, ui, layout]
status: approved
created: 2026-05-24
related: ["[[Design/editor/UI/Color System]]", "[[Design/editor/UI/Component Library]]", "[[04 - Editor]]"]
---

# Editor — Layout va Grid

---

## Asosiy sahifa strukturasi (CRUD sahifalar)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  TOPBAR  (h: 56px)                                                              │
│  [⚡ newSCADA Editor]  [Filiallar] [Podstansiyalar] [Qurilmalar] [Modellar]    │
│                                              [🌙 Dark mode]  [Admin ▼]         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  MAIN CONTENT  (padding: 24px)                                                  │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  PAGE HEADER                                                             │   │
│  │  h1: Qurilmalar                          [+ Qurilma qo'shish]           │   │
│  │  body-sm: 14 ta qurilma · Yunusobod PS                                  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  FILTER BAR                                                              │   │
│  │  [Filial: Barchasi ▼]  [Podstansiya: Barchasi ▼]     [🔍 Qidirish...]  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  DATA TABLE                                                              │   │
│  │  # │ Nomi │ Podstansiya │ IP │ Port │ CASDU │ Amallar                   │   │
│  │  ──┼──────┼─────────────┼────┼──────┼───────┼─────────                   │   │
│  │  1 │ ...  │ ...         │    │      │       │ [✏][🗑]                  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Schema Editor sahifasi

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  [← Orqaga]   Yunusobod PS — Sxema Muharriri     [Saqlash]  [↩ Bekor] [↺ Qayt]│  h:56px, Toolbar
├───────────────────────────────────────────────────────────────┬─────────────────┤
│                                                               │                 │
│  CANVAS (React Flow)                                         │ PROPERTIES      │
│                                                               │ PANEL           │
│                                                               │ (w: 300px)      │
│  ┌──────────┐                                                 │                 │
│  │ BMRZ №1  │                                                 │ Tanlangan:      │
│  │ ● Online │                                                 │ BMRZ-153 №1     │
│  └─────┬────┘                                                 │                 │
│        │                                                      │ Label: [____]   │
│  ┌─────┴────┐                                                 │ Color: [____]   │
│  │ Bus 110kV│                                                 │ Size:  [____]   │
│  └──────────┘                                                 │                 │
│                                                               │ [Sxemaga bog'liq│
│                                                               │  device: BMRZ №1│
│  [+ Node qo'shish]  [🗑 O'chirish]  [⊡ fitView]  80%  [-][+]│                 │
└───────────────────────────────────────────────────────────────┴─────────────────┘
```

---

## Navigation

Editor navigatsiyasi **TopBar tab** orqali (sidebar yo'q):

```
Tabs: [Filiallar] [Podstansiyalar] [Qurilmalar] [Model Katalogi]
      (underline indicator, aktiv tab ko'k chiziq)
```

**URL tuzilmasi:**
```
/editor/branches           → Filiallar
/editor/substations        → Podstansiyalar
/editor/devices            → Qurilmalar
/editor/devices/:id/signals → Signal konfiguratsiya
/editor/models             → Model katalogi
/editor/substations/:id/schema → Schema Editor
```

---

## Modal o'lchamlari

```
sm  (w-96  = 384px) → Tasdiqlash dialogi, oddiy input
md  (560px)         → Create/Edit formalar (asosiy)
lg  (800px)         → Signal config, ko'p maydon
xl  (1000px)        → Sxema import/export preview
```

---

## Spacing

Editor 8px grid ishlatadi (Dispatcher bilan bir xil):

```
Sahifa padding: 24px (p-6)
Section gap:    24px (gap-6)
Card padding:   20px (p-5)
Form gap:       16px (gap-4)
Button gap:     8px  (gap-2)
Table cell:     px-4 py-2.5
```

---

## Properties Panel (Schema Editor)

```
width: 300px
position: fixed right
height: calc(100% - 56px)
background: var(--bg-card)
border-left: 1px solid var(--border)
overflow-y: auto
padding: 16px
```

**Tarkib bo'limlari:**
```
1. Element ma'lumotlari
   ├── Label (input)
   ├── Device (select — DB dan)
   └── Node type (relay/transformer/...)

2. Ko'rinish
   ├── Width / Height (number inputs)
   ├── Color (color picker)
   └── Border style

3. Metadata
   └── Node ID (readonly, monospace)
```

---

## Undo/Redo Toolbar (Schema Editor)

```
[↩ Bekor qilish]  [↺ Qayta qilish]  |  [Saqlash]

React hook: const { undo, redo, canUndo, canRedo } = useHistoryStore();
Limit: 50 qadam (zundo)
```

---

## Responsive

Editor faqat **desktop** uchun (min-width: 1024px):

```
< 1024px: "Iltimos, katta monitor ishlatang" xabar ko'rsatiladi
1024px:   Asosiy desktop layout (jadval tiqilgan bo'lishi mumkin)
1280px:   Qulay ishlash oralig'i
1440px:   Ideal
```

Schema Editor faqat **1280px+** da to'liq ishlaydi.

---

## Bog'liq
- [[Design/editor/UI/Color System]]
- [[Design/editor/UI/Component Library]]
- [[Design/editor/UX/User Flows]]
- [[07 - Schema Editor]]

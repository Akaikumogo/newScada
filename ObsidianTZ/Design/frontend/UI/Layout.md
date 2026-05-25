---
type: design
tags: [design, frontend, ui, layout]
status: approved
created: 2026-05-24
related: ["[[Design/frontend/UI/Color System]]", "[[Design/frontend/UI/Component Library]]", "[[Design/frontend/UX/User Flows]]"]
---

# Dispatcher — Layout va Grid

---

## Asosiy sahifa strukturasi

```
┌─────────────────────────────────────────────────────────────────┐
│  TOPBAR  (h: 56px, bg: #0D1117, border-bottom: #30363D)        │
│  [⚡ newSCADA]  [Yunusobod filiali ▼]          [● Live]        │
├────────────────┬────────────────────────────────────────────────┤
│                │                                                │
│   SIDEBAR      │    MAIN CONTENT                               │
│   (w: 260px)   │    (flex: 1)                                  │
│   bg: #161B22  │    bg: #0D1117                                │
│                │                                               │
│  ● Podstansiya │    ┌──────────────────────────────────┐       │
│    Yunusobod   │    │ Yunusobod PS       12 / 14 online│       │
│  ─────────────│    ├──────────────────────────────────┤       │
│  ● Podstansiya │    │                                  │       │
│    Chilonzor  │    │   DeviceCard  DeviceCard          │       │
│                │    │                                  │       │
│                │    │   DeviceCard  DeviceCard          │       │
│                │    │                                  │       │
│                │    └──────────────────────────────────┘       │
│                │                                               │
└────────────────┴────────────────────────────────────────────────┘
```

---

## Responsive Breakpoints

```css
/* Tailwind default breakpoints — Dispatcher uchun */
sm:  640px   /* Kichik monitor — sidebar yopiladi */
md:  768px   /* Planshet — 1 kolonna device grid */
lg:  1024px  /* Katta monitor — 2 kolonna */
xl:  1280px  /* Control room monitor — 3 kolonna */
2xl: 1536px  /* Ultra-wide — 4 kolonna */
```

**Device Grid kolonkalari:**
```
< 768px  →  1 kolonna  (stacked)
768px    →  1 kolonna
1024px   →  2 kolonna
1280px   →  3 kolonna
1536px   →  4 kolonna
```

---

## Spacing System (8px grid)

```
4  px  →  0.25rem   gap-1   (ichki element oralig'i)
8  px  →  0.5rem    gap-2   (element ichki padding)
12 px  →  0.75rem   gap-3   (label-value oralig'i)
16 px  →  1rem      gap-4   (card padding)
24 px  →  1.5rem    gap-6   (karta-karta oralig'i)
32 px  →  2rem      gap-8   (bo'lim oralig'i)
48 px  →  3rem      gap-12  (sahifa padding)
```

---

## TopBar

```
height: 56px
padding: 0 24px
background: #0D1117
border-bottom: 1px solid #30363D
position: sticky
top: 0
z-index: 50
```

**Tarkib:**
```
[Logo + Text]  [Spacer →]  [Branch Selector]  [   ]  [WS Indicator]
```

---

## Sidebar

```
width: 260px
min-width: 260px
height: calc(100vh - 56px)
overflow-y: auto
background: #161B22
border-right: 1px solid #30363D
position: sticky
top: 56px

/* Scroll stilini yashirish */
scrollbar-width: thin;
scrollbar-color: #30363D transparent;
```

**Substation item:**
```
height: 40px
padding: 0 16px
cursor: pointer
border-radius: 6px (ichki margin bilan)

hover:  background #21262D
active: background #1F6FEB1A, text #388BFD
```

---

## Main Content

```
flex: 1
min-width: 0
height: calc(100vh - 56px)
overflow-y: auto
padding: 24px
```

**Device Grid:**
```css
.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}
```

---

## Device Card o'lchami

```
min-width: 300px
max-width: 480px
background: #161B22
border: 1px solid #30363D
border-radius: 12px
overflow: hidden

Header: padding 12px 16px, bg #21262D
Body:   padding 0 (table)
Footer: padding 8px 16px, text-micro, text-secondary
```

---

## Schema Viewer

Podstansiya sxemasini ko'rish uchun alohida ko'rinish (Dispatcher):

```
Sahifa: /dispatcher/substation/{id}/schema

┌─────────────────────────────────────────────────────────────┐
│ [← Orqaga]  Yunusobod PS — Sxema                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   React Flow (read-only)                                    │
│   fitView: true                                             │
│   panOnDrag: true                                           │
│   zoomOnScroll: true                                        │
│   nodesDraggable: false                                     │
│   nodesConnectable: false                                   │
│   elementsSelectable: false                                 │
│                                                             │
│   Har node ustiga hover → signal qiymatlari ko'rinadi       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Z-index ierarxiyasi

```
0     normal content
10    card hover states
20    sticky header cells
30    sidebar
40    topbar
50    dropdown menus
60    modal overlay
70    modal content
80    toast notifications
90    tooltip
```

---

## Bog'liq
- [[Design/frontend/UI/Color System]]
- [[Design/frontend/UI/Component Library]]
- [[Design/frontend/UX/User Flows]]
- [[Design/frontend/UX/Wireframes]]

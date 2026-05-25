---
type: design
tags: [design, frontend, ui, color]
status: approved
created: 2026-05-24
related: ["[[Design/frontend/UI/Typography]]", "[[Design/frontend/UI/Component Library]]", "[[05 - Dispatcher]]"]
---

# Dispatcher — Rang Tizimi (Color System)

Dispatcher **qorangi (dark) tema** ishlatadi. Nazoratchilar ko'pincha past yorug'lik bo'lgan boshqaruv xonalarida ishlashadi. Ko'z charchashini kamaytirish uchun dark mode asosiy.

---

## Base Palette

```
Background Layer 1 (eng chuqur)  →  #0D1117   (GitHub dark bg)
Background Layer 2 (card, panel) →  #161B22
Background Layer 3 (hover, aktiv)→  #21262D
Border                           →  #30363D
Border subtle                    →  #21262D
```

## Text

```
Text Primary     →  #E6EDF3   (asosiy matn)
Text Secondary   →  #8B949E   (yordam matn, label)
Text Disabled    →  #484F58
Text Inverse     →  #0D1117   (qora fon ustida)
```

## Brand / Accent

```
Brand Blue       →  #1F6FEB   (primary action, link)
Brand Blue Hover →  #388BFD
Brand Blue Light →  #388BFD1A (background tint)
```

## Semantic — Status ranglari (SCADA uchun kritik)

```
┌─────────────┬────────────┬──────────────┬───────────────────────────────────┐
│ Holat        │ Rang        │ HEX          │ Ishlatilish                        │
├─────────────┼────────────┼──────────────┼───────────────────────────────────┤
│ ONLINE      │ Yashil     │ #3FB950      │ Qurilma ulangan, normal             │
│ OFFLINE     │ Qizil      │ #F85149      │ Qurilma uzilgan, xato               │
│ WARNING     │ Sariq      │ #D29922      │ Ogohlantirish, qayta urinayapti     │
│ UNKNOWN     │ Kulrang    │ #6E7681      │ Ma'lumot yo'q, yangi                │
│ STALE       │ Zangori    │ #79C0FF      │ Eskirgan ma'lumot (TTL o'tgan)      │
└─────────────┴────────────┴──────────────┴───────────────────────────────────┘
```

### Status rang variatsiyalari

```css
/* Online */
--color-online:          #3FB950;
--color-online-bg:       #3FB9501A;
--color-online-border:   #3FB95033;

/* Offline */
--color-offline:         #F85149;
--color-offline-bg:      #F851491A;
--color-offline-border:  #F8514933;

/* Warning */
--color-warning:         #D29922;
--color-warning-bg:      #D299221A;
--color-warning-border:  #D2992233;
```

---

## Signal qiymat ranglari

Real-time telemetriya qiymatlari uchun qo'shimcha rang kodlash:

```
Normal range   →  #E6EDF3  (default text)
High alarm     →  #F85149  (qizil — chegaradan yuqori)
Low alarm      →  #D29922  (sariq — chegaradan past)
Good quality   →  yashil nuqta  #3FB950
Bad quality    →  qizil nuqta   #F85149
```

---

## Tailwind CSS config

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Background layers
        'bg-1': '#0D1117',
        'bg-2': '#161B22',
        'bg-3': '#21262D',

        // Border
        'border-default': '#30363D',
        'border-subtle': '#21262D',

        // Text
        'text-primary': '#E6EDF3',
        'text-secondary': '#8B949E',
        'text-disabled': '#484F58',

        // Brand
        'brand': '#1F6FEB',
        'brand-hover': '#388BFD',

        // Status
        'online': '#3FB950',
        'offline': '#F85149',
        'warning': '#D29922',
        'unknown': '#6E7681',
        'stale': '#79C0FF',
      }
    }
  }
}
```

---

## CSS Custom Properties

```css
/* src/styles/tokens.css */
:root {
  /* Backgrounds */
  --bg-1: #0D1117;
  --bg-2: #161B22;
  --bg-3: #21262D;

  /* Borders */
  --border: #30363D;
  --border-subtle: #21262D;

  /* Text */
  --text-primary: #E6EDF3;
  --text-secondary: #8B949E;
  --text-disabled: #484F58;

  /* Brand */
  --brand: #1F6FEB;
  --brand-hover: #388BFD;
  --brand-bg: #1F6FEB1A;

  /* Status */
  --online: #3FB950;
  --offline: #F85149;
  --warning: #D29922;
  --unknown: #6E7681;
  --stale: #79C0FF;
}
```

---

## Vizual misol

```
┌─────────────────────────────────────────────────────────┐  #0D1117
│  NEWSCADA DISPATCHER                              🟢 5  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ BMRZ-153 №1     │  │ BMRZ-153 №2     │  #161B22     │
│  │ ● ONLINE        │  │ ● OFFLINE       │              │
│  │  Ia: 245.3 A    │  │  -- A           │              │
│  │  Ua: 10.4 kV    │  │  -- kV          │              │
│  └─────────────────┘  └─────────────────┘              │
│   ^^^#3FB950^^^          ^^^#F85149^^^                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Bog'liq
- [[Design/frontend/UI/Typography]]
- [[Design/frontend/UI/Component Library]]
- [[Design/frontend/UI/Layout]]
- [[05 - Dispatcher]]

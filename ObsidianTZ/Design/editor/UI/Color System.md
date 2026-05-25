---
type: design
tags: [design, editor, ui, color]
status: approved
created: 2026-05-24
related: ["[[Design/editor/UI/Typography]]", "[[Design/editor/UI/Component Library]]", "[[04 - Editor]]"]
---

# Editor — Rang Tizimi (Color System)

Editor **yorug' (light) asosli, ikki rejimli** tema ishlatadi. Admin panellar kunduzi ko'proq ishlatiladi. Dark mode ham qo'llab-quvvatlanadi.

---

## Light Mode Base Palette

```
Background (sahifa)     →  #F6F8FA   (GitHub light bg)
Background (card)       →  #FFFFFF
Background (hover)      →  #F0F2F4
Background (aktiv)      →  #EEF2FF   (ko'k tint)
Border                  →  #D0D7DE
Border subtle           →  #E8EAED
```

## Light Mode Text

```
Text Primary     →  #1F2328   (asosiy matn)
Text Secondary   →  #57606A   (yordam matn)
Text Placeholder →  #8C959F
Text Disabled    →  #A8B1BA
Text Inverse     →  #FFFFFF
```

## Dark Mode Base Palette

```
Background (sahifa)     →  #0D1117
Background (card)       →  #161B22
Background (hover)      →  #21262D
Background (aktiv)      →  #1F6FEB1A
Border                  →  #30363D
Border subtle           →  #21262D
```

## Dark Mode Text

```
Text Primary     →  #E6EDF3
Text Secondary   →  #8B949E
Text Placeholder →  #484F58
Text Disabled    →  #484F58
```

---

## Brand / Accent (ikkala rejimda bir xil)

```
Brand Blue        →  #1F6FEB   (primary button, link, focus ring)
Brand Blue Hover  →  #1A62D4
Brand Blue Light  →  #EEF2FF   (light mode bg tint)
Brand Blue Dark   →  #1F6FEB1A (dark mode bg tint)
```

---

## Semantic Colors

```
Success (saqlandi)  →  #1A7F37  (light) / #3FB950 (dark)
Danger (o'chirish)  →  #CF222E  (light) / #F85149 (dark)
Warning (ogohlantirish) →  #9A6700 (light) / #D29922 (dark)
Info (ma'lumot)     →  #0969DA  (light) / #79C0FF (dark)
```

---

## Schema Editor ranglari (React Flow canvas)

Schema Editor o'z rang tizimiga ega — qurilma bloklari rangi:

```
Canvas fon        →  #F6F8FA (light) / #0D1117 (dark)
Grid dots         →  #D0D7DE (light) / #30363D (dark)
Node fon          →  #FFFFFF (light) / #161B22 (dark)
Node border       →  #D0D7DE (light) / #30363D (dark)
Node tanlangan    →  border #1F6FEB, shadow 0 0 0 3px #1F6FEB40
Edge (wire)       →  #57606A (light) / #8B949E (dark)
Edge tanlangan    →  #1F6FEB

Qurilma turlari rangi (node badge):
  Relay           →  #2563EB  (ko'k)
  Transformer     →  #7C3AED  (binafsha)
  Switch          →  #059669  (yashil)
  Meter           →  #D97706  (to'q sariq)
  Bus             →  #6B7280  (kulrang)
  Custom          →  foydalanuvchi tanlaydi
```

---

## Tailwind CSS config (Editor)

```javascript
// editor/tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light backgrounds
        'bg-page':  '#F6F8FA',
        'bg-card':  '#FFFFFF',
        'bg-hover': '#F0F2F4',
        'bg-active':'#EEF2FF',

        // Border
        'border-default': '#D0D7DE',
        'border-subtle':  '#E8EAED',

        // Text
        'text-primary':   '#1F2328',
        'text-secondary': '#57606A',
        'text-disabled':  '#A8B1BA',

        // Brand
        'brand':       '#1F6FEB',
        'brand-hover': '#1A62D4',
        'brand-bg':    '#EEF2FF',

        // Semantic
        'success':  '#1A7F37',
        'danger':   '#CF222E',
        'warning':  '#9A6700',
        'info':     '#0969DA',

        // Dark mode overrides (CSS variables bilan)
      }
    }
  }
}
```

---

## CSS Variables (dual-mode)

```css
/* src/styles/tokens.css */
:root {
  --bg-page:    #F6F8FA;
  --bg-card:    #FFFFFF;
  --bg-hover:   #F0F2F4;
  --bg-active:  #EEF2FF;
  --border:     #D0D7DE;
  --border-subtle: #E8EAED;
  --text:       #1F2328;
  --text-secondary: #57606A;
  --brand:      #1F6FEB;
  --success:    #1A7F37;
  --danger:     #CF222E;
  --warning:    #9A6700;
}

.dark {
  --bg-page:    #0D1117;
  --bg-card:    #161B22;
  --bg-hover:   #21262D;
  --bg-active:  #1F6FEB1A;
  --border:     #30363D;
  --border-subtle: #21262D;
  --text:       #E6EDF3;
  --text-secondary: #8B949E;
  --brand:      #1F6FEB;
  --success:    #3FB950;
  --danger:     #F85149;
  --warning:    #D29922;
}
```

---

## Button ranglari

```
Primary:   bg-brand, text-white, hover:bg-brand-hover
Secondary: bg-bg-card, text-text, border-border, hover:bg-bg-hover
Danger:    bg-danger, text-white, hover:bg-red-700
Ghost:     transparent, text-text, hover:bg-bg-hover
Link:      transparent, text-brand, hover:underline
```

---

## Bog'liq
- [[Design/editor/UI/Typography]]
- [[Design/editor/UI/Component Library]]
- [[Design/editor/UI/Layout]]
- [[04 - Editor]]
- [[07 - Schema Editor]]

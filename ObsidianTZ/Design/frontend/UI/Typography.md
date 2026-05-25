---
type: design
tags: [design, frontend, ui, typography]
status: approved
created: 2026-05-24
related: ["[[Design/frontend/UI/Color System]]", "[[Design/frontend/UI/Component Library]]"]
---

# Dispatcher — Tipografiya (Typography)

---

## Font tanlovi

| Rol | Font | Sabab |
|-----|------|-------|
| UI Font | **Inter** | Eng o'qilishi yaxshi sans-serif, monitoring uchun ideal |
| Monospace (qiymatlar) | **JetBrains Mono** | Raqamlar bir xil kenglikda — ustunlar tekis turadi |
| Fallback | system-ui, -apple-system | Tez yuklash uchun |

```css
/* src/styles/fonts.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.mono, .value, .signal-value {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
}
```

---

## Type Scale

```
┌──────────┬───────────┬────────────┬───────────────────────────────────┐
│ Token    │ Size (rem) │ Weight     │ Ishlatilish                        │
├──────────┼───────────┼────────────┼───────────────────────────────────┤
│ display  │ 2.25rem   │ 700 Bold   │ Sahifa sarlavhasi (kamdan-kam)     │
│ h1       │ 1.5rem    │ 700 Bold   │ Modul sarlavhasi                   │
│ h2       │ 1.25rem   │ 600 Semi   │ Panel sarlavhasi                   │
│ h3       │ 1.0rem    │ 600 Semi   │ Karta sarlavhasi                   │
│ body-lg  │ 0.9375rem │ 400 Normal │ Asosiy matn                        │
│ body     │ 0.875rem  │ 400 Normal │ Default (14px)                     │
│ body-sm  │ 0.8125rem │ 400 Normal │ Yordam matn, meta                  │
│ caption  │ 0.75rem   │ 400 Normal │ Label, badge matn                  │
│ micro    │ 0.6875rem │ 500 Medium │ Timestamp, unit (11px)             │
└──────────┴───────────┴────────────┴───────────────────────────────────┘
```

---

## Signal qiymat tipografiyasi (MONO)

Telemetriya qiymatlari uchun maxsus stil — raqamlar bir xil kenglikda bo'lishi kerak:

```css
/* Katta qiymat ko'rsatish */
.signal-value-lg {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.5rem;    /* 24px */
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

/* Jadval ichida qiymat */
.signal-value-sm {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;  /* 14px */
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

/* Unit (A, kV, MW) */
.signal-unit {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;   /* 12px */
  font-weight: 500;
  color: var(--text-secondary);
  margin-left: 4px;
}
```

---

## Tailwind tipografiya klassy

```javascript
// tailwind.config.js — fontSize sozlash
fontSize: {
  'display': ['2.25rem', { lineHeight: '2.75rem', fontWeight: '700' }],
  'h1':      ['1.5rem',  { lineHeight: '2rem',    fontWeight: '700' }],
  'h2':      ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
  'h3':      ['1rem',    { lineHeight: '1.5rem',  fontWeight: '600' }],
  'body-lg': ['0.9375rem',{ lineHeight: '1.5rem', fontWeight: '400' }],
  'body':    ['0.875rem', { lineHeight: '1.375rem',fontWeight: '400' }],
  'body-sm': ['0.8125rem',{ lineHeight: '1.25rem',fontWeight: '400' }],
  'caption': ['0.75rem', { lineHeight: '1rem',    fontWeight: '400' }],
  'micro':   ['0.6875rem',{ lineHeight: '1rem',   fontWeight: '500' }],
}
```

---

## Misol — Device Card

```
┌──────────────────────────────────────────┐
│ BMRZ-153 №1                    h3 600    │
│ 192.168.199.10 · Yunusobod PS  caption   │
│──────────────────────────────────────────│
│  Ia        245.3  A            mono-sm   │
│  Ib        244.8  A            mono-sm   │
│  Ic        246.1  A            mono-sm   │
│  Ua         10.4  kV           mono-sm   │
│──────────────────────────────────────────│
│  Yangilandi: 14:32:05          micro     │
└──────────────────────────────────────────┘
```

---

## Qoidalar

1. **Raqamlar har doim monospace** — jadvalda vertikal tekislik saqlanadi
2. **Unit qisqartmalar katta harf emas** — `kV`, `MW`, `A` (ISO standart)
3. **Timestamp 24-soat formati** — `HH:MM:SS`, sanasi `DD.MM.YYYY`
4. **Minimal font o'lcham** — 11px (micro) dan kichik bo'lmasin
5. **Line height** — raqamli qiymatlarda `1.0` yoki `1.2`, matnda `1.5`

---

## Bog'liq
- [[Design/frontend/UI/Color System]]
- [[Design/frontend/UI/Component Library]]

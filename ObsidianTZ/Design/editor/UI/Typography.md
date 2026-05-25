---
type: design
tags: [design, editor, ui, typography]
status: approved
created: 2026-05-24
related: ["[[Design/editor/UI/Color System]]", "[[Design/editor/UI/Component Library]]"]
---

# Editor — Tipografiya (Typography)

Editor admin panel uchun — form labellar, jadvallar, kod parchalar muhim.

---

## Font tanlovi

| Rol | Font | Sabab |
|-----|------|-------|
| UI Font | **Inter** | Dispatcher bilan bir xil (brend yaxlitligi) |
| Monospace | **JetBrains Mono** | IP manzillar, IOA kodlar, JSON ko'rish |
| Fallback | system-ui | |

---

## Type Scale

```
┌──────────┬───────────┬────────────┬────────────────────────────────────┐
│ Token    │ Size      │ Weight     │ Ishlatilish                         │
├──────────┼───────────┼────────────┼────────────────────────────────────┤
│ h1       │ 1.5rem    │ 700 Bold   │ Sahifa sarlavhasi ("Qurilmalar")    │
│ h2       │ 1.25rem   │ 600 Semi   │ Bo'lim sarlavhasi ("Asosiy ma'lumot")│
│ h3       │ 1.0rem    │ 600 Semi   │ Karta sarlavhasi, modal title       │
│ body-lg  │ 0.9375rem │ 400 Normal │ Keng matn, tavsif                  │
│ body     │ 0.875rem  │ 400 Normal │ Default (form labels, jadval)       │
│ body-sm  │ 0.8125rem │ 400 Normal │ Help text, validation message       │
│ caption  │ 0.75rem   │ 400 Normal │ Badge matn, timestamp               │
│ mono     │ 0.875rem  │ 400 Mono   │ IP manzil, IOA, JSON               │
│ mono-sm  │ 0.8125rem │ 400 Mono   │ Jadval ichida kod                   │
└──────────┴───────────┴────────────┴────────────────────────────────────┘
```

---

## Form Typography

```css
/* Label */
.form-label {
  font-size: 0.875rem;   /* 14px */
  font-weight: 500;
  color: var(--text);
  margin-bottom: 4px;
}

/* Required yulduzcha */
.form-label-required::after {
  content: ' *';
  color: var(--danger);
}

/* Input matn */
.form-input {
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--text);
}

/* Placeholder */
.form-input::placeholder {
  color: var(--text-secondary);
  font-weight: 400;
}

/* Help text */
.form-help {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* Validation error */
.form-error {
  font-size: 0.8125rem;
  color: var(--danger);
  margin-top: 4px;
}
```

---

## Monospace ishlatilishi

IP manzil, port, IOA, JSON fieldlar uchun:

```tsx
// IP manzil ko'rsatish
<span className="font-mono text-body bg-bg-hover px-1.5 py-0.5 rounded text-text-secondary">
  192.168.199.10:2404
</span>

// IOA kodi
<td className="font-mono text-mono-sm tabular-nums">
  {signal.register_code}
</td>
```

---

## Sahifa sarlavha tuzilmasi

```
┌────────────────────────────────────────────────────┐
│  h1: Yunusobod — Qurilmalar                        │
│  body-sm (secondary): 14 ta qurilma · 3 filial     │
│  ─────────────────────────────────────────────────  │
│  [+ Qurilma qo'shish]                [🔍 Qidirish] │
└────────────────────────────────────────────────────┘
```

---

## Qoidalar

1. **Form labellar** har doim 14px / 500 weight
2. **IP/port/IOA** har doim monospace
3. **Required field** qizil yulduzcha bilan belgilansin
4. **Help text** har doim label rangidan pastroq opacity
5. **Error matn** qizil, field ostiga chiqadi (field ustiga emas)
6. **Button matn** — Primary: 14px 500, Secondary: 14px 400

---

## Bog'liq
- [[Design/editor/UI/Color System]]
- [[Design/editor/UI/Component Library]]

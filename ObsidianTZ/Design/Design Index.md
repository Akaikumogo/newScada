---
type: moc
tags: [moc, design, ui, ux]
status: active
created: 2026-05-24
---

# Design — UI/UX Hujjatlari

newScada loyihasi uchun to'liq dizayn spesifikatsiyasi.
Ikkita dastur: **Dispatcher** (frontend) va **Editor** (EDITOR).

---

## Dispatcher (frontend) — Read-only Monitoring

Operatorlar uchun. Dark tema. Real-time.

### UI
| Fayl | Nima |
|------|------|
| [[Design/frontend/UI/Color System]] | Rang palitasi, dark mode, status ranglari |
| [[Design/frontend/UI/Typography]] | Inter + JetBrains Mono, type scale |
| [[Design/frontend/UI/Component Library]] | StatusBadge, SignalRow, DeviceCard, HistoryChart |
| [[Design/frontend/UI/Layout]] | Sidebar layout, 8px grid, breakpoints |

### UX
| Fayl | Nima |
|------|------|
| [[Design/frontend/UX/User Flows]] | 7 ta user flow, persona: Dispetcher operator |
| [[Design/frontend/UX/Wireframes]] | 5 ta ASCII wireframe, 1920×1080 |
| [[Design/frontend/UX/Interaction Patterns]] | Flash animatsiya, WS feedback, hover states |

---

## Editor (EDITOR) — Admin Konfiguratsiya Paneli

Texnik adminlar uchun. Light/dark dual tema. CRUD + Schema Editor.

### UI
| Fayl | Nima |
|------|------|
| [[Design/editor/UI/Color System]] | Light+dark dual mode, brand ranglari, schema canvas |
| [[Design/editor/UI/Typography]] | Form tipografiyasi, monospace ishlatilishi |
| [[Design/editor/UI/Component Library]] | Button, Input, DataTable, Modal, Schema Node |
| [[Design/editor/UI/Layout]] | TopBar tabs, Schema Editor 3-panel, spacing |

### UX
| Fayl | Nima |
|------|------|
| [[Design/editor/UX/User Flows]] | 7 ta user flow, persona: Admin texnik |
| [[Design/editor/UX/Wireframes]] | 6 ta ASCII wireframe, modal, schema editor |
| [[Design/editor/UX/Interaction Patterns]] | Form validation, optimistic update, undo/redo |

---

## Taqqoslash jadvali

| Xususiyat | Dispatcher | Editor |
|-----------|-----------|--------|
| Tema | Dark (faqat) | Light + Dark toggle |
| Font | Inter + JetBrains Mono | Inter + JetBrains Mono |
| Navigatsiya | Sidebar (podstansiyalar) | TopBar tabs |
| CRUD | Yo'q (read-only) | Ha (to'liq) |
| Real-time | Ha (WebSocket) | Yo'q (HTTP REST) |
| Schema | Ko'rish (read-only) | Tahrirlash (drag-drop) |
| Undo/Redo | Yo'q | Ha (50 qadam) |
| Target user | Dispetcher operator | Texnik admin |

---

## Dizayn Prinsiplari

1. **Tezlik** — Control room monitorlari uchun tezkor yuklash (skeleton → content)
2. **Aniqlik** — Signal qiymatlari har doim monospace, ustunlar tekis
3. **Xavfsizlik** — O'chirish uchun tasdiq, forma o'zgarishlar ogohlantirish
4. **Feedback** — Har bir harakat vizual javob beradi (flash, toast, loading)
5. **Konsistentlik** — Ikkala dastur bir xil token tizimi (Inter, 8px grid, brand blue)

---

## Bog'liq TZ hujjatlari
- [[04 - Editor]]
- [[05 - Dispatcher]]
- [[07 - Schema Editor]]
- [[features/F06 - Schema Editor]]
- [[features/F07 - Dispatcher View]]

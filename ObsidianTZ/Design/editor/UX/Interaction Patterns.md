---
type: design
tags: [design, editor, ux, interaction]
status: approved
created: 2026-05-24
related: ["[[Design/editor/UX/User Flows]]", "[[Design/editor/UI/Component Library]]", "[[07 - Schema Editor]]"]
---

# Editor — Interaksiya Namunalari (Interaction Patterns)

---

## 1. Form Validation — Real-time

**Qoida**: Foydalanuvchi field dan chiqsa (`onBlur`) validatsiya ishlaydi. Sahifa yuborilganda barcha maydonlar tekshiriladi.

```typescript
// react-hook-form + zod
const deviceSchema = z.object({
  name: z.string().min(1, "Nom kiritilishi shart").max(120),
  iec104_host: z.string().regex(
    /^(\d{1,3}\.){3}\d{1,3}$/,
    "Noto'g'ri IP manzil format"
  ),
  iec104_port: z.number().int().min(1).max(65535, "Port 1-65535 oralig'ida bo'lsin"),
  iec104_common_address: z.number().int().min(1).max(65535, "CASDU 1-65535"),
  poll_interval_seconds: z.number().min(0.5, "Minimal interval: 0.5 soniya"),
});
```

**Vizual xato ko'rsatish:**
```
1. Field border: border-default → border-danger
2. Xato matn: field ostida, text-danger, text-body-sm
3. Focus: field focus-ring → ring-danger/40
4. Form yuborildi, xato bor: avtomatik birinchi xato fieldga skroll
```

---

## 2. Optimistic Update — Tez UI

**Maqsad**: Foydalanuvchi [Saqlash] bosdi → UI darhol javob bersin, serverdan kutmaysin.

```typescript
// TanStack Query optimistic update
const createDevice = useMutation({
  mutationFn: deviceApi.create,
  onMutate: async (newDevice) => {
    await queryClient.cancelQueries({ queryKey: ['devices'] });
    const previous = queryClient.getQueryData(['devices']);
    queryClient.setQueryData(['devices'], (old: Device[]) => [...old, {
      ...newDevice, id: -1, createdAt: new Date().toISOString()
    }]);
    return { previous };
  },
  onError: (err, _, context) => {
    queryClient.setQueryData(['devices'], context?.previous);
    toast.error('Xato: ' + err.message);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['devices'] });
    toast.success('Qurilma qo'shildi ✓');
    closeModal();
  },
});
```

---

## 3. Modal — Ochilish / Yopilish

```
Modal ochilish:
  → Backdrop: opacity 0 → 0.5 (150ms)
  → Modal box: scale 0.95 + opacity 0 → scale 1 + opacity 1 (200ms)
  → Focus trap: Tab klavish modal ichida qoladi
  → Birinchi input avtomatik focused

Modal yopilish:
  → [✕] yoki [Bekor qilish] yoki Esc yoki backdrop click
  → Teskari animatsiya (150ms)
  → Focus: modal ochilgan trigger elementga qaytadi

Yopilish bloklanishi:
  → Forma o'zgartirilgan va saqlanmagan bo'lsa:
    "O'zgarishlar yo'qoladi. Davom etasizmi?"
    [Qolish]  [Ha, yop]
```

---

## 4. Delete Confirmation — Xavfsizlik qatlami

```
[🗑] bosildi
  → Tasdiqlash modal (W5 wireframe)
  → "Ha, o'chirish" tugmasi boshida DISABLED (0.5s himoya)
  → 0.5 soniyadan keyin ENABLED
  → Foydalanuvchi accidental double-click dan himoyalangan

Kod:
const [canDelete, setCanDelete] = useState(false);
useEffect(() => {
  if (isOpen) {
    const timer = setTimeout(() => setCanDelete(true), 500);
    return () => clearTimeout(timer);
  }
}, [isOpen]);
```

---

## 5. Schema Editor — Drag & Drop (React Flow)

```
NODE qo'shish:
  [+ Node ▼] → dropdown → tur tanlash
  → Canvas markaziga node qo'shildi
  → Node avtomatik tanlangan (properties panel ochiladi)
  → Foydalanuvchi node ni sichqoncha bilan joyiga sudrab qo'yadi

EDGE (ulanish) qo'shish:
  → Source node ning Handle (chiqish nuqtasi) ustiga hover
  → Cursor: crosshair
  → Sichqoncha bosib tortiladi → target node Handle ga
  → Edge yaratildi (animatsiyali chiziq)

NODE o'chirish:
  → Node tanlash (click) → Delete/Backspace
  → YOKI toolbar [🗑 O'chirish]
  → Tasdiqlash yo'q (Undo bor — 50 qadam)

MULTI-SELECT:
  → Shift + click → bir nechta node tanlash
  → Drag bo'sh joydan → selection box (lasso)
  → Tanlanganlari birga sudrab olib boriladi
```

---

## 6. Undo/Redo (zundo)

```
Ctrl+Z  → Undo (oxirgi harakat bekor)
Ctrl+Y  → Redo
Toolbar [↩][↺] — bir xil harakat

Limit: 50 qadam
Saqlangan holat: node positions + edges + properties
Saqlanmagan holat (undo dan tashqari): API call lar

Vizual:
  [↩] disabled bo'lsa: opacity 0.4, cursor-not-allowed
  [↺] disabled bo'lsa: opacity 0.4, cursor-not-allowed

Saqlash holati:
  O'zgarish bor: toolbar da sariq nuqta "[● Saqlanmagan]"
  Saqlangandan so'ng: "[✓ Saqlandi 14:35:12]"
  
Sahifani tark etish:
  O'zgarish bor + sahifani tark etmoqchi → brauzer before-unload
  "O'zgarishlar saqlanmagan. Chiqasizmi?"
```

---

## 7. Table — Sorting & Filtering

```
Column header click → Saralash:
  [Nomi ↑]  → alifbo bo'yicha o'sish
  [Nomi ↓]  → teskari
  [#  ]     → ID bo'yicha (default)

Filter:
  Filial select → URL query ?branch_id=1
  Podstansiya select → URL query ?substation_id=2
  Qidiruv → URL query ?q=BMRZ (debounced 300ms)

URL da filter → sahifa yangilananda saqlanadi
URL share → bir xil filterlash holatini ko'rish
```

---

## 8. Row Actions — Hover

```
Jadval qatorida amallar ikonalari:
  Default:   [📡] [✏] [🗑] — ko'rinadi
  Hover qatorda: background yangilanadi (bg-bg-hover)
  Icon hover: tooltip chiqadi ("Signallar", "Tahrirlash", "O'chirish")
```

---

## 9. Loading States

```
Jadval yuklanmoqda:
  → TableSkeleton (5 qator, 6 ustun)
  → animate-pulse

Button bosildi → server javobi kutilmoqda:
  → Button: disabled + spinner (loading indicator)
  → [💾 Saqlash...] ← matn o'zgaradi
  → Server javob bergach: normal yoki error

Modal submit:
  → Barcha fieldlar disabled
  → Submit button: spinner + disabled
```

---

## 10. Toast Notifications

```
Joylashuv: pastki o'ng burchak
Stack: bir nechta bo'lsa ustma-ust
Auto-dismiss: 3000ms (success), 5000ms (error)
Manual close: ✕ icon

Turlar:
  ✓ success → yashil chegarali karta
  ✗ error   → qizil chegarali karta (manual dismiss, auto yo'q)
  ⚠ warning → sariq chegarali karta
  ℹ info    → ko'k chegarali karta

Animatsiya:
  Kirib kelishi: slide-in-from-right 200ms
  Chiqishi:      fade-out + slide-out 150ms
```

---

## 11. Keyboard Shortcuts (Editor)

| Tugma | Harakat | Kontekst |
|-------|---------|---------|
| Ctrl+S | Saqlanish | Schema Editor |
| Ctrl+Z | Bekor qilish | Schema Editor |
| Ctrl+Y | Qaytarish | Schema Editor |
| Delete | Node o'chirish | Schema Editor (node tanlanganda) |
| Esc | Modal yopish / Tanlashni bekor | Har joyda |
| Enter | Forma yuborish | Modal form |
| Tab | Keyingi maydon | Form ichida |

---

## Bog'liq
- [[Design/editor/UX/User Flows]]
- [[Design/editor/UX/Wireframes]]
- [[Design/editor/UI/Component Library]]
- [[ADR/ADR-003 React Flow]]

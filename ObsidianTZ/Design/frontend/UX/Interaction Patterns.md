---
type: design
tags: [design, frontend, ux, interaction]
status: approved
created: 2026-05-24
related: ["[[Design/frontend/UX/User Flows]]", "[[Design/frontend/UI/Component Library]]"]
---

# Dispatcher — Interaksiya Namunalari (Interaction Patterns)

---

## 1. Real-time Flash — Qiymat yangilandi

**Sabab**: Operator qaysi signal o'zgarganini darhol ko'rishi kerak.

```
Hodisa:    WebSocket → SignalChangedEvent
Animatsiya: SignalRow fon rangi:
            0ms     → rgba(31, 111, 235, 0.15)   [ko'k tint]
            1200ms  → rgba(31, 111, 235, 0)       [yo'qoladi]
Duration:  1200ms
Easing:    ease-out

CSS:
@keyframes signal-flash {
  from { background-color: rgba(31, 111, 235, 0.15); }
  to   { background-color: transparent; }
}
```

**Qoida**: Bir vaqtning o'zida bir nechta signal yona oladi. Har birining animatsiyasi mustaqil.

---

## 2. Status Pulse — Online qurilma

**Sabab**: Operatorga "bu ma'lumot tirik" degan xabar.

```
Faqat ONLINE holatida yonadi
Animatsiya: StatusBadge nuqtasi
  0%   → opacity 1, scale 1
  50%  → opacity 0.4, scale 0.9
  100% → opacity 1, scale 1
Duration: 2000ms infinite

CSS:
@keyframes status-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
```

OFFLINE, WARNING holatlarda pulsatsiya **yo'q** — statik rang.

---

## 3. Hover States

| Element | Default | Hover | Active |
|---------|---------|-------|--------|
| Sidebar item | transparent | bg-bg-3 | bg-brand/10, text-brand |
| Device card | bg-bg-2, border-default | border-color lighten | — |
| Signal row | transparent | bg-bg-3 | cursor-pointer (click → history) |
| Schema node | default | cursor-pointer, shadow | ring-1 ring-brand |

```css
/* Signal row hover — pointer cursor faqat click bo'ladigan joylarda */
.signal-row-clickable:hover {
  cursor: pointer;
  background-color: var(--bg-3);
}

.signal-row-clickable:hover .signal-name {
  color: var(--brand);
}
```

---

## 4. Loading States

**Skeleton** → real ma'lumot o'tishi:
```
Dastlab:  DeviceCardSkeleton (pulse animatsiya)
WS snapshot kelgach:
  → Skeleton → DeviceCard
  → crossfade: 200ms opacity 0 → 1
  → Bir vaqtda barchasi almashinmasin, stagger: 50ms per card
```

**Stagger animatsiyasi:**
```css
.device-card:nth-child(1) { animation-delay: 0ms;   }
.device-card:nth-child(2) { animation-delay: 50ms;  }
.device-card:nth-child(3) { animation-delay: 100ms; }
/* ... va hokazo */
```

---

## 5. History Drawer — Ochilish/Yopilish

```
Click signal row
  → Drawer o'ngdan siljib chiqadi
  → Animatsiya: translateX(100%) → translateX(0)
  → Duration: 250ms, easing: ease-out
  → Overlay: bg-black/30 backdrop

Yopish:
  → X tugma yoki overlay click
  → translateX(0) → translateX(100%)
  → Duration: 200ms, easing: ease-in

ESC tugma ham yopadi (keyboard trap emas — dispatcher asosiy fonda ishlaydi)
```

---

## 6. Branch/Substation o'tish — Transition

```
Substation tanlanadi
  → URL change (React Router)
  → Eski content: opacity 1 → 0 (150ms)
  → Skeleton chiqadi (100ms)
  → Yangi content: opacity 0 → 1 (150ms)
  → Scroll to top: smooth
```

```typescript
// usePageTransition hook
const navigate = useNavigate();
const [isTransitioning, setIsTransitioning] = useState(false);

const handleNavigate = (path: string) => {
  setIsTransitioning(true);
  setTimeout(() => {
    navigate(path);
    setIsTransitioning(false);
  }, 150);
};
```

---

## 7. Offline Device — Visual Feedback

```
DeviceOfflineEvent keladi
  → DeviceCard border: border-offline (1px solid #F85149)
  → Header: StatusBadge → "● Offline" (qizil, pulsatsiz)
  → Signal qiymatlar: SAQLANADI (oxirgi ma'lum qiymat)
  → Vaqt label: "14:29:11 · (3 daqiqa oldin)"
  → Card ustida hover: tooltip chiqadi
     "Uzilgan: Connection refused (192.168.199.10)"
```

**Eslatma**: Dispatcher qiymatlarni o'chirmaydi — offline bo'lgan oxirgi qiymat ham muhim.

---

## 8. WebSocket Reconnection — User Feedback

```
WS disconnect
  1 soniya kutiladi (flap protection)
  → TopBar: ● Ulanmoqda... (sariq)
  → Banner: "WebSocket uzildi. Qayta ulanmoqda (1/5)..."
  → Ma'lumotlar eskirganligi ko'rsatiladi (stale tint)

WS reconnect (snapshot keldi)
  → Banner: 3 soniya "Qayta ulandi ✓" (yashil)
  → Banner yo'qoladi
  → Barcha qiymatlar yangilanadi (flash)
  → TopBar: ● Live (yashil)
```

---

## 9. Zustand Store (Dispatcher)

```typescript
// store/dispatcher.ts
interface DispatcherStore {
  // Server state (TanStack Query boshqaradi)
  // Real-time state (WebSocket)
  signals: Record<number, Record<string, SignalValue>>; // device_id → signal_name → value
  deviceStatuses: Record<number, 'online' | 'offline' | 'warning'>;
  wsState: 'connected' | 'connecting' | 'disconnected';

  // UI state
  selectedSubstationId: number | null;
  selectedBranchId: number | null;
  historyDrawer: { open: boolean; deviceId: number | null; signalName: string | null };

  // Actions
  setSignal: (deviceId: number, signalName: string, value: SignalValue) => void;
  setDeviceStatus: (deviceId: number, status: 'online' | 'offline') => void;
  setWsState: (state: 'connected' | 'connecting' | 'disconnected') => void;
  openHistory: (deviceId: number, signalName: string) => void;
  closeHistory: () => void;
}
```

---

## 10. Keyboard Navigation

| Tugma | Harakat |
|-------|---------|
| Esc | History drawer yopish |
| ← / → | Signal tarix vaqt oralig'ini o'zgartirish |
| F5 | Sahifani yangilash (oddiy brauzer) |
| Tab | Podstansiya listda navigatsiya |

**Qoida**: Dispatcher keyboard-friendly bo'lishi shart emas (mouse/touchscreen control room), lekin accessibility uchun Tab/Enter ishlaydi.

---

## Bog'liq
- [[Design/frontend/UX/User Flows]]
- [[Design/frontend/UX/Wireframes]]
- [[Design/frontend/UI/Component Library]]
- [[Architecture/WebSocket Strategy]]

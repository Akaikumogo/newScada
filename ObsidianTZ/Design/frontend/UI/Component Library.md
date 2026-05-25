---
type: design
tags: [design, frontend, ui, components]
status: approved
created: 2026-05-24
related: ["[[Design/frontend/UI/Color System]]", "[[Design/frontend/UI/Typography]]", "[[Design/frontend/UI/Layout]]", "[[05 - Dispatcher]]"]
---

# Dispatcher — Komponent Kutubxonasi (Component Library)

Barcha komponentlar **read-only** — Dispatcher faqat ko'rish uchun, tahrirlash yo'q.

---

## 1. StatusBadge

Qurilma holati uchun raqli indikator.

```tsx
// components/ui/StatusBadge.tsx
type Status = 'online' | 'offline' | 'warning' | 'unknown' | 'stale';

const STATUS_CONFIG: Record<Status, { label: string; color: string; dot: string }> = {
  online:  { label: 'Online',   color: 'text-online',  dot: 'bg-online'  },
  offline: { label: 'Offline',  color: 'text-offline', dot: 'bg-offline' },
  warning: { label: 'Warning',  color: 'text-warning', dot: 'bg-warning' },
  unknown: { label: 'Unknown',  color: 'text-unknown', dot: 'bg-unknown' },
  stale:   { label: 'Stale',    color: 'text-stale',   dot: 'bg-stale'   },
};

export function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-caption font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse-if-online`} />
      {cfg.label}
    </span>
  );
}
```

**Vizual:**
```
● Online   ← yashil, pulsatsiya
● Offline  ← qizil, statik
● Warning  ← sariq, sekin pulsatsiya
● Unknown  ← kulrang, statik
```

---

## 2. SignalRow

Bitta signal qiymatini ko'rsatish uchun jadval qatori.

```tsx
// components/dispatcher/SignalRow.tsx
interface SignalRowProps {
  name: string;       // "Ia"
  title: string;      // "Tok A fazasi"
  value: number | null;
  unit: string;       // "A"
  quality: number;    // 0 = good, >0 = bad
  updatedAt: string;  // ISO timestamp
  isChanged?: boolean; // flash animation
}

export function SignalRow({ name, title, value, unit, quality, isChanged }: SignalRowProps) {
  return (
    <tr className={`border-b border-border-subtle hover:bg-bg-3 transition-colors ${isChanged ? 'animate-flash' : ''}`}>
      <td className="py-1.5 px-3 text-body text-text-secondary w-12">{name}</td>
      <td className="py-1.5 px-3 text-body text-text-secondary">{title}</td>
      <td className="py-1.5 px-3 text-right">
        <span className="font-mono text-body text-text-primary tabular-nums">
          {value !== null ? value.toFixed(2) : '—'}
        </span>
      </td>
      <td className="py-1.5 px-3 text-caption text-text-secondary w-10">{unit}</td>
      <td className="py-1.5 px-3 w-6">
        <QualityDot quality={quality} />
      </td>
    </tr>
  );
}
```

**Flash animatsiya** — qiymat o'zganda:
```css
@keyframes flash {
  0%   { background-color: #1F6FEB1A; }
  100% { background-color: transparent; }
}
.animate-flash {
  animation: flash 1.2s ease-out;
}
```

---

## 3. DeviceCard

Qurilma kartasi — barcha signallar ro'yxati bilan.

```
┌──────────────────────────────────────────────────┐
│ [●] BMRZ-153 №1                    [Online]      │  ← header bg-2
│     192.168.199.10:2404                          │
├──────────────────────────────────────────────────┤
│  Ia    Tok A fazasi         245.30   A   ●        │
│  Ib    Tok B fazasi         244.80   A   ●        │
│  Ic    Tok C fazasi         246.10   A   ●        │
│  Ua    Kuchlanish A         10.40   kV   ●        │
│  P     Faol quvvat           5.20   MW   ●        │
├──────────────────────────────────────────────────┤
│  Yangilandi: 14:32:05.123                        │  ← footer
└──────────────────────────────────────────────────┘
```

---

## 4. SubstationHeader

Podstansiya sarlavhasi paneli.

```tsx
export function SubstationHeader({ name, branchName, onlineCount, totalCount }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-bg-2 border-b border-border">
      <div>
        <h2 className="text-h2 text-text-primary">{name}</h2>
        <p className="text-caption text-text-secondary">{branchName}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-online font-mono text-h3">{onlineCount}</span>
        <span className="text-text-secondary text-body">/ {totalCount} online</span>
      </div>
    </div>
  );
}
```

---

## 5. ConnectionIndicator (WebSocket holati)

```tsx
type WsState = 'connected' | 'connecting' | 'disconnected';

export function ConnectionIndicator({ state }: { state: WsState }) {
  const config = {
    connected:    { color: 'bg-online',  label: 'Live',         pulse: true  },
    connecting:   { color: 'bg-warning', label: 'Ulanmoqda...', pulse: true  },
    disconnected: { color: 'bg-offline', label: 'Uzilgan',      pulse: false },
  }[state];

  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-bg-3 border border-border">
      <span className={`w-2 h-2 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`} />
      <span className="text-caption text-text-secondary">{config.label}</span>
    </div>
  );
}
```

---

## 6. HistoryChart

Tarix grafigi — Recharts asosida.

```tsx
// components/dispatcher/HistoryChart.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export function HistoryChart({ data, signalName, unit }: HistoryChartProps) {
  return (
    <div className="bg-bg-2 rounded-lg border border-border p-4">
      <h3 className="text-h3 text-text-primary mb-4">{signalName}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis
            dataKey="ts"
            tickFormatter={ts => format(new Date(ts), 'HH:mm')}
            stroke="#8B949E"
            tick={{ fill: '#8B949E', fontSize: 11 }}
          />
          <YAxis
            stroke="#8B949E"
            tick={{ fill: '#8B949E', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            unit={` ${unit}`}
          />
          <Tooltip
            contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 8 }}
            labelStyle={{ color: '#8B949E' }}
            itemStyle={{ color: '#E6EDF3', fontFamily: 'JetBrains Mono' }}
          />
          <Line
            type="stepAfter"
            dataKey="value"
            stroke="#1F6FEB"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: '#388BFD' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 7. Skeleton Loader

Ma'lumot yuklanayotganda skeleton ko'rsatish:

```tsx
export function DeviceCardSkeleton() {
  return (
    <div className="bg-bg-2 rounded-lg border border-border p-4 animate-pulse">
      <div className="h-5 bg-bg-3 rounded w-48 mb-2" />
      <div className="h-4 bg-bg-3 rounded w-32 mb-4" />
      {[1,2,3,4,5].map(i => (
        <div key={i} className="flex justify-between py-1.5">
          <div className="h-4 bg-bg-3 rounded w-24" />
          <div className="h-4 bg-bg-3 rounded w-16" />
        </div>
      ))}
    </div>
  );
}
```

---

## 8. EmptyState

Ma'lumot yo'q holatida:

```tsx
export function EmptyState({ title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-4">📡</div>
      <h3 className="text-h3 text-text-primary mb-2">{title}</h3>
      <p className="text-body text-text-secondary max-w-sm">{description}</p>
    </div>
  );
}
```

---

## Komponent ierarxiyasi

```
App
└── Layout
    ├── TopBar
    │   ├── Logo
    │   ├── BranchSelector
    │   └── ConnectionIndicator
    ├── Sidebar
    │   └── SubstationList
    │       └── SubstationItem (link)
    └── MainContent
        ├── SubstationHeader
        ├── DeviceGrid
        │   └── DeviceCard[]
        │       ├── DeviceCardHeader (StatusBadge)
        │       ├── SignalTable
        │       │   └── SignalRow[]
        │       └── DeviceCardFooter (timestamp)
        └── SchemaViewer (read-only React Flow)
```

---

## Bog'liq
- [[Design/frontend/UI/Color System]]
- [[Design/frontend/UI/Typography]]
- [[Design/frontend/UI/Layout]]
- [[Design/frontend/UX/Interaction Patterns]]

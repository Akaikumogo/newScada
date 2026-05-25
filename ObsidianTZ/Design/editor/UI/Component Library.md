---
type: design
tags: [design, editor, ui, components]
status: approved
created: 2026-05-24
related: ["[[Design/editor/UI/Color System]]", "[[Design/editor/UI/Typography]]", "[[Design/editor/UI/Layout]]", "[[04 - Editor]]", "[[07 - Schema Editor]]"]
---

# Editor — Komponent Kutubxonasi (Component Library)

Editor **yozish** uchun — CRUD formalar, jadvallar, modal oynalar, schema canvas.

---

## 1. Button

```tsx
// components/ui/Button.tsx
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
type Size = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES = {
  primary:   'bg-brand text-white hover:bg-brand-hover border-transparent',
  secondary: 'bg-bg-card text-text border-border hover:bg-bg-hover',
  danger:    'bg-danger text-white hover:bg-red-700 border-transparent',
  ghost:     'bg-transparent text-text hover:bg-bg-hover border-transparent',
  link:      'bg-transparent text-brand hover:underline border-transparent p-0',
};

const SIZE_CLASSES = {
  sm: 'h-7  px-3 text-caption gap-1.5',
  md: 'h-9  px-4 text-body   gap-2',
  lg: 'h-11 px-5 text-body-lg gap-2',
};
```

**Vizual:**
```
[+ Qurilma qo'shish]   ← Primary (ko'k)
[Bekor qilish]          ← Secondary (chegarali)
[O'chirish]             ← Danger (qizil)
[Tahrirlash]            ← Ghost
```

---

## 2. Input / Textarea

```tsx
// components/ui/Input.tsx
export function Input({ label, required, helpText, error, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-body font-medium text-text">
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <input
        className={`
          h-9 px-3 rounded-md border text-body
          bg-bg-card text-text placeholder:text-text-disabled
          focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-danger' : 'border-border'}
        `}
        {...props}
      />
      {helpText && !error && (
        <p className="text-body-sm text-text-secondary">{helpText}</p>
      )}
      {error && (
        <p className="text-body-sm text-danger">{error}</p>
      )}
    </div>
  );
}
```

---

## 3. Select

```tsx
export function Select({ label, required, options, error, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-body font-medium text-text">
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <select
        className={`
          h-9 px-3 rounded-md border text-body
          bg-bg-card text-text
          focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand
          ${error ? 'border-danger' : 'border-border'}
        `}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-body-sm text-danger">{error}</p>}
    </div>
  );
}
```

---

## 4. DataTable

CRUD jadvali — Branch, Substation, Device, Signal uchun.

```
┌────┬──────────────────┬────────────────┬────────────┬─────────────┐
│ #  │ Nomi             │ Substation     │ Protocol   │ Amallar     │
├────┼──────────────────┼────────────────┼────────────┼─────────────┤
│  1 │ BMRZ-153 №1      │ Yunusobod PS   │ IEC104     │ [✏] [🗑]   │
│  2 │ BMRZ-153 №2      │ Yunusobod PS   │ IEC104     │ [✏] [🗑]   │
│  3 │ Relay №1         │ Chilonzor PS   │ IEC104     │ [✏] [🗑]   │
└────┴──────────────────┴────────────────┴────────────┴─────────────┘
```

```tsx
// components/ui/DataTable.tsx
export function DataTable<T>({ columns, data, onEdit, onDelete, isLoading }: DataTableProps<T>) {
  if (isLoading) return <TableSkeleton columns={columns.length} />;
  if (!data.length) return <EmptyState title="Ma'lumot yo'q" />;
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-body">
        <thead className="bg-bg-hover text-text-secondary border-b border-border">
          <tr>
            {columns.map(col => (
              <th key={col.key} className="px-4 py-2.5 text-left font-medium text-caption">
                {col.label}
              </th>
            ))}
            <th className="px-4 py-2.5 text-right text-caption">Amallar</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-border-subtle hover:bg-bg-hover transition-colors">
              {columns.map(col => (
                <td key={col.key} className="px-4 py-2.5 text-text">
                  {col.render ? col.render(row) : String((row as any)[col.key])}
                </td>
              ))}
              <td className="px-4 py-2.5">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(row)}
                    className="text-danger hover:bg-danger/10">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 5. Modal (Dialog)

```tsx
// components/ui/Modal.tsx
export function Modal({ title, isOpen, onClose, size = 'md', children, footer }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-bg-card rounded-xl border border-border shadow-xl
        ${size === 'sm' ? 'w-96' : size === 'md' ? 'w-[560px]' : 'w-[800px]'}
        max-h-[90vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-h3 text-text">{title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text p-1 rounded">
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-bg-hover rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 6. Toast / Notification

```tsx
// Savol → Natija bildirish
toast.success('Qurilma saqlandi');
toast.error('Xato: IP manzil noto\'g\'ri');
toast.warning('Ogohlantirish: Signal allaqachon mavjud');

// Vizual:
// ┌────────────────────────────────────┐
// │ ✓ Qurilma saqlandi                 │  ← pastki o'ng, yashil
// └────────────────────────────────────┘
// Duration: 3000ms, auto-dismiss
// Animatsiya: slide-in from right
```

---

## 7. Signal Config Row (F05 uchun)

Signal konfiguratsiya jadvalidagi qator — inline edit bilan:

```
┌──────┬──────────────────┬──────────────────────┬──────────┬───────────┬──────────┐
│ IOA  │ Signal Name      │ Title                │ Unit     │ Type      │ Amallar  │
├──────┼──────────────────┼──────────────────────┼──────────┼───────────┼──────────┤
│ 1000 │ Ia               │ Tok A fazasi          │ A        │ float     │ [✏][🗑] │
│ 1001 │ Ib               │ Tok B fazasi          │ A        │ float     │ [✏][🗑] │
│ 2000 │ CB_status        │ Kommutator holati     │          │ status    │ [✏][🗑] │
└──────┴──────────────────┴──────────────────────┴──────────┴───────────┴──────────┘
```

**IOA ustun** — monospace font, right-aligned.

---

## 8. Schema Node (React Flow)

```tsx
// Schema Editor uchun maxsus node
export function DeviceNode({ data, selected }: NodeProps<DeviceNodeData>) {
  return (
    <div className={`
      bg-bg-card border-2 rounded-lg p-3 min-w-[160px] shadow-sm
      ${selected ? 'border-brand shadow-brand/20 shadow-lg' : 'border-border'}
    `}>
      {/* Type badge */}
      <div className={`text-caption font-medium px-1.5 py-0.5 rounded mb-2 inline-block
        ${TYPE_COLORS[data.deviceType]}`}>
        {data.deviceType}
      </div>
      {/* Nomi */}
      <div className="text-body font-medium text-text">{data.label}</div>
      {/* Signal qiymatlari (live) */}
      {data.signals?.map(sig => (
        <div key={sig.name} className="flex justify-between mt-1 text-body-sm">
          <span className="text-text-secondary">{sig.name}</span>
          <span className="font-mono text-text">{sig.value} {sig.unit}</span>
        </div>
      ))}
      {/* Handles (connection points) */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

---

## Komponent ierarxiyasi (Editor)

```
App (Editor)
└── Layout
    ├── TopBar
    │   ├── Logo
    │   ├── Navigation tabs [Filiallar | Podstansiyalar | Qurilmalar | Modellar]
    │   └── ThemeToggle (light/dark)
    ├── Sidebar (bo'limlar)
    └── MainContent
        ├── PageHeader (h1 + action buttons)
        ├── DataTable (CRUD list)
        └── Modal (create/edit form)

Schema Editor sahifa:
    ├── Toolbar (save, zoom, add node, delete)
    ├── ReactFlow canvas
    │   └── DeviceNode[]
    │       └── Handle (connection points)
    └── PropertiesPanel (right, tanlangan node xususiyatlari)
```

---

## Bog'liq
- [[Design/editor/UI/Color System]]
- [[Design/editor/UI/Typography]]
- [[Design/editor/UI/Layout]]
- [[Design/editor/UX/Interaction Patterns]]
- [[07 - Schema Editor]]

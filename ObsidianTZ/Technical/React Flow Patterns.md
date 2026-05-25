---
type: technical
tags: [technical, frontend, react-flow, schema-editor, patterns]
status: reference
created: 2026-05-24
related: ["[[features/F06 - Schema Editor]]", "[[ADR/ADR-003 React Flow]]"]
---

# React Flow Patterns — Schema Editor arxitekturasi

---

## Node registry pattern

```typescript
// editor/nodes/registry.ts
import type { NodeTypes } from "@xyflow/react";

import { BusBarNode }          from "./electrical/BusBarNode";
import { TransformerNode }     from "./electrical/TransformerNode";
import { CircuitBreakerNode }  from "./electrical/CircuitBreakerNode";
import { DisconnectorNode }    from "./electrical/DisconnectorNode";
import { EarthSwitchNode }     from "./electrical/EarthSwitchNode";
import { CTNode }              from "./electrical/CTNode";
import { VTNode }              from "./electrical/VTNode";
import { LabelNode }           from "./general/LabelNode";
import { RectNode }            from "./general/RectNode";
import { ArrowNode }           from "./general/ArrowNode";
import { DeviceBlockNode }     from "./data/DeviceBlockNode";
import { SignalDisplayNode }   from "./data/SignalDisplayNode";
import { StatusIndicatorNode } from "./data/StatusIndicatorNode";

export const NODE_TYPES: NodeTypes = {
  bus_bar:          BusBarNode,
  transformer:      TransformerNode,
  circuit_breaker:  CircuitBreakerNode,
  disconnector:     DisconnectorNode,
  earth_switch:     EarthSwitchNode,
  ct:               CTNode,
  vt:               VTNode,
  label:            LabelNode,
  rectangle:        RectNode,
  arrow:            ArrowNode,
  device_block:     DeviceBlockNode,
  signal_display:   SignalDisplayNode,
  status_indicator: StatusIndicatorNode,
};

// Komponent palitrasidagi ma'lumotlar (chap panel)
export const NODE_PALETTE = [
  {
    category: "Elektr",
    items: [
      { type: "bus_bar",         label: "Shina",         icon: "─" },
      { type: "transformer",     label: "Transformator", icon: "⊕" },
      { type: "circuit_breaker", label: "Avtomatik",     icon: "□" },
      { type: "disconnector",    label: "Ajratgich",     icon: "—" },
      { type: "earth_switch",    label: "Zamin",         icon: "⏚" },
      { type: "ct",              label: "CT",            icon: "⊙" },
      { type: "vt",              label: "VT",            icon: "◎" },
    ],
  },
  {
    category: "Grafik",
    items: [
      { type: "label",     label: "Yorliq",       icon: "T" },
      { type: "rectangle", label: "To\'rtburchak", icon: "▭" },
      { type: "arrow",     label: "Strelka",      icon: "→" },
    ],
  },
  {
    category: "Ma'lumot",
    items: [
      { type: "device_block",     label: "Qurilma bloki",  icon: "⊞" },
      { type: "signal_display",   label: "Signal",         icon: "◉" },
      { type: "status_indicator", label: "Status",         icon: "●" },
    ],
  },
];
```

---

## DeviceBlock — expand/collapse pattern

```typescript
// editor/nodes/data/DeviceBlockNode.tsx
import { useState, useCallback } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";

export interface DeviceBlockData {
  deviceId: number;
  deviceName: string;
  modelName: string;
  signals: { name: string; title: string; unit: string }[];
  style: NodeStyle;
}

export function DeviceBlockNode({ data, selected }: NodeProps<DeviceBlockData>) {
  const [expanded, setExpanded] = useState(false);
  const liveValues = useLiveDeviceValues(data.deviceId);  // WS hook

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 300ms hold → expand
    const timer = setTimeout(() => setExpanded(true), 300);
    const cancel = () => clearTimeout(timer);
    e.currentTarget.addEventListener("mouseup", cancel, { once: true });
    e.currentTarget.addEventListener("mouseleave", cancel, { once: true });
  }, []);

  return (
    <div
      className="device-block"
      style={{
        background: data.style.fill,
        border: `${data.style.borderWidth}px solid ${data.style.borderColor}`,
        borderRadius: data.style.borderRadius,
        opacity: data.style.opacity,
        minWidth: expanded ? 220 : 160,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="device-block__header">
        <span>{data.deviceName}</span>
        <span className="text-xs text-muted">{data.modelName}</span>
      </div>

      {/* Compact view */}
      {!expanded && (
        <div className="device-block__compact">
          {data.signals.slice(0, 2).map((s) => (
            <span key={s.name}>
              {s.name.toUpperCase()}: {liveValues[s.name]?.toFixed(1) ?? "—"} {s.unit}
            </span>
          ))}
        </div>
      )}

      {/* Expanded: signallar drag-handle bilan */}
      {expanded && (
        <div className="device-block__signals">
          {data.signals.map((s) => (
            <DraggableSignalRow
              key={s.name}
              deviceId={data.deviceId}
              signal={s}
              value={liveValues[s.name]}
            />
          ))}
          <button onClick={() => setExpanded(false)} className="collapse-btn">
            ▲ Yig'ish
          </button>
        </div>
      )}

      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
}
```

---

## Zustand — Editor state management

```typescript
// editor/store/editorStore.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { temporal } from "zundo";  // Undo/Redo uchun
import type { Node, Edge } from "@xyflow/react";

interface EditorStore {
  nodes: Node[];
  edges: Edge[];
  selectedIds: string[];
  clipboard: (Node | Edge)[];
  isDirty: boolean;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  selectAll: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  deleteSelected: () => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  updateNodeStyle: (id: string, style: Partial<NodeStyle>) => void;
  saveSchema: () => Promise<void>;
  loadSchema: (substationId: number) => Promise<void>;
}

export const useEditorStore = create<EditorStore>()(
  temporal(
    immer((set, get) => ({
      nodes: [],
      edges: [],
      selectedIds: [],
      clipboard: [],
      isDirty: false,

      bringForward: (id) => set((state) => {
        const node = state.nodes.find((n) => n.id === id);
        if (node) node.data.style.zIndex = (node.data.style.zIndex ?? 0) + 1;
        state.isDirty = true;
      }),

      updateNodeStyle: (id, style) => set((state) => {
        const node = state.nodes.find((n) => n.id === id);
        if (node) Object.assign(node.data.style, style);
        state.isDirty = true;
      }),

      saveSchema: async () => {
        const { nodes, edges } = get();
        await api.put(`/api/substations/${substationId}/schema`, {
          canvas_json: JSON.stringify({ nodes, edges, version: 1 }),
        });
        set((state) => { state.isDirty = false; });
      },
    })),
    { limit: 50 }  // 50 ta undo qadam
  )
);

// Undo/Redo:
// const { undo, redo, canUndo, canRedo } = useEditorStore.temporal.getState();
```

---

## Keyboard shortcuts

```typescript
// editor/hooks/useEditorShortcuts.ts
import { useEffect } from "react";
import { useEditorStore } from "../store/editorStore";

export function useEditorShortcuts() {
  const store = useEditorStore();
  const { undo, redo } = useEditorStore.temporal.getState();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "z") { e.preventDefault(); undo(); }
      if (mod && e.key === "y") { e.preventDefault(); redo(); }
      if (mod && e.key === "a") { e.preventDefault(); store.selectAll(); }
      if (mod && e.key === "c") { store.copySelected(); }
      if (mod && e.key === "v") { store.pasteClipboard(); }
      if (mod && e.key === "d") { e.preventDefault(); store.duplicateSelected(); }
      if (mod && e.key === "s") { e.preventDefault(); store.saveSchema(); }
      if (e.key === "Delete" || e.key === "Backspace") {
        if ((e.target as Element).tagName !== "INPUT") {
          store.deleteSelected();
        }
      }
      if (e.key === "g") { store.toggleGrid(); }
      if (e.key === "Escape") { store.clearSelection(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store, undo, redo]);
}
```

---

## Drag qurilma → sxema

```typescript
// editor/components/DevicePanel.tsx
function DevicePanel({ substationId }: { substationId: number }) {
  const { data: devices } = useDevices(substationId);

  const onDragStart = (e: React.DragEvent, device: Device) => {
    e.dataTransfer.setData(
      "application/reactflow",
      JSON.stringify({ type: "device_block", deviceId: device.id })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="device-panel">
      {devices?.map((d) => (
        <div
          key={d.id}
          draggable
          onDragStart={(e) => onDragStart(e, d)}
          className="device-item"
        >
          <span>{d.name}</span>
          <span className="text-xs">{d.model.name}</span>
        </div>
      ))}
    </div>
  );
}

// SchemaEditor.tsx — drop handler
const onDrop = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  const raw = e.dataTransfer.getData("application/reactflow");
  if (!raw) return;
  const { type, deviceId } = JSON.parse(raw);

  const position = screenToFlowPosition({
    x: e.clientX, y: e.clientY,
  });

  const newNode: Node = {
    id: nanoid(),
    type,
    position,
    data: {
      deviceId,
      style: DEFAULT_STYLE,
    },
  };
  addNodes([newNode]);
}, [screenToFlowPosition, addNodes]);
```

---

## Bog'liq
- [[features/F06 - Schema Editor]]
- [[ADR/ADR-003 React Flow]]

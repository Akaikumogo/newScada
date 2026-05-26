/**
 * SCADA Schema Nodes — Dispatcher edition (live data)
 * ───────────────────────────────────────────────────
 *
 * Same visual primitives as EDITOR's SchemaNodes, but with WS-driven
 * live data injection for DeviceNode and SignalValueNode via Zustand.
 */
import { memo, useEffect, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Cpu, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { useDispatcherStore } from '@/store/dispatcher'

const HANDLE_STYLE: React.CSSProperties = {
  width:  8,
  height: 8,
  background: 'var(--bg-card)',
  border: '1.5px solid var(--electric)',
}

function FourHandles() {
  return (
    <>
      <Handle id="t" type="source" position={Position.Top}    style={HANDLE_STYLE} />
      <Handle id="b" type="source" position={Position.Bottom} style={HANDLE_STYLE} />
      <Handle id="l" type="source" position={Position.Left}   style={HANDLE_STYLE} />
      <Handle id="r" type="source" position={Position.Right}  style={HANDLE_STYLE} />
    </>
  )
}

// ── Bus ───────────────────────────────────────────
export const BusNode = memo(function BusNode({ data }: NodeProps) {
  const d = (data ?? {}) as any
  const horizontal = (d.orientation ?? 'horizontal') === 'horizontal'
  const length = d.length ?? 240
  const color  = d.color ?? '#2979FF'
  const w = horizontal ? length : 8
  const h = horizontal ? 8      : length

  return (
    <div className={`relative flex ${horizontal ? 'flex-col' : 'flex-row'} items-center gap-2`}
         style={{ width: w + 24, height: h + 24, padding: 12 }}>
      {d.voltage && (
        <div className={`absolute ${horizontal ? '-top-1 left-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2 -left-12'} text-[11px] font-mono font-bold text-[var(--text)]`}>
          {d.voltage}
        </div>
      )}
      <div className="rounded-sm shadow-[0_0_8px_rgba(41,121,255,0.4)]"
           style={{ width: w, height: h, background: `linear-gradient(${horizontal ? '180deg' : '90deg'}, ${color}, ${color}dd)` }} />
      <Handle id="a" type="source" position={horizontal ? Position.Top : Position.Left} style={{ ...HANDLE_STYLE, [horizontal ? 'left' : 'top']: '25%' }} />
      <Handle id="b" type="source" position={horizontal ? Position.Top : Position.Left} style={{ ...HANDLE_STYLE, [horizontal ? 'left' : 'top']: '50%' }} />
      <Handle id="c" type="source" position={horizontal ? Position.Top : Position.Left} style={{ ...HANDLE_STYLE, [horizontal ? 'left' : 'top']: '75%' }} />
      <Handle id="d" type="source" position={horizontal ? Position.Bottom : Position.Right} style={{ ...HANDLE_STYLE, [horizontal ? 'left' : 'top']: '25%' }} />
      <Handle id="e" type="source" position={horizontal ? Position.Bottom : Position.Right} style={{ ...HANDLE_STYLE, [horizontal ? 'left' : 'top']: '50%' }} />
      <Handle id="f" type="source" position={horizontal ? Position.Bottom : Position.Right} style={{ ...HANDLE_STYLE, [horizontal ? 'left' : 'top']: '75%' }} />
    </div>
  )
})

// ── Breaker ───────────────────────────────────────
export const BreakerNode = memo(function BreakerNode({ data }: NodeProps) {
  const d = (data ?? {}) as any

  // Live state: if bound to device/signal, use live value (status: 0 = open, 1 = closed)
  const liveValue = useDispatcherStore(s =>
    d.device_id && d.signal_name ? s.signals[d.device_id]?.[d.signal_name]?.value : undefined
  )
  const open = liveValue != null
    ? liveValue === 0
    : d.state === 'open'

  const color = open ? '#FF3D71' : '#00D68F'

  return (
    <div className="relative flex flex-col items-center gap-1" style={{ padding: 12 }}>
      <svg width="32" height="32" viewBox="0 0 32 32">
        <line x1="16" y1="0"  x2="16" y2="6"  stroke="var(--text)" strokeWidth="1.5" />
        <line x1="16" y1="26" x2="16" y2="32" stroke="var(--text)" strokeWidth="1.5" />
        <rect x="6" y="6" width="20" height="20"
              fill={open ? 'transparent' : color} stroke={color} strokeWidth="2" rx="2" />
        {open && (
          <>
            <line x1="9"  y1="9"  x2="23" y2="23" stroke={color} strokeWidth="2" />
            <line x1="23" y1="9"  x2="9"  y2="23" stroke={color} strokeWidth="2" />
          </>
        )}
      </svg>
      {d.label && <div className="text-[10px] font-mono text-[var(--text)]">{d.label}</div>}
      <FourHandles />
    </div>
  )
})

// ── Disconnector ──────────────────────────────────
export const DisconnectorNode = memo(function DisconnectorNode({ data }: NodeProps) {
  const d = (data ?? {}) as any
  const liveValue = useDispatcherStore(s =>
    d.device_id && d.signal_name ? s.signals[d.device_id]?.[d.signal_name]?.value : undefined
  )
  const open = liveValue != null ? liveValue === 0 : d.state === 'open'

  return (
    <div className="relative flex flex-col items-center gap-1" style={{ padding: 12 }}>
      <svg width="32" height="32" viewBox="0 0 32 32">
        <line x1="16" y1="0"  x2="16" y2="8"  stroke="var(--text)" strokeWidth="1.5" />
        <line x1="16" y1="24" x2="16" y2="32" stroke="var(--text)" strokeWidth="1.5" />
        <circle cx="16" cy="8"  r="2" fill="var(--text)" />
        <circle cx="16" cy="24" r="2" fill="var(--text)" />
        {open
          ? <line x1="16" y1="8" x2="26" y2="20" stroke="#FFAA00" strokeWidth="2" strokeLinecap="round" />
          : <line x1="16" y1="8" x2="16" y2="24" stroke="#00D68F" strokeWidth="2" strokeLinecap="round" />
        }
      </svg>
      {d.label && <div className="text-[10px] font-mono text-[var(--text)]">{d.label}</div>}
      <FourHandles />
    </div>
  )
})

// ── Transformer ───────────────────────────────────
export const TransformerNode = memo(function TransformerNode({ data }: NodeProps) {
  const d = (data ?? {}) as any
  const windings = d.windings ?? 2
  return (
    <div className="relative flex flex-col items-center gap-1" style={{ padding: 12 }}>
      <svg width="40" height={windings === 3 ? 56 : 48} viewBox={`0 0 40 ${windings === 3 ? 56 : 48}`}>
        <line x1="20" y1="0" x2="20" y2="8" stroke="var(--text)" strokeWidth="1.5" />
        <circle cx="20" cy="14" r="8" fill="none" stroke="#FFAA00" strokeWidth="1.5" />
        <circle cx="20" cy="26" r="8" fill="none" stroke="#FFAA00" strokeWidth="1.5" />
        {windings === 3 && <circle cx="20" cy="38" r="8" fill="none" stroke="#FFAA00" strokeWidth="1.5" />}
        <line x1="20" y1={windings === 3 ? 48 : 36} x2="20" y2={windings === 3 ? 56 : 48} stroke="var(--text)" strokeWidth="1.5" />
      </svg>
      {(d.label || d.rating) && (
        <div className="text-[10px] font-mono text-[var(--text)] text-center">
          {d.label}
          {d.rating && <div className="text-ink-300">{d.rating}</div>}
        </div>
      )}
      <FourHandles />
    </div>
  )
})

// ── Ground ────────────────────────────────────────
export const GroundNode = memo(function GroundNode({ data }: NodeProps) {
  const d = (data ?? {}) as any
  return (
    <div className="relative flex flex-col items-center" style={{ padding: 8 }}>
      <svg width="24" height="24" viewBox="0 0 24 24">
        <line x1="12" y1="0"  x2="12" y2="10" stroke="var(--text)" strokeWidth="1.5" />
        <line x1="3"  y1="11" x2="21" y2="11" stroke="var(--text)" strokeWidth="2" />
        <line x1="6"  y1="15" x2="18" y2="15" stroke="var(--text)" strokeWidth="1.5" />
        <line x1="9"  y1="19" x2="15" y2="19" stroke="var(--text)" strokeWidth="1.5" />
      </svg>
      {d.label && <div className="text-[9px] text-ink-300">{d.label}</div>}
      <Handle id="t" type="source" position={Position.Top} style={HANDLE_STYLE} />
    </div>
  )
})

// ── Voltage Label ─────────────────────────────────
export const VoltageLabelNode = memo(function VoltageLabelNode({ data }: NodeProps) {
  const d = (data ?? {}) as any
  return (
    <div className="px-3 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--electric)]/40"
         style={{ color: d.color ?? 'var(--electric)' }}>
      <span style={{ fontSize: d.size ?? 14, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
        {d.text ?? '— kV'}
      </span>
    </div>
  )
})

// ── Device — live online status ───────────────────
export const DeviceNode = memo(function DeviceNode({ data }: NodeProps) {
  const d = (data ?? {}) as any
  const bound = d.device_id != null

  const statusInfo = useDispatcherStore(s =>
    bound ? s.statuses[d.device_id] : undefined
  )
  useDispatcherStore(s => bound ? s.revisions[d.device_id] : undefined)

  const online = statusInfo?.status === 'online'

  return (
    <div className={`
      relative flex items-center gap-2 px-3 py-2 rounded-lg min-w-[140px]
      ${bound
        ? 'bg-[var(--bg-card)] border border-[var(--electric)]/40'
        : 'bg-[var(--bg-card)] border border-dashed border-[#FFAA00]/60'
      }
    `}>
      <div className={`
        w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0
        ${bound && online ? 'bg-[#00D68F]/15 text-[#00D68F]' :
          bound ? 'bg-[#FF3D71]/15 text-[#FF3D71]' :
          'bg-[var(--electric)]/10 text-[var(--electric)]'}
      `}>
        {!bound ? <Cpu size={13} /> :
         online ? <Wifi size={13} /> : <WifiOff size={13} />}
      </div>

      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-[var(--text)] truncate">
          {d.label ?? (bound ? `Device #${d.device_id}` : '⚠ Bog\'lanmagan')}
        </div>
        {d.ip && <div className="text-[9px] font-mono text-ink-300 truncate">{d.ip}</div>}
      </div>

      {!bound && <AlertCircle size={12} className="text-[#FFAA00] ml-auto" />}
      <FourHandles />
    </div>
  )
})

// ── Signal Value — LIVE from WS store ─────────────
export const SignalValueNode = memo(function SignalValueNode({ data }: NodeProps) {
  const d = (data ?? {}) as any
  const bound = d.device_id != null && !!d.signal_name

  const live = useDispatcherStore(s =>
    bound ? s.signals[d.device_id]?.[d.signal_name] : undefined
  )
  useDispatcherStore(s => bound ? s.revisions[d.device_id] : undefined)

  const value   = live?.value
  const quality = live?.quality ?? 0
  const goodQ   = quality === 0

  // Flash on change
  const [flashing, setFlashing] = useState(false)
  useEffect(() => {
    if (value == null) return
    setFlashing(true)
    const t = setTimeout(() => setFlashing(false), 1200)
    return () => clearTimeout(t)
  }, [value])

  function fmt(v: number | null | undefined): string {
    if (v == null) return '—'
    if (v === 0) return '0'
    const abs = Math.abs(v)
    if (abs >= 1000) return v.toFixed(1)
    if (abs >= 100)  return v.toFixed(2)
    if (abs >= 1)    return v.toFixed(3)
    if (abs >= 0.001) return v.toFixed(4)
    return v.toExponential(1)
  }

  return (
    <div className={`
      relative flex flex-col gap-0.5 px-2.5 py-1.5 rounded-md min-w-[110px]
      transition-colors duration-700
      ${bound
        ? 'bg-[var(--bg-card)] border border-[var(--electric)]/30'
        : 'bg-[var(--bg-card)] border border-dashed border-[#FFAA00]/60'
      }
      ${flashing ? 'signal-flash' : ''}
    `}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-ink-300 truncate">
          {d.label ?? d.signal_name ?? '⚠'}
        </span>
        {bound && (
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${goodQ ? 'bg-[#00D68F]' : 'bg-[#FF3D71]'}`} />
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[14px] font-mono font-bold text-[var(--text)]">
          {bound ? fmt(value) : '—'}
        </span>
        {d.unit && <span className="text-[9px] font-mono text-ink-300">{d.unit}</span>}
      </div>
      <FourHandles />
    </div>
  )
})

// ── Text ──────────────────────────────────────────
export const TextNode = memo(function TextNode({ data }: NodeProps) {
  const d = (data ?? {}) as any
  return (
    <div className="px-2 py-0.5" style={{
      color: d.color ?? 'var(--text)',
      fontSize: d.size ?? 12,
      fontWeight: d.bold ? 700 : 400,
      whiteSpace: 'nowrap',
    }}>
      {d.text ?? ''}
    </div>
  )
})

export const SCHEMA_NODE_TYPES = {
  bus:            BusNode,
  breaker:        BreakerNode,
  disconnector:   DisconnectorNode,
  transformer:    TransformerNode,
  ground:         GroundNode,
  'voltage-label': VoltageLabelNode,
  device:         DeviceNode,
  'signal-value': SignalValueNode,
  text:           TextNode,
}

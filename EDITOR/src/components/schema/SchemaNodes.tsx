/**
 * SCADA Single-Line Diagram Node Components
 * ─────────────────────────────────────────
 *
 * Each component implements one electrical-schematic primitive used in
 * a single-line diagram (PUE/EHD style).  They share a common base:
 *   • Custom SVG visuals tuned for dark theme
 *   • 4 connection handles (Top/Bottom/Left/Right) by default
 *   • Selected → blue glow ring
 *   • Lightweight (no per-node animations)
 *
 * Data binding:
 *   • `device` node — references a real Device by id
 *   • `signal-value` node — references Device + signal_name and
 *     displays its current value (filled in by the dispatcher view at runtime)
 */
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  Cpu, AlertCircle, Wifi, WifiOff,
} from 'lucide-react'

// ── Shared styles ────────────────────────────────
const HANDLE_STYLE: React.CSSProperties = {
  width:  8,
  height: 8,
  background:   'var(--bg-card)',
  border: '1.5px solid var(--brand)',
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

function selectionRing(selected: boolean): string {
  return selected
    ? 'ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-[var(--bg-page)]'
    : ''
}

// ══════════════════════════════════════════════════
//  Node data shapes
// ══════════════════════════════════════════════════

export interface BusData {
  label?:       string
  voltage?:     string   // "220 kV"
  orientation?: 'horizontal' | 'vertical'
  length?:      number   // pixels
  color?:       string   // override stroke color
}

export interface BreakerData {
  label?:       string
  state?:       'open' | 'closed'
  // optional: bind to a device/signal so state follows live value
  device_id?:   number
  signal_name?: string
}

export interface DisconnectorData {
  label?:  string
  state?:  'open' | 'closed'
}

export interface TransformerData {
  label?:    string   // "T-1"
  rating?:   string   // "40 MVA"
  windings?: 2 | 3
}

export interface GroundData {
  label?: string
}

export interface VoltageLabelData {
  text?:    string    // "220 kV"
  size?:    number    // px
  color?:   string
}

export interface DeviceNodeData {
  device_id?:  number
  label?:      string
  ip?:         string
  online?:     boolean // dispatcher writes this
}

export interface SignalValueData {
  device_id?:   number
  signal_name?: string
  label?:       string   // display label, defaults to signal_name
  unit?:        string
  value?:       number | null  // dispatcher writes this
  quality?:     number         // dispatcher writes this
}

export interface TextData {
  text?:  string
  size?:  number
  color?: string
  bold?:  boolean
}

// ══════════════════════════════════════════════════
//  BusNode — horizontal/vertical busbar
// ══════════════════════════════════════════════════
export const BusNode = memo(function BusNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as BusData
  const horizontal = (d.orientation ?? 'horizontal') === 'horizontal'
  const length     = d.length ?? 240
  const color      = d.color  ?? '#2979FF'

  const w = horizontal ? length : 8
  const h = horizontal ? 8      : length

  return (
    <div
      className={`relative flex ${horizontal ? 'flex-col' : 'flex-row'} items-center gap-2 ${selectionRing(selected ?? false)}`}
      style={{ width: w + 24, height: h + 24, padding: 12 }}
    >
      {/* Voltage label */}
      {d.voltage && (
        <div className={`absolute ${horizontal ? '-top-1 left-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2 -left-12'} text-[11px] font-mono font-bold text-[var(--text)]`}>
          {d.voltage}
        </div>
      )}

      {/* Bar */}
      <div
        className="rounded-sm shadow-[0_0_8px_rgba(41,121,255,0.4)]"
        style={{
          width:  w,
          height: h,
          background: `linear-gradient(${horizontal ? '180deg' : '90deg'}, ${color}, ${color}dd)`,
        }}
      />

      {/* Custom handle pattern: multiple along the bar */}
      <Handle id="a" type="source" position={horizontal ? Position.Top : Position.Left}   style={{ ...HANDLE_STYLE, [horizontal ? 'left' : 'top']: '25%' }} />
      <Handle id="b" type="source" position={horizontal ? Position.Top : Position.Left}   style={{ ...HANDLE_STYLE, [horizontal ? 'left' : 'top']: '50%' }} />
      <Handle id="c" type="source" position={horizontal ? Position.Top : Position.Left}   style={{ ...HANDLE_STYLE, [horizontal ? 'left' : 'top']: '75%' }} />
      <Handle id="d" type="source" position={horizontal ? Position.Bottom : Position.Right} style={{ ...HANDLE_STYLE, [horizontal ? 'left' : 'top']: '25%' }} />
      <Handle id="e" type="source" position={horizontal ? Position.Bottom : Position.Right} style={{ ...HANDLE_STYLE, [horizontal ? 'left' : 'top']: '50%' }} />
      <Handle id="f" type="source" position={horizontal ? Position.Bottom : Position.Right} style={{ ...HANDLE_STYLE, [horizontal ? 'left' : 'top']: '75%' }} />

      {/* Label */}
      {d.label && (
        <div className={`text-[10px] text-ink-300 ${horizontal ? '' : 'writing-mode-vertical'}`}>
          {d.label}
        </div>
      )}
    </div>
  )
})

// ══════════════════════════════════════════════════
//  BreakerNode — circuit breaker (square, ●/X)
// ══════════════════════════════════════════════════
export const BreakerNode = memo(function BreakerNode({ data, selected }: NodeProps) {
  const d     = (data ?? {}) as BreakerData
  const open  = d.state === 'open'
  const color = open ? '#FF3D71' : '#00D68F'

  return (
    <div className={`relative flex flex-col items-center gap-1 ${selectionRing(selected ?? false)}`} style={{ padding: 12 }}>
      <svg width="32" height="32" viewBox="0 0 32 32">
        {/* Connector lines (vertical) */}
        <line x1="16" y1="0"  x2="16" y2="6"  stroke="var(--text)" strokeWidth="1.5" />
        <line x1="16" y1="26" x2="16" y2="32" stroke="var(--text)" strokeWidth="1.5" />

        {/* Square body */}
        <rect
          x="6" y="6" width="20" height="20"
          fill={open ? 'transparent' : color}
          stroke={color}
          strokeWidth="2"
          rx="2"
        />

        {/* X when open */}
        {open && (
          <>
            <line x1="9"  y1="9"  x2="23" y2="23" stroke={color} strokeWidth="2" />
            <line x1="23" y1="9"  x2="9"  y2="23" stroke={color} strokeWidth="2" />
          </>
        )}
      </svg>

      {d.label && (
        <div className="text-[10px] font-mono text-[var(--text)]">{d.label}</div>
      )}

      <FourHandles />
    </div>
  )
})

// ══════════════════════════════════════════════════
//  DisconnectorNode — disconnector switch
// ══════════════════════════════════════════════════
export const DisconnectorNode = memo(function DisconnectorNode({ data, selected }: NodeProps) {
  const d    = (data ?? {}) as DisconnectorData
  const open = d.state === 'open'

  return (
    <div className={`relative flex flex-col items-center gap-1 ${selectionRing(selected ?? false)}`} style={{ padding: 12 }}>
      <svg width="32" height="32" viewBox="0 0 32 32">
        <line x1="16" y1="0"  x2="16" y2="8"  stroke="var(--text)" strokeWidth="1.5" />
        <line x1="16" y1="24" x2="16" y2="32" stroke="var(--text)" strokeWidth="1.5" />
        {/* Pivot dots */}
        <circle cx="16" cy="8"  r="2" fill="var(--text)" />
        <circle cx="16" cy="24" r="2" fill="var(--text)" />
        {/* Switch arm */}
        {open ? (
          <line x1="16" y1="8" x2="26" y2="20" stroke="#FFAA00" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <line x1="16" y1="8" x2="16" y2="24" stroke="#00D68F" strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
      {d.label && <div className="text-[10px] font-mono text-[var(--text)]">{d.label}</div>}
      <FourHandles />
    </div>
  )
})

// ══════════════════════════════════════════════════
//  TransformerNode — two-winding transformer
// ══════════════════════════════════════════════════
export const TransformerNode = memo(function TransformerNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as TransformerData
  const windings = d.windings ?? 2

  return (
    <div className={`relative flex flex-col items-center gap-1 ${selectionRing(selected ?? false)}`} style={{ padding: 12 }}>
      <svg width="40" height={windings === 3 ? 56 : 48} viewBox={`0 0 40 ${windings === 3 ? 56 : 48}`}>
        {/* Top wire */}
        <line x1="20" y1="0" x2="20" y2="8" stroke="var(--text)" strokeWidth="1.5" />
        {/* HV winding */}
        <circle cx="20" cy="14" r="8" fill="none" stroke="#FFAA00" strokeWidth="1.5" />
        {/* LV winding */}
        <circle cx="20" cy="26" r="8" fill="none" stroke="#FFAA00" strokeWidth="1.5" />
        {/* 3-winding */}
        {windings === 3 && (
          <circle cx="20" cy="38" r="8" fill="none" stroke="#FFAA00" strokeWidth="1.5" />
        )}
        {/* Bottom wire */}
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

// ══════════════════════════════════════════════════
//  GroundNode — earthing symbol
// ══════════════════════════════════════════════════
export const GroundNode = memo(function GroundNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as GroundData
  return (
    <div className={`relative flex flex-col items-center ${selectionRing(selected ?? false)}`} style={{ padding: 8 }}>
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

// ══════════════════════════════════════════════════
//  VoltageLabelNode — text label for voltage level
// ══════════════════════════════════════════════════
export const VoltageLabelNode = memo(function VoltageLabelNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as VoltageLabelData
  return (
    <div
      className={`px-3 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--brand)]/40 ${selectionRing(selected ?? false)}`}
      style={{ color: d.color ?? 'var(--brand)' }}
    >
      <span style={{ fontSize: d.size ?? 14, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
        {d.text ?? '— kV'}
      </span>
    </div>
  )
})

// ══════════════════════════════════════════════════
//  DeviceNode — bound to a real Device (DB)
// ══════════════════════════════════════════════════
export const DeviceNode = memo(function DeviceNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as DeviceNodeData
  const bound = d.device_id != null
  const online = d.online ?? null

  return (
    <div
      className={`
        relative flex items-center gap-2 px-3 py-2 rounded-lg min-w-[140px]
        ${bound
          ? 'bg-[var(--bg-card)] border border-[var(--brand)]/40'
          : 'bg-[var(--bg-card)] border border-dashed border-[var(--warning)]/60'
        }
        ${selectionRing(selected ?? false)}
      `}
    >
      <div className={`
        w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0
        ${online === true ? 'bg-[#00D68F]/15 text-[#00D68F]' :
          online === false ? 'bg-[#FF3D71]/15 text-[#FF3D71]' :
          'bg-[var(--brand)]/10 text-[var(--brand)]'}
      `}>
        {online === true ? <Wifi size={13} /> :
         online === false ? <WifiOff size={13} /> :
         <Cpu size={13} />}
      </div>

      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-[var(--text)] truncate">
          {d.label ?? (bound ? `Device #${d.device_id}` : '⚠ Device tanlanmagan')}
        </div>
        {d.ip && (
          <div className="text-[9px] font-mono text-ink-300 truncate">{d.ip}</div>
        )}
      </div>

      {!bound && (
        <AlertCircle size={12} className="text-[var(--warning)] ml-auto" />
      )}

      <FourHandles />
    </div>
  )
})

// ══════════════════════════════════════════════════
//  SignalValueNode — bound to Device + signal_name
//  Shows live value (filled by dispatcher view)
// ══════════════════════════════════════════════════
export const SignalValueNode = memo(function SignalValueNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as SignalValueData
  const bound = d.device_id != null && !!d.signal_name
  const value = d.value
  const quality = d.quality ?? 0
  const goodQ = quality === 0

  // Smart format
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
    <div
      className={`
        relative flex flex-col gap-0.5 px-2.5 py-1.5 rounded-md min-w-[110px]
        ${bound
          ? 'bg-[var(--bg-card)] border border-[var(--brand)]/30'
          : 'bg-[var(--bg-card)] border border-dashed border-[var(--warning)]/60'
        }
        ${selectionRing(selected ?? false)}
      `}
    >
      {/* Label */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-ink-300 truncate">
          {d.label ?? d.signal_name ?? '⚠ Signal'}
        </span>
        {bound && (
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${goodQ ? 'bg-[#00D68F]' : 'bg-[#FF3D71]'}`}
            title={`Quality ${quality}`}
          />
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1">
        <span className="text-[14px] font-mono font-bold text-[var(--text)]">
          {bound ? fmt(value) : '—'}
        </span>
        {d.unit && (
          <span className="text-[9px] font-mono text-ink-300">{d.unit}</span>
        )}
      </div>

      <FourHandles />
    </div>
  )
})

// ══════════════════════════════════════════════════
//  TextNode — free annotation
// ══════════════════════════════════════════════════
export const TextNode = memo(function TextNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as TextData
  return (
    <div
      className={`px-2 py-0.5 ${selectionRing(selected ?? false)}`}
      style={{
        color: d.color ?? 'var(--text)',
        fontSize: d.size ?? 12,
        fontWeight: d.bold ? 700 : 400,
        whiteSpace: 'nowrap',
      }}
    >
      {d.text ?? 'Matn...'}
    </div>
  )
})

// ── Export node type map ──────────────────────────
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

export type SchemaNodeKind = keyof typeof SCHEMA_NODE_TYPES

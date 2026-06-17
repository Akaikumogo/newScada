/**
 * SCADA Single-Line Diagram Node Components
 *
 * Editor-side node primitives. The dispatcher uses the same canvas JSON
 * but binds live values at runtime.
 */
import { memo, type CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { AlertCircle, Cpu, Layers3, Sigma, Wifi, WifiOff } from 'lucide-react'

const HANDLE_STYLE: CSSProperties = {
  width: 8,
  height: 8,
  background: 'var(--bg-card)',
  border: '1.5px solid var(--brand)',
}

function BiHandle({ id, position, style }: { id: string; position: Position; style?: CSSProperties }) {
  const merged = { ...HANDLE_STYLE, ...(style ?? {}) }
  return (
    <>
      <Handle id={`${id}-s`} type="source" position={position} style={merged} />
      <Handle id={`${id}-t`} type="target" position={position} style={{ ...merged, background: 'transparent' }} />
    </>
  )
}

function FourHandles() {
  return (
    <>
      <BiHandle id="t" position={Position.Top} />
      <BiHandle id="b" position={Position.Bottom} />
      <BiHandle id="l" position={Position.Left} />
      <BiHandle id="r" position={Position.Right} />
    </>
  )
}

function selectionRing(selected: boolean): string {
  return selected ? 'ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-[var(--bg-page)]' : ''
}

export interface BusData {
  label?: string
  voltage?: string
  orientation?: 'horizontal' | 'vertical'
  length?: number
  color?: string
}

export interface BreakerData {
  label?: string
  state?: 'open' | 'closed'
  device_id?: number
  signal_name?: string
}

export interface DisconnectorData {
  label?: string
  state?: 'open' | 'closed'
}

export interface TransformerData {
  label?: string
  rating?: string
  windings?: 2 | 3
}

export interface GroundData {
  label?: string
}

export interface VoltageLabelData {
  text?: string
  size?: number
  color?: string
}

export interface DeviceNodeData {
  device_id?: number
  label?: string
  device_name?: string
  common_address?: number
  signal_count?: number
  last_seen?: string
  status_text?: string
  online?: boolean
  compact?: boolean
}

export interface SignalValueData {
  device_id?: number
  signal_name?: string
  label?: string
  unit?: string
  value?: number | null
  quality?: number
}

export interface FormulaVariableBinding {
  device_id: number
  signal_name: string
  scale?: number
  offset?: number
  /** realtime = live Redis value (default); first/last = boundary value in a time range */
  value_source?: 'realtime' | 'first' | 'last'
  /** Which day to use for first/last queries */
  range_preset?: 'today' | 'yesterday' | 'custom'
  /** YYYY-MM-DD — used when range_preset === 'custom' */
  range_custom_date?: string
  /** HH:MM start of range, default "00:00" */
  range_from?: string
  /** HH:MM or "24:00" end of range, default "24:00" */
  range_to?: string
}

export interface BlockData {
  label?: string
  formula?: string
  variables?: Record<string, FormulaVariableBinding>
  unit?: string
  decimals?: number
  color?: string
}

export interface TextData {
  text?: string
  size?: number
  color?: string
  bold?: boolean
}

export interface SldLineData {
  label?: string
  orientation?: 'horizontal' | 'vertical'
  length?: number
  color?: string
  dashed?: boolean
}

export interface FeederData {
  label?: string
  length?: number
  color?: string
  breaker?: boolean
  disconnector?: boolean
  ground?: boolean
}

export interface InstrumentData {
  label?: string
  color?: string
}

export interface LegendData {
  title?: string
}

export interface JunctionData {
  label?: string
  color?: string
  size?: number
}

export const BusNode = memo(function BusNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as BusData
  const horizontal = (d.orientation ?? 'horizontal') === 'horizontal'
  const length = d.length ?? 240
  const color = d.color ?? '#2979FF'
  const w = horizontal ? length : 8
  const h = horizontal ? 8 : length

  return (
    <div
      className={`relative flex ${horizontal ? 'flex-col' : 'flex-row'} items-center gap-2 ${selectionRing(selected ?? false)}`}
      style={{ width: w + 24, height: h + 24, padding: 12 }}
    >
      {d.voltage && (
        <div className={`absolute ${horizontal ? '-top-1 left-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2 -left-12'} text-[11px] font-mono font-bold text-[var(--text)]`}>
          {d.voltage}
        </div>
      )}
      <div className="rounded-sm shadow-[0_0_8px_rgba(41,121,255,0.4)]" style={{ width: w, height: h, background: `linear-gradient(${horizontal ? '180deg' : '90deg'}, ${color}, ${color}dd)` }} />
      <BiHandle id="a" position={horizontal ? Position.Top : Position.Left} style={{ [horizontal ? 'left' : 'top']: '25%' }} />
      <BiHandle id="b" position={horizontal ? Position.Top : Position.Left} style={{ [horizontal ? 'left' : 'top']: '50%' }} />
      <BiHandle id="c" position={horizontal ? Position.Top : Position.Left} style={{ [horizontal ? 'left' : 'top']: '75%' }} />
      <BiHandle id="d" position={horizontal ? Position.Bottom : Position.Right} style={{ [horizontal ? 'left' : 'top']: '25%' }} />
      <BiHandle id="e" position={horizontal ? Position.Bottom : Position.Right} style={{ [horizontal ? 'left' : 'top']: '50%' }} />
      <BiHandle id="f" position={horizontal ? Position.Bottom : Position.Right} style={{ [horizontal ? 'left' : 'top']: '75%' }} />
      {d.label && <div className={`text-[10px] text-ink-300 ${horizontal ? '' : 'writing-mode-vertical'}`}>{d.label}</div>}
    </div>
  )
})

export const BreakerNode = memo(function BreakerNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as BreakerData
  const open = d.state === 'open'
  const color = open ? '#FF3D71' : '#00D68F'
  return (
    <div className={`relative flex flex-col items-center gap-1 ${selectionRing(selected ?? false)}`} style={{ padding: 12 }}>
      <svg width="32" height="32" viewBox="0 0 32 32">
        <line x1="16" y1="0" x2="16" y2="6" stroke="var(--text)" strokeWidth="1.5" />
        <line x1="16" y1="26" x2="16" y2="32" stroke="var(--text)" strokeWidth="1.5" />
        <rect x="6" y="6" width="20" height="20" fill={open ? 'transparent' : color} stroke={color} strokeWidth="2" rx="2" />
        {open && (
          <>
            <line x1="9" y1="9" x2="23" y2="23" stroke={color} strokeWidth="2" />
            <line x1="23" y1="9" x2="9" y2="23" stroke={color} strokeWidth="2" />
          </>
        )}
      </svg>
      {d.label && <div className="text-[10px] font-mono text-[var(--text)]">{d.label}</div>}
      <FourHandles />
    </div>
  )
})

export const DisconnectorNode = memo(function DisconnectorNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as DisconnectorData
  const open = d.state === 'open'
  return (
    <div className={`relative flex flex-col items-center gap-1 ${selectionRing(selected ?? false)}`} style={{ padding: 12 }}>
      <svg width="32" height="32" viewBox="0 0 32 32">
        <line x1="16" y1="0" x2="16" y2="8" stroke="var(--text)" strokeWidth="1.5" />
        <line x1="16" y1="24" x2="16" y2="32" stroke="var(--text)" strokeWidth="1.5" />
        <circle cx="16" cy="8" r="2" fill="var(--text)" />
        <circle cx="16" cy="24" r="2" fill="var(--text)" />
        {open ? <line x1="16" y1="8" x2="26" y2="20" stroke="#FFAA00" strokeWidth="2" strokeLinecap="round" /> : <line x1="16" y1="8" x2="16" y2="24" stroke="#00D68F" strokeWidth="2" strokeLinecap="round" />}
      </svg>
      {d.label && <div className="text-[10px] font-mono text-[var(--text)]">{d.label}</div>}
      <FourHandles />
    </div>
  )
})

export const TransformerNode = memo(function TransformerNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as TransformerData
  const windings = d.windings ?? 2
  return (
    <div className={`relative flex flex-col items-center gap-1 ${selectionRing(selected ?? false)}`} style={{ padding: 12 }}>
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

export const GroundNode = memo(function GroundNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as GroundData
  return (
    <div className={`relative flex flex-col items-center ${selectionRing(selected ?? false)}`} style={{ padding: 8 }}>
      <svg width="24" height="24" viewBox="0 0 24 24">
        <line x1="12" y1="0" x2="12" y2="10" stroke="var(--text)" strokeWidth="1.5" />
        <line x1="3" y1="11" x2="21" y2="11" stroke="var(--text)" strokeWidth="2" />
        <line x1="6" y1="15" x2="18" y2="15" stroke="var(--text)" strokeWidth="1.5" />
        <line x1="9" y1="19" x2="15" y2="19" stroke="var(--text)" strokeWidth="1.5" />
      </svg>
      {d.label && <div className="text-[9px] text-ink-300">{d.label}</div>}
      <BiHandle id="t" position={Position.Top} />
    </div>
  )
})

export const VoltageLabelNode = memo(function VoltageLabelNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as VoltageLabelData
  return (
    <div className={`px-3 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--brand)]/40 ${selectionRing(selected ?? false)}`} style={{ color: d.color ?? 'var(--brand)' }}>
      <span style={{ fontSize: d.size ?? 14, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{d.text ?? '— kV'}</span>
    </div>
  )
})

export const DeviceNode = memo(function DeviceNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as DeviceNodeData
  const bound = d.device_id != null
  const online = d.online ?? null

  if (d.compact) {
    return (
      <div
        className={`group relative flex items-center gap-1.5 rounded-md border border-[var(--brand)]/40 bg-[var(--bg-card)] px-2 py-1 min-w-[74px] ${selectionRing(selected ?? false)}`}
        title={d.device_name ?? d.label ?? (bound ? `Device #${d.device_id}` : 'Device')}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${online === false ? 'bg-[#FF3D71]' : 'bg-[#00D68F]'}`} />
        <span className="max-w-[86px] truncate text-[9px] font-mono text-[var(--text)]">{d.label ?? d.device_name ?? `D-${d.device_id ?? '?'}`}</span>
        {bound && (
          <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 group-hover:block">
            <div className="min-w-[220px] rounded-xl border border-[var(--border-hover)] bg-[rgba(7,12,26,0.96)] px-3 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <div className="text-[11px] font-semibold text-[var(--text)]">{d.device_name ?? d.label}</div>
              <div className="mt-1 space-y-1 text-[10px] text-ink-300">
                <div className="flex justify-between gap-3"><span>Status</span><span>{online === false ? 'Offline' : 'Online'}</span></div>
                <div className="flex justify-between gap-3"><span>CASDU</span><span>{d.common_address ?? '—'}</span></div>
                <div className="flex justify-between gap-3"><span>Signals</span><span>{d.signal_count ?? '—'}</span></div>
              </div>
            </div>
          </div>
        )}
        <FourHandles />
      </div>
    )
  }

  return (
    <div
      className={`
        group relative flex items-center gap-2 px-3 py-2 rounded-lg min-w-[160px]
        ${bound ? 'bg-[var(--bg-card)] border border-[var(--brand)]/40' : 'bg-[var(--bg-card)] border border-dashed border-[var(--warning)]/60'}
        ${selectionRing(selected ?? false)}
      `}
      title={d.device_name ?? d.label ?? (bound ? `Device #${d.device_id}` : 'Device')}
    >
      <div className={`
        w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0
        ${online === true ? 'bg-[#00D68F]/15 text-[#00D68F]' : online === false ? 'bg-[#FF3D71]/15 text-[#FF3D71]' : 'bg-[var(--brand)]/10 text-[var(--brand)]'}
      `}>
        {online === true ? <Wifi size={13} /> : online === false ? <WifiOff size={13} /> : <Cpu size={13} />}
      </div>

      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-[var(--text)] truncate">
          {d.label ?? (bound ? d.device_name ?? `Device #${d.device_id}` : '⚠ Device tanlanmagan')}
        </div>
        {bound && <div className="text-[9px] text-ink-300 truncate">CASDU {d.common_address ?? '—'}</div>}
      </div>

      {bound && (
        <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 group-hover:block">
          <div className="min-w-[220px] rounded-xl border border-[var(--border-hover)] bg-[rgba(7,12,26,0.96)] px-3 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="text-[11px] font-semibold text-[var(--text)]">
              {d.device_name ?? d.label ?? `Device #${d.device_id}`}
            </div>
            <div className="mt-1 space-y-1 text-[10px] text-ink-300">
              <div className="flex items-center justify-between gap-3">
                <span>Status</span>
                <span className={online ? 'text-[#00D68F]' : online === false ? 'text-[#FF3D71]' : 'text-ink-300'}>
                  {online === true ? 'Online' : online === false ? 'Offline' : (d.status_text ?? 'unknown')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>CASDU</span>
                <span className="font-mono text-[var(--text)]">{d.common_address ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Signals</span>
                <span className="font-mono text-[var(--text)]">{d.signal_count ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!bound && <AlertCircle size={12} className="text-[var(--warning)] ml-auto" />}
      <FourHandles />
    </div>
  )
})

export const SignalValueNode = memo(function SignalValueNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as SignalValueData
  const bound = d.device_id != null && !!d.signal_name
  const value = d.value
  const quality = d.quality ?? 0
  const goodQ = quality === 0

  function fmt(v: number | null | undefined): string {
    if (v == null) return '—'
    if (v === 0) return '0'
    const abs = Math.abs(v)
    if (abs >= 1000) return v.toFixed(1)
    if (abs >= 100) return v.toFixed(2)
    if (abs >= 1) return v.toFixed(3)
    if (abs >= 0.001) return v.toFixed(4)
    return v.toExponential(1)
  }

  return (
    <div className={`relative flex flex-col gap-0.5 px-2.5 py-1.5 rounded-md min-w-[110px] ${bound ? 'bg-[var(--bg-card)] border border-[var(--brand)]/30' : 'bg-[var(--bg-card)] border border-dashed border-[var(--warning)]/60'} ${selectionRing(selected ?? false)}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-ink-300 truncate">{d.label ?? d.signal_name ?? '⚠'}</span>
        {bound && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${goodQ ? 'bg-[#00D68F]' : 'bg-[#FF3D71]'}`} />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[14px] font-mono font-bold text-[var(--text)]">{bound ? fmt(value) : '—'}</span>
        {d.unit && <span className="text-[9px] font-mono text-ink-300">{d.unit}</span>}
      </div>
      <FourHandles />
    </div>
  )
})

export const BlockNode = memo(function BlockNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as BlockData
  const variables = Object.keys(d.variables ?? {}).sort()
  function selectVariable(key: string) {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('schema:block-variable-click', { detail: { key } }))
    }, 0)
  }
  return (
    <div
      className={`relative flex flex-col gap-1 rounded-xl border px-3 py-2 min-w-[180px] bg-[var(--bg-card)] ${selectionRing(selected ?? false)}`}
      style={{ borderColor: d.color ?? 'var(--brand)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Layers3 size={12} className="text-[var(--brand)] flex-shrink-0" />
          <span className="text-[11px] font-semibold text-[var(--text)] truncate">{d.label ?? 'Block'}</span>
        </div>
        <Sigma size={12} className="text-ink-300" />
      </div>
      <div className="text-[10px] font-mono text-[var(--text)]">{d.formula ?? 'formula'}</div>
      <div className="flex flex-wrap gap-1">
        {variables.length > 0 ? variables.map(key => (
          <button
            key={key}
            type="button"
            onClick={e => { e.stopPropagation(); selectVariable(key) }}
            className="nodrag rounded border border-[var(--border)] bg-[var(--bg-page)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--text)] hover:border-[var(--brand)]"
            title="Register biriktirish"
          >
            {key}
          </button>
        )) : (
          <span className="text-[9px] text-ink-300">No variables</span>
        )}
      </div>
      <FourHandles />
    </div>
  )
})

export const TextNode = memo(function TextNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as TextData
  return (
    <div className={`px-2 py-0.5 ${selectionRing(selected ?? false)}`} style={{ color: d.color ?? 'var(--text)', fontSize: d.size ?? 12, fontWeight: d.bold ? 700 : 400, whiteSpace: 'nowrap' }}>
      {d.text ?? 'Matn...'}
    </div>
  )
})

export const SldLineNode = memo(function SldLineNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as SldLineData
  const horizontal = (d.orientation ?? 'vertical') === 'horizontal'
  const length = d.length ?? 120
  const color = d.color ?? '#00D68F'
  const animatedDash = !!d.dashed
  return (
    <div className={`relative ${selectionRing(selected ?? false)}`} style={{ width: horizontal ? length + 16 : 28, height: horizontal ? 28 : length + 16, padding: 8 }}>
      {animatedDash && (
        <style>{`
          @keyframes sld-dash-flow {
            from { background-position: 0 0; }
            to { background-position: 0 18px; }
          }
          @keyframes sld-dash-flow-x {
            from { background-position: 0 0; }
            to { background-position: 18px 0; }
          }
        `}</style>
      )}
      <div
        className="absolute"
        style={{
          left: horizontal ? 8 : 13,
          top: horizontal ? 13 : 8,
          width: horizontal ? length : 2,
          height: horizontal ? 2 : length,
          background: animatedDash
            ? `repeating-linear-gradient(${horizontal ? '90deg' : '180deg'}, ${color} 0 7px, transparent 7px 14px)`
            : color,
          animation: animatedDash ? `${horizontal ? 'sld-dash-flow-x' : 'sld-dash-flow'} 900ms linear infinite` : undefined,
          boxShadow: `0 0 6px ${color}55`,
        }}
      />
      {d.label && (
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[var(--text)] whitespace-nowrap">
          {d.label}
        </div>
      )}
      <BiHandle id="a" position={horizontal ? Position.Left : Position.Top} />
      <BiHandle id="b" position={horizontal ? Position.Right : Position.Bottom} />
    </div>
  )
})

export const FeederNode = memo(function FeederNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as FeederData
  const length = d.length ?? 170
  const color = d.color ?? '#00D68F'
  return (
    <div className={`relative ${selectionRing(selected ?? false)}`} style={{ width: 40, height: length + 54, padding: 12 }}>
      <svg width="40" height={length + 34} viewBox={`0 0 40 ${length + 34}`}>
        <line x1="20" y1="0" x2="20" y2={length} stroke={color} strokeWidth="2" />
        {d.disconnector !== false && (
          <>
            <circle cx="20" cy="22" r="3" fill="none" stroke={color} strokeWidth="1.5" />
            <line x1="20" y1="25" x2="29" y2="40" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
        {d.breaker !== false && (
          <rect x="16" y="52" width="8" height="12" rx="1.5" fill="none" stroke={color} strokeWidth="1.6" />
        )}
        {d.ground && (
          <>
            <line x1="20" y1={length - 14} x2="30" y2={length - 4} stroke={color} strokeWidth="1.5" />
            <line x1="26" y1={length - 4} x2="34" y2={length - 4} stroke={color} strokeWidth="1.5" />
            <line x1="28" y1={length} x2="32" y2={length} stroke={color} strokeWidth="1.5" />
          </>
        )}
        <path d={`M14 ${length - 8} L20 ${length} L26 ${length - 8}`} fill="none" stroke={color} strokeWidth="1.7" />
      </svg>
      {d.label && (
        <div className="absolute left-7 bottom-2 origin-left -rotate-90 text-[9px] font-mono text-[var(--text)] whitespace-nowrap">
          {d.label}
        </div>
      )}
      <BiHandle id="t" position={Position.Top} />
      <BiHandle id="b" position={Position.Bottom} />
    </div>
  )
})

export const CurrentTransformerNode = memo(function CurrentTransformerNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as InstrumentData
  const color = d.color ?? '#9BB0D3'
  return (
    <div className={`relative flex flex-col items-center gap-1 ${selectionRing(selected ?? false)}`} style={{ padding: 8 }}>
      <svg width="34" height="42" viewBox="0 0 34 42">
        <line x1="17" y1="0" x2="17" y2="6" stroke={color} strokeWidth="1.6" />
        <circle cx="17" cy="14" r="7" fill="none" stroke={color} strokeWidth="2" />
        <circle cx="17" cy="28" r="7" fill="none" stroke={color} strokeWidth="2" />
      </svg>
      {d.label && <div className="text-[9px] font-mono text-[var(--text)]">{d.label}</div>}
      <FourHandles />
    </div>
  )
})

export const VoltageTransformerNode = memo(function VoltageTransformerNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as InstrumentData
  const color = d.color ?? '#9BB0D3'
  return (
    <div className={`relative flex flex-col items-center gap-1 ${selectionRing(selected ?? false)}`} style={{ padding: 8 }}>
      <svg width="38" height="50" viewBox="0 0 38 50">
        <circle cx="14" cy="18" r="8" fill="none" stroke={color} strokeWidth="2" />
        <circle cx="24" cy="18" r="8" fill="none" stroke={color} strokeWidth="2" />
        <line x1="19" y1="26" x2="19" y2="38" stroke={color} strokeWidth="1.6" />
        <line x1="8" y1="38" x2="30" y2="38" stroke={color} strokeWidth="1.6" />
        <line x1="12" y1="43" x2="26" y2="43" stroke={color} strokeWidth="1.6" />
        <line x1="16" y1="48" x2="22" y2="48" stroke={color} strokeWidth="1.6" />
      </svg>
      {d.label && <div className="text-[9px] font-mono text-[var(--text)]">{d.label}</div>}
      <FourHandles />
    </div>
  )
})

export const ReactorNode = memo(function ReactorNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as InstrumentData
  const color = d.color ?? '#9BB0D3'
  return (
    <div className={`relative flex flex-col items-center gap-1 ${selectionRing(selected ?? false)}`} style={{ padding: 8 }}>
      <svg width="34" height="48" viewBox="0 0 34 48">
        <line x1="17" y1="0" x2="17" y2="10" stroke={color} strokeWidth="1.7" />
        <path d="M17 10 C29 16 29 32 17 38 C5 32 5 16 17 10" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1="17" y1="38" x2="17" y2="48" stroke={color} strokeWidth="1.7" />
      </svg>
      {d.label && <div className="text-[9px] font-mono text-[var(--text)]">{d.label}</div>}
      <FourHandles />
    </div>
  )
})

export const LegendNode = memo(function LegendNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as LegendData
  const rows = [
    ['#FF4F7B', '110 kV'],
    ['#FFB13B', '35 kV'],
    ['#2DDBB3', '10 kV'],
    ['#9BB0D3', '0.4 kV'],
  ]
  return (
    <div className={`rounded-xl border border-[var(--brand)]/30 bg-[var(--bg-card)] px-4 py-3 min-w-[360px] ${selectionRing(selected ?? false)}`}>
      <div className="text-[13px] font-bold uppercase tracking-wide text-[var(--text)]">{d.title ?? 'Legenda / Uslovnie'}</div>
      <div className="mt-3 grid grid-cols-4 gap-4">
        {rows.map(([color, label]) => (
          <div key={label} className="flex flex-col gap-2">
            <span className="h-2 w-12 rounded-full" style={{ background: color }} />
            <span className="text-[11px] font-semibold text-[var(--text)]">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-[10px] text-ink-300">
        <span>■ Vyklyuchatel</span>
        <span>● Razedinitel</span>
        <span>◎ Trans-r toka</span>
        <span>⊙ TN napryaj.</span>
        <span>◔ Reaktor</span>
        <span>● BMRZ online</span>
      </div>
      <FourHandles />
    </div>
  )
})

export const JunctionNode = memo(function JunctionNode({ data, selected }: NodeProps) {
  const d = (data ?? {}) as JunctionData
  const size = d.size ?? 16
  const color = d.color ?? '#2DDBB3'
  return (
    <div className={`relative flex items-center justify-center ${selectionRing(selected ?? false)}`} style={{ width: size + 18, height: size + 18, padding: 9 }}>
      <div
        className="rounded-full border"
        style={{ width: size, height: size, background: color, borderColor: `${color}aa`, boxShadow: `0 0 8px ${color}88` }}
      />
      {d.label && <div className="absolute left-full top-1/2 ml-1 -translate-y-1/2 whitespace-nowrap text-[9px] font-mono text-[var(--text)]">{d.label}</div>}
      <FourHandles />
    </div>
  )
})

export const SCHEMA_NODE_TYPES = {
  bus: BusNode,
  breaker: BreakerNode,
  disconnector: DisconnectorNode,
  transformer: TransformerNode,
  ground: GroundNode,
  line: SldLineNode,
  feeder: FeederNode,
  'current-transformer': CurrentTransformerNode,
  'voltage-transformer': VoltageTransformerNode,
  reactor: ReactorNode,
  legend: LegendNode,
  junction: JunctionNode,
  'voltage-label': VoltageLabelNode,
  device: DeviceNode,
  'signal-value': SignalValueNode,
  block: BlockNode,
  text: TextNode,
}

export type SchemaNodeKind = keyof typeof SCHEMA_NODE_TYPES

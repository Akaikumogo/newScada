import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  ResponsiveContainer, ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Brush,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2, AlertCircle, TrendingUp, Eye, EyeOff,
  ZoomIn, ZoomOut, RotateCcw, Percent, Search,
} from 'lucide-react'
import { format } from 'date-fns'
import { telemetryApi, type RangePoint } from '@/lib/api'
import {
  RANGE_PRESETS,
  fromLocalInputValue,
  presetMs,
  roundedQueryDate,
  toLocalInputValue,
  type HistoryRange,
} from '@/lib/timeRange'
import { useChunkedRangeRows } from '@/hooks/useChunkedRangeRows'
import { useLiveNow } from '@/hooks/useLiveNow'
import type { Signal } from '@/types'

// ──────────────────────────────────────────────────
//  Elite TradingChart — Recharts edition
// ──────────────────────────────────────────────────
//
//  • SVG-based crisp rendering
//  • Smooth monotone curve interpolation
//  • Subtle area gradients under each line
//  • Glass-morphism tooltip with sorted values
//  • Brush navigator at the bottom (drag to zoom)
//  • Range presets: 15m / 1h / 6h / 1d / 1w / 1mo / 3mo / 1y
//  • Normalize mode (each line scaled to 0-100%)
//  • Ctrl/Shift + Scroll → zoom in/out
//  • Visibility toggle per signal via legend
//  • Search/filter signals in legend
//  • First 8 signals visible by default (rest hidden — toggle to enable)
//
// ──────────────────────────────────────────────────

// 16-color palette — vibrant + distinguishable on dark theme
const COLOR_PALETTE = [
  '#2979FF', '#00D68F', '#FFAA00', '#FF3D71',
  '#7B5FFF', '#00C2FF', '#FF6B35', '#FFD060',
  '#9DEC6D', '#FF7AC0', '#5EEAD4', '#A78BFA',
  '#FACC15', '#F87171', '#34D399', '#60A5FA',
]

const DEFAULT_VISIBLE = 8  // first N signals visible by default

interface Props {
  deviceId:       number
  signals:        Signal[]
  initialFromTs?: Date
  initialToTs?:   Date
  height?:        number
}

// ── Smart number formatting ──────────────────────
function fmtVal(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M'
  if (abs >= 10_000)    return (v / 1000).toFixed(1) + 'k'
  if (abs >= 1000)      return v.toFixed(1)
  if (abs >= 100)       return v.toFixed(2)
  if (abs >= 1)         return v.toFixed(3)
  if (abs >= 0.001)     return v.toFixed(5)
  return v.toExponential(2)
}

function axisFmt(v: number): string {
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (abs >= 1000)      return (v / 1000).toFixed(1) + 'k'
  if (abs >= 100)       return v.toFixed(0)
  if (abs >= 10)        return v.toFixed(1)
  if (abs >= 1)         return v.toFixed(2)
  if (abs >= 0.01)      return v.toFixed(3)
  return v.toExponential(1)
}

function fmtTick(ts: number, spanMs: number): string {
  const d = new Date(ts)
  if (spanMs <= 60 * 60_000)       return format(d, 'HH:mm:ss')      // ≤ 1h: seconds
  if (spanMs <= 24 * 3600_000)     return format(d, 'HH:mm')         // ≤ 1d: minutes
  if (spanMs <= 7 * 86400_000)     return format(d, 'EEE HH:mm')     // ≤ 1w: day+hour
  if (spanMs <= 30 * 86400_000)    return format(d, 'dd MMM')        // ≤ 1mo: date
  if (spanMs <= 365 * 86400_000)   return format(d, 'dd MMM')        // ≤ 1y: date
  return format(d, 'MMM yyyy')                                       // > 1y: year-month
}

// ──────────────────────────────────────────────────
//  Elite Tooltip — glass card with sorted values
// ──────────────────────────────────────────────────
interface TooltipProps {
  active?:        boolean
  payload?:       any[]
  label?:         number
  signals:        Signal[]
  normalize:      boolean
  originalData:   Record<string, any>[]
}

function EliteTooltip({
  active, payload, label,
  signals, normalize, originalData,
}: TooltipProps) {
  if (!active || !payload?.length || label == null) return null

  // Find original (non-normalized) row for this timestamp
  const originalRow = originalData.find(r => r.ts === label)

  // Build entries from payload, with original value when normalized
  const entries = payload
    .filter(p => p.value != null)
    .map(p => {
      const sig  = signals.find(s => s.signal_name === p.dataKey)
      const orig = originalRow?.[p.dataKey]
      return {
        name:     p.dataKey as string,
        value:    p.value as number,
        original: typeof orig === 'number' ? orig : null,
        color:    p.stroke as string,
        unit:     sig?.unit ?? '',
        title:    sig?.signal_title ?? '',
      }
    })
    // Sort by displayed value descending
    .sort((a, b) => b.value - a.value)

  // Auto column count — fit all entries without scrolling
  const n = entries.length
  const cols = n <= 8 ? 1
             : n <= 18 ? 2
             : n <= 32 ? 3
             : n <= 60 ? 4
             : 5

  const colWidth   = 180
  const totalWidth = cols * colWidth + 24

  return (
    <div
      className="
        bg-[var(--bg-card)]/95 backdrop-blur-xl
        border border-[var(--border-hover)]
        rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.7)]
        p-3 pointer-events-none
      "
      style={{ width: totalWidth }}
    >
      {/* Timestamp */}
      <div className="text-[10px] font-mono font-medium text-ink-300 mb-2 pb-2 border-b border-[var(--border)] flex items-center justify-between">
        <span>{format(new Date(label), 'yyyy-MM-dd HH:mm:ss')}</span>
        <span className="text-ink-300/40">{n} ta signal</span>
      </div>

      {/* Values grid */}
      <div
        className="grid gap-x-3 gap-y-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {entries.map(e => (
          <div key={e.name} className="flex items-center justify-between gap-2 text-[10px] min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: e.color, boxShadow: `0 0 4px ${e.color}` }}
              />
              <span className="text-ink-200 truncate font-mono">{e.name}</span>
            </div>
            <div className="flex items-baseline gap-0.5 font-mono flex-shrink-0">
              <span className="font-semibold text-[var(--text)] text-[11px]">
                {fmtVal(e.original ?? e.value)}
              </span>
              {e.unit && <span className="text-ink-300/60 text-[9px]">{e.unit}</span>}
              {normalize && e.original != null && (
                <span className="text-[var(--electric-light)] text-[9px] ml-0.5">
                  {e.value.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────
//  Main component
// ──────────────────────────────────────────────────
export function TradingChart({
  deviceId, signals,
  initialFromTs,
  initialToTs,
  height = 460,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Time range state ─────────────────────────────
  const [fromTs, setFromTs] = useState<Date>(() =>
    initialFromTs ?? new Date(Date.now() - 365 * 86400_000)
  )
  const liveNow = useLiveNow(!initialToTs, 30_000)
  const toTs = initialToTs ?? liveNow
  const queryToTs = useMemo(() => roundedQueryDate(toTs, 120_000), [toTs])
  const [activeRange, setActiveRange] = useState<HistoryRange | null>('1y')

  // ── Visibility (first 8 by default) ──────────────
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {}
    signals.forEach((s, i) => { m[s.signal_name] = i < DEFAULT_VISIBLE })
    return m
  })

  // ── UI state ─────────────────────────────────────
  const [normalize, setNormalize] = useState(false)
  const [legendQuery, setLegendQuery] = useState('')

  // ── Color map ────────────────────────────────────
  const signalColors = useMemo(() => {
    const m: Record<string, string> = {}
    signals.forEach((s, i) => {
      m[s.signal_name] = COLOR_PALETTE[i % COLOR_PALETTE.length]
    })
    return m
  }, [signals])

  // ── Fetch via batched endpoint (device_id only) ──
  const { data: dataMap = {}, isLoading, isError, isFetching } = useQuery({
    queryKey: ['range-multi', deviceId, fromTs.getTime(), queryToTs.getTime()],
    queryFn:  ({ signal: abortSignal }) => telemetryApi.rangeMulti({
      device_id: deviceId,
      from_ts:   fromTs,
      to_ts:     queryToTs,
    }, abortSignal),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    enabled: signals.length > 0,
  })

  // ── Merge into row-oriented chart data ───────────
  const { rows: chartData, isProcessing: isChunking } = useChunkedRangeRows(
    dataMap as Record<string, RangePoint[]>,
  )

  // ── Apply normalization (each signal → 0..100%) ──
  const displayData = useMemo(() => {
    if (!normalize) return chartData
    const minMax: Record<string, [number, number]> = {}
    for (const sig of signals) {
      let min = Infinity, max = -Infinity
      for (const row of chartData) {
        const v = row[sig.signal_name]
        if (typeof v === 'number') {
          if (v < min) min = v
          if (v > max) max = v
        }
      }
      minMax[sig.signal_name] = [min, max]
    }
    return chartData.map(row => {
      const r: Record<string, any> = { ts: row.ts }
      for (const sig of signals) {
        const v = row[sig.signal_name]
        if (typeof v === 'number') {
          const [mn, mx] = minMax[sig.signal_name]
          const range = mx - mn
          r[sig.signal_name] = range > 0 ? ((v - mn) / range) * 100 : 50
        }
      }
      return r
    })
  }, [chartData, normalize, signals])

  // ── Visible signal list (for rendering Lines) ────
  const visibleSignals = useMemo(
    () => signals.filter(s => visibility[s.signal_name] !== false),
    [signals, visibility],
  )

  // ── Filtered legend list ─────────────────────────
  const filteredLegend = useMemo(() => {
    if (!legendQuery.trim()) return signals
    const q = legendQuery.toLowerCase()
    return signals.filter(s =>
      s.signal_name.toLowerCase().includes(q) ||
      (s.signal_title ?? '').toLowerCase().includes(q)
    )
  }, [signals, legendQuery])

  // ── Range presets ────────────────────────────────
  const setPreset = useCallback((range: HistoryRange) => {
    setActiveRange(range)
    setFromTs(new Date(Date.now() - presetMs(range)))
  }, [])

  const setCustomFrom = useCallback((value: string) => {
    const next = fromLocalInputValue(value)
    if (!next) return
    setActiveRange(null)
    setFromTs(next)
  }, [])

  const zoom = useCallback((factor: number) => {
    const center = (fromTs.getTime() + toTs.getTime()) / 2
    const span   = toTs.getTime() - fromTs.getTime()
    const newSpan = Math.max(60_000, Math.min(2 * 365 * 86400_000, span * factor))
    const nextTo = Math.min(Date.now(), center + newSpan / 2)
    setActiveRange(null)
    setFromTs(new Date(nextTo - newSpan))
  }, [fromTs, toTs])

  // ── Ctrl/Shift + wheel zoom ──────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.shiftKey && !e.metaKey) return
      e.preventDefault()
      zoom(e.deltaY < 0 ? 0.7 : 1.4)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [zoom])

  // ── Bulk visibility actions ──────────────────────
  const toggleAll = useCallback((on: boolean) => {
    const m: Record<string, boolean> = {}
    signals.forEach(s => { m[s.signal_name] = on })
    setVisibility(m)
  }, [signals])

  const visibleCount = visibleSignals.length
  const totalPoints  = chartData.length
  const spanMs       = toTs.getTime() - fromTs.getTime()

  return (
    <div ref={containerRef} className="chart-frame overflow-hidden flex flex-col h-full">
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-elevated)]/45 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-1 h-7 rounded-full bg-gradient-to-b from-[var(--electric)] to-[var(--electric-light)]" />
          <div>
            <div className="text-[13px] font-semibold text-[var(--text)] flex items-center gap-2">
              <span>{visibleCount} / {signals.length}</span>
              <span className="text-[10px] font-normal text-ink-300">signal</span>
              {isFetching && !isLoading && (
                <span className="text-[10px] text-[var(--electric)] flex items-center gap-1">
                  <Loader2 size={9} className="animate-spin" /> yangilanmoqda
                </span>
              )}
              {isChunking && (
                <span className="text-[10px] text-[#FFAA00] flex items-center gap-1">
                  <Loader2 size={9} className="animate-spin" /> chizilmoqda
                </span>
              )}
            </div>
            <div className="text-[10px] text-ink-300/60 font-mono">
              {totalPoints} ta nuqta · {format(fromTs, 'dd MMM HH:mm')} → {format(toTs, 'dd MMM HH:mm')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Normalize toggle */}
          <button
            onClick={() => setNormalize(v => !v)}
            className={`
              flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium
              transition-all border
              ${normalize
                ? 'control-chip-active border-transparent'
                : 'bg-[var(--bg-card)] text-ink-300 hover:text-[var(--text)] border-[var(--border)]'
              }
            `}
            title="Hammasi 0-100% ga normalize"
          >
            <Percent size={11} />
            Norm
          </button>

          {/* Zoom buttons */}
          <div className="flex items-center gap-0.5 p-0.5 control-chip">
            <button
              onClick={() => zoom(0.6)}
              className="w-6 h-6 rounded flex items-center justify-center text-ink-300 hover:text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"
              title="Yaqinlashtirish (Ctrl+Scroll up)"
            >
              <ZoomIn size={12} />
            </button>
            <button
              onClick={() => zoom(1.7)}
              className="w-6 h-6 rounded flex items-center justify-center text-ink-300 hover:text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"
              title="Uzoqlashtirish (Ctrl+Scroll down)"
            >
              <ZoomOut size={12} />
            </button>
            <button
              onClick={() => setPreset('1y')}
              className="w-6 h-6 rounded flex items-center justify-center text-ink-300 hover:text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"
              title="Hammasini ko'rsatish"
            >
              <RotateCcw size={11} />
            </button>
          </div>

          {/* Presets */}
          <div className="flex items-center gap-0.5 p-0.5 control-chip">
            {RANGE_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={`
                  px-2 h-6 rounded text-[10px] font-medium
                  transition-colors
                  ${activeRange === p.value
                    ? 'control-chip-active'
                    : 'text-ink-300 hover:text-[var(--text)] hover:bg-[var(--bg-subtle)]'
                  }
                `}
              >
                {p.shortLabel}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 control-chip px-2 py-1">
            <label className="flex items-center gap-1 text-[10px] text-ink-300">
              Dan
              <input
                type="datetime-local"
                step={1}
                value={toLocalInputValue(fromTs)}
                onChange={e => setCustomFrom(e.target.value)}
                className="h-6 w-[155px] rounded bg-[var(--bg-base)] border border-[var(--border)] px-1.5 text-[10px] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--electric)]/40"
              />
            </label>
            <label className="flex items-center gap-1 text-[10px] text-ink-300">
              Gacha
              <input
                type="datetime-local"
                step={1}
                value={toLocalInputValue(toTs)}
                readOnly
                className="h-6 w-[155px] rounded bg-[var(--bg-base)] border border-[var(--electric)]/30 px-1.5 text-[10px] text-[var(--text)]"
              />
            </label>
          </div>
        </div>
      </div>

      {/* ── Body: chart + legend ──────────────────── */}
      <div className="flex-1 flex overflow-hidden" style={{ minHeight: height }}>
        {/* Chart */}
        <div className="flex-1 relative p-2">
          {isLoading && totalPoints === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={26} className="animate-spin text-[var(--electric)]" />
                <span className="text-[12px] text-ink-300">Yuklanmoqda...</span>
              </div>
            </div>
          )}
          {isError && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-2">
                <AlertCircle size={22} className="text-[#FF3D71]/60" />
                <span className="text-[12px] text-ink-300">Ma'lumot yuklanmadi</span>
              </div>
            </div>
          )}
          {!isLoading && !isError && totalPoints === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-2">
                <TrendingUp size={22} className="text-ink-300/30" />
                <span className="text-[12px] text-ink-300">Tarix topilmadi</span>
              </div>
            </div>
          )}

          {totalPoints > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={displayData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  {visibleSignals.map(sig => {
                    const c = signalColors[sig.signal_name]
                    return (
                      <linearGradient key={sig.id} id={`grad-${sig.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={c} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={c} stopOpacity={0} />
                      </linearGradient>
                    )
                  })}
                </defs>

                <CartesianGrid
                  stroke="rgba(30,34,64,0.5)"
                  strokeDasharray="3 5"
                  vertical={false}
                />

                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  scale="time"
                  tickFormatter={(t) => fmtTick(t, spanMs)}
                  stroke="#6B7494"
                  fontSize={10}
                  axisLine={{ stroke: 'rgba(30,34,64,0.8)' }}
                  tickLine={false}
                  minTickGap={48}
                  tick={{ fill: '#6B7494', fontFamily: 'JetBrains Mono, monospace' }}
                />

                <YAxis
                  stroke="#6B7494"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                  domain={normalize ? [0, 100] : ['auto', 'auto']}
                  tickFormatter={v => normalize ? `${Math.round(v)}%` : axisFmt(Number(v))}
                  width={normalize ? 44 : 56}
                  tick={{ fill: '#6B7494', fontFamily: 'JetBrains Mono, monospace' }}
                />

                <Tooltip
                  content={(
                    <EliteTooltip
                      signals={visibleSignals}
                      normalize={normalize}
                      originalData={chartData}
                    />
                  )}
                  cursor={{ stroke: 'rgba(41,121,255,0.5)', strokeWidth: 1, strokeDasharray: '3 3' }}
                  wrapperStyle={{ outline: 'none' }}
                  isAnimationActive={false}
                />

                {/* Subtle area gradients (only when 1 signal selected — cleaner look) */}
                {visibleSignals.length === 1 && (
                  <Area
                    type="monotone"
                    dataKey={visibleSignals[0].signal_name}
                    stroke="none"
                    fill={`url(#grad-${visibleSignals[0].id})`}
                    isAnimationActive={false}
                  />
                )}

                {visibleSignals.map(sig => (
                  <Line
                    key={sig.id}
                    type="monotone"
                    dataKey={sig.signal_name}
                    stroke={signalColors[sig.signal_name]}
                    strokeWidth={1.75}
                    dot={false}
                    activeDot={{
                      r:           4,
                      strokeWidth: 2,
                      fill:        signalColors[sig.signal_name],
                      stroke:      '#0C0F1E',
                    }}
                    isAnimationActive={false}
                    connectNulls
                  />
                ))}

                <Brush
                  dataKey="ts"
                  height={28}
                  stroke="rgba(41,121,255,0.6)"
                  fill="rgba(41,121,255,0.04)"
                  travellerWidth={8}
                  tickFormatter={(t) => fmtTick(Number(t), spanMs)}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Legend ─────────────────────────────────── */}
        <div className="w-[260px] border-l border-[var(--border)] flex flex-col bg-[var(--bg-elevated)]/30">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-300/60">
              Signallar ({visibleCount}/{signals.length})
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleAll(true)}
                className="w-5 h-5 rounded flex items-center justify-center text-ink-300 hover:text-[var(--electric)] transition-colors"
                title="Hammasini ko'rsatish"
              >
                <Eye size={11} />
              </button>
              <button
                onClick={() => toggleAll(false)}
                className="w-5 h-5 rounded flex items-center justify-center text-ink-300 hover:text-[#FF3D71] transition-colors"
                title="Hammasini yashirish"
              >
                <EyeOff size={11} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-2 py-2 border-b border-[var(--border)]">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                value={legendQuery}
                onChange={e => setLegendQuery(e.target.value)}
                placeholder="Signal qidirish..."
                className="
                  w-full h-7 pl-7 pr-2 rounded-md
                  bg-[var(--bg-card)] border border-[var(--border)]
                  text-[11px] text-[var(--text)] placeholder:text-ink-300/40
                  focus:outline-none focus:ring-1 focus:ring-[var(--electric)]/40
                "
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto py-1">
            {filteredLegend.map(sig => {
              const visible = visibility[sig.signal_name] !== false
              const color   = signalColors[sig.signal_name]
              return (
                <button
                  key={sig.id}
                  onClick={() => setVisibility(prev => ({
                    ...prev,
                    [sig.signal_name]: !visible,
                  }))}
                  className={`
                    w-full px-3 py-1.5 flex items-center gap-2 text-left
                    transition-all group
                    ${visible
                      ? 'hover:bg-[var(--bg-subtle)]/50'
                      : 'opacity-40 hover:opacity-70'
                    }
                  `}
                  title={sig.signal_title || sig.signal_name}
                >
                  {/* Color swatch — solid when visible, outline when hidden */}
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0 transition-all"
                    style={{
                      backgroundColor: visible ? color : 'transparent',
                      boxShadow: visible ? `0 0 4px ${color}66` : 'none',
                      border:    `1.5px solid ${color}`,
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-[var(--text)] truncate">
                        {sig.signal_name}
                      </span>
                      {sig.unit && (
                        <span className="text-[9px] font-mono text-ink-300/60 flex-shrink-0">
                          {sig.unit}
                        </span>
                      )}
                    </div>
                    {sig.signal_title && (
                      <span className="text-[9px] text-ink-300/60 truncate block">
                        {sig.signal_title}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
            {filteredLegend.length === 0 && (
              <div className="px-3 py-8 text-center text-[11px] text-ink-300/50">
                Natija topilmadi
              </div>
            )}
          </div>

          {/* Tip footer */}
          <div className="px-3 py-2 border-t border-[var(--border)] text-[9px] text-ink-300/40 leading-tight">
            <kbd className="px-1 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border)] text-ink-300 mr-1">Ctrl</kbd>
            + Scroll: zoom
            <br />
            Brush past tomondan: range tanlash
          </div>
        </div>
      </div>
    </div>
  )
}

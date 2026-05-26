import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import {
  ResponsiveContainer, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Brush,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2, AlertCircle, TrendingUp, Eye, EyeOff,
  ZoomIn, ZoomOut, RotateCcw, Percent, Search, GitCompare,
  ChevronDown, Wifi, WifiOff,
} from 'lucide-react'
import { format } from 'date-fns'
import { telemetryApi, deviceApi, type RangePoint } from '@/lib/api'
import { useDispatcherStore } from '@/store/dispatcher'
import type { Device } from '@/types'

// ──────────────────────────────────────────────────
//  DiffPage — Cross-device signal comparison
// ──────────────────────────────────────────────────
//
//  URL: /diff?signal=<name>&range=<hours>
//
//  Pick a signal name → see one line per device that has that signal,
//  each in a distinct color.  Useful for comparing how the same metric
//  arrives at different sites.
// ──────────────────────────────────────────────────

// 24 colors (more than TradingChart's 16 — diff often has many devices)
const COLOR_PALETTE = [
  '#2979FF', '#00D68F', '#FFAA00', '#FF3D71',
  '#7B5FFF', '#00C2FF', '#FF6B35', '#FFD060',
  '#9DEC6D', '#FF7AC0', '#5EEAD4', '#A78BFA',
  '#FACC15', '#F87171', '#34D399', '#60A5FA',
  '#F472B6', '#FB923C', '#A3E635', '#22D3EE',
  '#E879F9', '#FCD34D', '#84CC16', '#0EA5E9',
]

const DEFAULT_VISIBLE = 12

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
  return v.toFixed(3)
}

function fmtTick(ts: number, spanMs: number): string {
  const d = new Date(ts)
  if (spanMs <= 60 * 60_000)     return format(d, 'HH:mm:ss')
  if (spanMs <= 24 * 3600_000)   return format(d, 'HH:mm')
  if (spanMs <= 7 * 86400_000)   return format(d, 'EEE HH:mm')
  if (spanMs <= 30 * 86400_000)  return format(d, 'dd MMM')
  if (spanMs <= 365 * 86400_000) return format(d, 'dd MMM')
  return format(d, 'MMM yyyy')
}

// ──────────────────────────────────────────────────
//  Tooltip
// ──────────────────────────────────────────────────
interface TooltipProps {
  active?:       boolean
  payload?:      any[]
  label?:        number
  devicesById:   Map<number, Device>
}

function DiffTooltip({ active, payload, label, devicesById }: TooltipProps) {
  if (!active || !payload?.length || label == null) return null

  const entries = payload
    .filter(p => p.value != null)
    .map(p => {
      const devId = Number(p.dataKey)
      const dev   = devicesById.get(devId)
      return {
        devId,
        name:  dev?.name ?? `#${devId}`,
        value: p.value as number,
        color: p.stroke as string,
      }
    })
    .sort((a, b) => b.value - a.value)

  // Auto column count — fit all entries without scrolling
  const n = entries.length
  const cols = n <= 8 ? 1
             : n <= 18 ? 2
             : n <= 32 ? 3
             : 4

  // Approximate width per column (color dot + name + value)
  const colWidth = 170
  const totalWidth = cols * colWidth + 24  // padding

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
      <div className="text-[10px] font-mono font-medium text-ink-300 mb-2 pb-2 border-b border-[var(--border)] flex items-center justify-between">
        <span>{format(new Date(label), 'yyyy-MM-dd HH:mm:ss')}</span>
        <span className="text-ink-300/40">{n} ta qurilma</span>
      </div>
      <div
        className="grid gap-x-3 gap-y-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {entries.map(e => (
          <div key={e.devId} className="flex items-center justify-between gap-2 text-[10px] min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: e.color, boxShadow: `0 0 4px ${e.color}` }}
              />
              <span className="text-ink-200 truncate font-mono text-[10px]">{e.name}</span>
            </div>
            <span className="font-mono font-semibold text-[var(--text)] flex-shrink-0 text-[11px]">
              {fmtVal(e.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────
//  Signal Picker (searchable dropdown)
// ──────────────────────────────────────────────────
function SignalPicker({
  value, onChange, signals, isLoading,
}: {
  value: string | null
  onChange: (title: string) => void
  signals: Array<{ signal_title: string; device_count: number; unit: string | null; sample_names: string[] }>
  isLoading: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  // ── Compute dropdown position from trigger rect ──
  useEffect(() => {
    if (!open) return
    const update = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setPos({
        top:   r.bottom + 4,
        right: window.innerWidth - r.right,
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const filtered = useMemo(() => {
    if (!query.trim()) return signals
    const q = query.toLowerCase()
    return signals.filter(s =>
      s.signal_title.toLowerCase().includes(q) ||
      s.sample_names.some(n => n.toLowerCase().includes(q))
    )
  }, [signals, query])

  const selected = signals.find(s => s.signal_title === value)

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        className="
          flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg
          bg-[var(--bg-card)] text-[var(--text)]
          border border-[var(--border)] hover:border-[var(--border-hover)]
          transition-all text-[13px] font-medium min-w-[280px]
        "
      >
        <GitCompare size={13} className="text-[var(--electric)]" />
        <div className="flex-1 text-left">
          {selected ? (
            <div>
              <span className="font-semibold">{selected.signal_title}</span>
              <span className="text-ink-300 ml-1.5 font-normal">
                · {selected.device_count} ta qurilma
              </span>
            </div>
          ) : (
            <span className="text-ink-300">Signal tanlang...</span>
          )}
        </div>
        <ChevronDown size={13} className={`text-ink-300 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Portal: backdrop + dropdown render to document.body ── */}
      {open && pos && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div
            className="fixed z-[9999] w-[420px] glass-card rounded-xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.7)] border border-[var(--border-hover)]"
            style={{ top: pos.top, right: pos.right }}
          >
          {/* Search */}
          <div className="p-2 border-b border-[var(--border)]">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Signal qidirish..."
                autoFocus
                className="
                  w-full h-8 pl-8 pr-2 rounded-md
                  bg-[var(--bg-base)] border border-[var(--border)]
                  text-[12px] text-[var(--text)] placeholder:text-ink-300/40
                  focus:outline-none focus:ring-1 focus:ring-[var(--electric)]/40
                "
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-8 text-center text-[11px] text-ink-300">
                <Loader2 size={16} className="animate-spin mx-auto mb-2" />
                Yuklanmoqda...
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-[11px] text-ink-300">
                Topilmadi
              </div>
            ) : filtered.map(s => (
              <button
                key={s.signal_title}
                onClick={() => { onChange(s.signal_title); setOpen(false); setQuery('') }}
                className={`
                  w-full px-3 py-2 flex items-center justify-between gap-2 text-left
                  border-b border-[var(--border)]/40 last:border-0
                  ${s.signal_title === value
                    ? 'bg-[var(--electric)]/10'
                    : 'hover:bg-[var(--bg-subtle)]/50'
                  }
                `}
              >
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--text)] truncate">
                    {s.signal_title}
                  </div>
                  {s.sample_names.length > 0 && (
                    <div className="text-[10px] font-mono text-ink-300/60 truncate">
                      {s.sample_names.slice(0, 3).join(' · ')}
                      {s.sample_names.length > 3 && ` · +${s.sample_names.length - 3}`}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className="text-[10px] font-mono text-[var(--electric-light)] px-1.5 py-0.5 rounded bg-[var(--electric)]/10">
                    {s.device_count} dev
                  </span>
                  {s.unit && (
                    <span className="text-[9px] font-mono text-ink-300/60">{s.unit}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// ──────────────────────────────────────────────────
//  Main Page
// ──────────────────────────────────────────────────
export function DiffPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  // URL: ?title=<signal_title>  (legacy ?signal= still accepted for old links)
  const selectedTitle = searchParams.get('title') ?? searchParams.get('signal')
  const statuses = useDispatcherStore(s => s.statuses)
  useDispatcherStore(s => s.revisions)

  const setSelectedTitle = useCallback((title: string) => {
    setSearchParams(prev => {
      prev.delete('signal')         // drop legacy param
      prev.set('title', title)
      return prev
    }, { replace: true })
  }, [setSearchParams])

  // ── Time range state ─────────────────────────────
  const [fromTs, setFromTs] = useState<Date>(() => new Date(Date.now() - 86400_000))
  const [toTs,   setToTs]   = useState<Date>(() => new Date())

  // ── UI state ─────────────────────────────────────
  const [normalize, setNormalize] = useState(false)
  const [legendQuery, setLegendQuery] = useState('')
  const [visibility, setVisibility] = useState<Record<number, boolean>>({})

  const containerRef = useRef<HTMLDivElement>(null)

  // ── Load available signal names ──────────────────
  const { data: signals = [], isLoading: signalsLoading } = useQuery({
    queryKey: ['diff-signals'],
    queryFn:  ({ signal }) => telemetryApi.diffSignals(2, signal),
    staleTime: 5 * 60_000,
  })

  // ── Load all devices (for legend names + IPs) ───
  const { data: devicesPage } = useQuery({
    queryKey: ['devices-all'],
    queryFn:  ({ signal }) => deviceApi.listAll(signal),
    staleTime: 60_000,
  })
  const devices: Device[] = devicesPage ?? []

  const devicesById = useMemo(() => {
    const m = new Map<number, Device>()
    for (const d of devices) m.set(d.id, d)
    return m
  }, [devices])

  // ── Fetch diff data ──────────────────────────────
  const { data: dataMap = {}, isLoading, isError, isFetching } = useQuery({
    queryKey: ['diff', selectedTitle, fromTs.getTime(), toTs.getTime()],
    queryFn:  ({ signal: abortSignal }) => telemetryApi.diff({
      signal_title: selectedTitle!,
      from_ts:      fromTs,
      to_ts:        toTs,
    }, abortSignal),
    staleTime: 30_000,
    placeholderData: prev => prev,
    enabled: !!selectedTitle,
  })

  // ── Convert string keys (from JSON) → number ─────
  const deviceIds = useMemo(() => {
    return Object.keys(dataMap).map(Number).sort((a, b) => a - b)
  }, [dataMap])

  // ── Color map per device ─────────────────────────
  const deviceColors = useMemo(() => {
    const m: Record<number, string> = {}
    deviceIds.forEach((id, i) => {
      m[id] = COLOR_PALETTE[i % COLOR_PALETTE.length]
    })
    return m
  }, [deviceIds])

  // ── Initialize visibility when device set changes ─
  useEffect(() => {
    if (deviceIds.length === 0) return
    setVisibility(prev => {
      const m: Record<number, boolean> = {}
      deviceIds.forEach((id, i) => {
        // Keep previous setting if exists; otherwise default first N visible
        m[id] = prev[id] ?? (i < DEFAULT_VISIBLE)
      })
      return m
    })
  }, [deviceIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Merge to row-oriented data ───────────────────
  const chartData = useMemo(() => {
    const rows = new Map<number, Record<string, any>>()
    for (const [devIdStr, points] of Object.entries(dataMap as Record<string, RangePoint[]>)) {
      for (const p of points) {
        const t = new Date(p.ts).getTime()
        if (!rows.has(t)) rows.set(t, { ts: t })
        rows.get(t)![devIdStr] = p.avg
      }
    }
    return Array.from(rows.values()).sort((a, b) => a.ts - b.ts)
  }, [dataMap])

  // ── Normalize ────────────────────────────────────
  const displayData = useMemo(() => {
    if (!normalize) return chartData
    const minMax: Record<string, [number, number]> = {}
    for (const id of deviceIds) {
      let min = Infinity, max = -Infinity
      const key = String(id)
      for (const row of chartData) {
        const v = row[key]
        if (typeof v === 'number') {
          if (v < min) min = v
          if (v > max) max = v
        }
      }
      minMax[key] = [min, max]
    }
    return chartData.map(row => {
      const r: Record<string, any> = { ts: row.ts }
      for (const id of deviceIds) {
        const key = String(id)
        const v = row[key]
        if (typeof v === 'number') {
          const [mn, mx] = minMax[key]
          const range = mx - mn
          r[key] = range > 0 ? ((v - mn) / range) * 100 : 50
        }
      }
      return r
    })
  }, [chartData, normalize, deviceIds])

  const visibleDevices = useMemo(
    () => deviceIds.filter(id => visibility[id] !== false),
    [deviceIds, visibility]
  )

  // ── Filtered legend ──────────────────────────────
  const filteredLegend = useMemo(() => {
    if (!legendQuery.trim()) return deviceIds
    const q = legendQuery.toLowerCase()
    return deviceIds.filter(id => {
      const d = devicesById.get(id)
      return d && (
        d.name.toLowerCase().includes(q) ||
        d.iec104_host.includes(q)
      )
    })
  }, [deviceIds, legendQuery, devicesById])

  // ── Range presets ────────────────────────────────
  const setPreset = useCallback((sec: number) => {
    setToTs(new Date())
    setFromTs(new Date(Date.now() - sec * 1000))
  }, [])

  const zoom = useCallback((factor: number) => {
    const center = (fromTs.getTime() + toTs.getTime()) / 2
    const span   = toTs.getTime() - fromTs.getTime()
    const newSpan = Math.max(60_000, Math.min(2 * 365 * 86400_000, span * factor))
    setFromTs(new Date(center - newSpan / 2))
    setToTs(new Date(center + newSpan / 2))
  }, [fromTs, toTs])

  // Ctrl/Shift + wheel zoom
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

  const toggleAll = useCallback((on: boolean) => {
    const m: Record<number, boolean> = {}
    deviceIds.forEach(id => { m[id] = on })
    setVisibility(m)
  }, [deviceIds])

  const totalPoints = chartData.length
  const spanMs = toTs.getTime() - fromTs.getTime()

  const PRESETS = [
    { label: '15m', sec: 15 * 60 },
    { label: '1h',  sec: 3600 },
    { label: '6h',  sec: 6 * 3600 },
    { label: '1d',  sec: 86400 },
    { label: '1w',  sec: 7 * 86400 },
    { label: '1mo', sec: 30 * 86400 },
    { label: '3mo', sec: 90 * 86400 },
    { label: '1y',  sec: 365 * 86400 },
  ]

  const selectedMeta = signals.find(s => s.signal_title === selectedTitle)

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* ── Header ────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-base)]/80 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--electric)]/10 border border-[var(--electric)]/20 flex items-center justify-center flex-shrink-0">
              <GitCompare size={18} className="text-[var(--electric)]" />
            </div>
            <div>
              <h1 className="text-[17px] font-semibold text-[var(--text)]">
                Signal taqqoslash
              </h1>
              <p className="text-[11px] text-ink-300 mt-0.5">
                Bir xil signalning turli qurilmalardan kelishini solishtirish
              </p>
            </div>
          </div>

          {/* Signal picker */}
          <SignalPicker
            value={selectedTitle}
            onChange={setSelectedTitle}
            signals={signals}
            isLoading={signalsLoading}
          />
        </div>
      </div>

      {/* ── Body ──────────────────────────────────── */}
      {!selectedTitle ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
            <GitCompare size={28} className="text-ink-300/40" />
          </div>
          <div>
            <p className="text-[15px] font-medium text-[var(--text)]">Signal tanlang</p>
            <p className="text-[13px] text-ink-300 mt-1">
              Yuqoridagi tugmadan signal nomini tanlasangiz, uni o'qiyotgan
              <br />
              barcha qurilmalar grafikda turli rangda ko'rinadi.
            </p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden p-4">
          <div className="glass-card rounded-2xl overflow-hidden flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-[var(--border)] flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-1 h-7 rounded-full bg-gradient-to-b from-[var(--electric)] to-[var(--electric-light)]" />
                <div>
                  <div className="text-[14px] font-semibold text-[var(--text)] flex items-center gap-2">
                    {selectedTitle}
                    {selectedMeta?.unit && (
                      <span className="text-[10px] font-normal text-ink-300 font-mono">[{selectedMeta.unit}]</span>
                    )}
                    {isFetching && !isLoading && (
                      <span className="text-[10px] text-[var(--electric)] flex items-center gap-1">
                        <Loader2 size={9} className="animate-spin" /> yangilanmoqda
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-ink-300/60 font-mono">
                    {visibleDevices.length} / {deviceIds.length} qurilma · {totalPoints} ta nuqta
                    {selectedMeta && selectedMeta.sample_names.length > 0 && (
                      <span className="ml-2 text-ink-300/80">
                        · {selectedMeta.sample_names.slice(0, 3).join(', ')}
                        {selectedMeta.sample_names.length > 3 && ` +${selectedMeta.sample_names.length - 3}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setNormalize(v => !v)}
                  className={`
                    flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium
                    transition-all border
                    ${normalize
                      ? 'bg-[var(--electric)] text-white border-[var(--electric)]'
                      : 'bg-[var(--bg-card)] text-ink-300 hover:text-[var(--text)] border-[var(--border)]'
                    }
                  `}
                  title="Hammasi 0-100% ga normalize"
                >
                  <Percent size={11} /> Norm
                </button>

                <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border)]">
                  <button onClick={() => zoom(0.6)} className="w-6 h-6 rounded flex items-center justify-center text-ink-300 hover:text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"><ZoomIn size={12} /></button>
                  <button onClick={() => zoom(1.7)} className="w-6 h-6 rounded flex items-center justify-center text-ink-300 hover:text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"><ZoomOut size={12} /></button>
                  <button onClick={() => setPreset(365 * 86400)} className="w-6 h-6 rounded flex items-center justify-center text-ink-300 hover:text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"><RotateCcw size={11} /></button>
                </div>

                <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border)]">
                  {PRESETS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => setPreset(p.sec)}
                      className="px-2 h-6 rounded text-[10px] font-medium text-ink-300 hover:text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Body: chart + legend */}
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 relative p-2">
                {isLoading && totalPoints === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={24} className="animate-spin text-[var(--electric)]" />
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
                      <CartesianGrid stroke="rgba(30,34,64,0.5)" strokeDasharray="3 5" vertical={false} />

                      <XAxis
                        dataKey="ts" type="number"
                        domain={['dataMin', 'dataMax']}
                        scale="time"
                        tickFormatter={(t) => fmtTick(t, spanMs)}
                        stroke="#6B7494" fontSize={10}
                        axisLine={{ stroke: 'rgba(30,34,64,0.8)' }}
                        tickLine={false} minTickGap={48}
                        tick={{ fill: '#6B7494', fontFamily: 'JetBrains Mono, monospace' }}
                      />

                      <YAxis
                        stroke="#6B7494" fontSize={10}
                        axisLine={false} tickLine={false}
                        domain={normalize ? [0, 100] : ['auto', 'auto']}
                        tickFormatter={v => normalize ? `${Math.round(v)}%` : axisFmt(Number(v))}
                        width={normalize ? 44 : 56}
                        tick={{ fill: '#6B7494', fontFamily: 'JetBrains Mono, monospace' }}
                      />

                      <Tooltip
                        content={<DiffTooltip devicesById={devicesById} />}
                        cursor={{ stroke: 'rgba(41,121,255,0.5)', strokeWidth: 1, strokeDasharray: '3 3' }}
                        wrapperStyle={{ outline: 'none' }}
                        isAnimationActive={false}
                      />

                      {visibleDevices.map(devId => (
                        <Line
                          key={devId}
                          type="monotone"
                          dataKey={String(devId)}
                          stroke={deviceColors[devId]}
                          strokeWidth={1.75}
                          dot={false}
                          activeDot={{
                            r: 4, strokeWidth: 2,
                            fill:   deviceColors[devId],
                            stroke: '#0C0F1E',
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

              {/* Legend */}
              <div className="w-[260px] border-l border-[var(--border)] flex flex-col bg-[var(--bg-elevated)]/30">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-300/60">
                    Qurilmalar ({visibleDevices.length}/{deviceIds.length})
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleAll(true)} className="w-5 h-5 rounded flex items-center justify-center text-ink-300 hover:text-[var(--electric)] transition-colors" title="Hammasi"><Eye size={11} /></button>
                    <button onClick={() => toggleAll(false)} className="w-5 h-5 rounded flex items-center justify-center text-ink-300 hover:text-[#FF3D71] transition-colors" title="Yashirish"><EyeOff size={11} /></button>
                  </div>
                </div>

                <div className="px-2 py-2 border-b border-[var(--border)]">
                  <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
                    <input
                      value={legendQuery}
                      onChange={e => setLegendQuery(e.target.value)}
                      placeholder="Qurilma qidirish..."
                      className="w-full h-7 pl-7 pr-2 rounded-md bg-[var(--bg-card)] border border-[var(--border)] text-[11px] text-[var(--text)] placeholder:text-ink-300/40 focus:outline-none focus:ring-1 focus:ring-[var(--electric)]/40"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto py-1">
                  {filteredLegend.map(devId => {
                    const visible = visibility[devId] !== false
                    const color = deviceColors[devId]
                    const dev   = devicesById.get(devId)
                    const status = statuses[devId]
                    const online = status?.status === 'online'

                    return (
                      <button
                        key={devId}
                        onClick={() => setVisibility(prev => ({ ...prev, [devId]: !visible }))}
                        className={`
                          w-full px-3 py-1.5 flex items-center gap-2 text-left
                          transition-all group
                          ${visible ? 'hover:bg-[var(--bg-subtle)]/50' : 'opacity-40 hover:opacity-70'}
                        `}
                      >
                        <span
                          className="w-3 h-3 rounded-sm flex-shrink-0"
                          style={{
                            backgroundColor: visible ? color : 'transparent',
                            boxShadow: visible ? `0 0 4px ${color}66` : 'none',
                            border: `1.5px solid ${color}`,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-[var(--text)] truncate">
                              {dev?.name ?? `#${devId}`}
                            </span>
                            {online ? (
                              <Wifi size={9} className="text-[#00D68F] flex-shrink-0" />
                            ) : (
                              <WifiOff size={9} className="text-[#FF3D71] flex-shrink-0" />
                            )}
                          </div>
                          {dev?.iec104_host && dev.iec104_host !== dev.name && (
                            <span className="text-[9px] font-mono text-ink-300/60 truncate block">
                              {dev.iec104_host}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="px-3 py-2 border-t border-[var(--border)] text-[9px] text-ink-300/40 leading-tight">
                  <kbd className="px-1 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border)] text-ink-300 mr-1">Ctrl</kbd>
                  + Scroll: zoom
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

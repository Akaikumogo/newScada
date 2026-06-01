import { useMemo, useState, useRef, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Activity, AlertTriangle, CalendarDays, CheckCircle2, Clock,
  Loader2, WifiOff, ChevronDown, Layers,
} from 'lucide-react'
import { telemetryApi, type DeviceActivityDevice } from '@/lib/api'
import { fromLocalInputValue, toLocalInputValue } from '@/lib/timeRange'

// ── Helpers ────────────────────────────────────────────────────────────────

function dateInputValue(date: Date): string {
  return toLocalInputValue(date).slice(0, 10)
}
function startOfDay(value: string): Date {
  return new Date(`${value}T00:00:00`)
}
function endOfDay(value: string): Date {
  return new Date(`${value}T23:59:59`)
}
function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('uz-UZ', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) return rest ? `${hours}s ${rest}m` : `${hours}s`
  const days = Math.floor(hours / 24)
  const dayHours = hours % 24
  return dayHours ? `${days}k ${dayHours}s` : `${days}k`
}
function statusColor(uptime: number): string {
  return uptime >= 95 ? '#00D68F' : uptime > 0 ? '#FFAA00' : '#FF3D71'
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ActivityTone({ device }: { device: DeviceActivityDevice }) {
  if (device.total_records === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#FF3D71]">
        <WifiOff size={11} /> data yo'q
      </span>
    )
  }
  if (device.uptime_percent < 95) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#FFAA00]">
        <AlertTriangle size={11} /> uzilish bor
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#00D68F]">
      <CheckCircle2 size={11} /> barqaror
    </span>
  )
}

function UptimeRing({ percent, size = 50 }: { percent: number; size?: number }) {
  const sw = 3.5
  const r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const dash = (percent / 100) * circ
  const color = statusColor(percent)
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-bold font-mono leading-tight" style={{ color }}>
          {percent.toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

function StatChip({
  icon, label, value, accent,
}: {
  icon: ReactNode
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="rounded-lg bg-[var(--bg-subtle)]/40 border border-[var(--border)] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-ink-300 mb-1.5">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.1em]">{label}</span>
      </div>
      <div className="text-[12px] font-semibold" style={{ color: accent ?? 'var(--text)' }}>
        {value}
      </div>
    </div>
  )
}

function KpiCard({
  icon, label, value, color, total,
}: {
  icon: ReactNode
  label: string
  value: number
  color: string
  total: number
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-ink-300 uppercase tracking-[0.1em]">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="text-[26px] font-bold font-mono leading-none" style={{ color }}>
        {value}
      </div>
      <div className="mt-2.5 h-[3px] rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
        />
      </div>
      <div className="mt-1.5 text-[10px] text-ink-300 font-mono">{pct.toFixed(0)}% of {total}</div>
    </div>
  )
}

// ── Fleet Heatmap (bird's eye view + interactive time axis) ───────────────

function formatTimeAxis(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleString('uz-UZ', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

type Segment = { start: number; end: number; active: boolean; records: number }

function buildSegments(timeline: DeviceActivityDevice['timeline']): Segment[] {
  if (timeline.length === 0) return []
  const segs: Segment[] = []
  let cur: Segment = { start: 0, end: 0, active: timeline[0].active, records: timeline[0].record_count }
  for (let i = 1; i < timeline.length; i++) {
    if (timeline[i].active === cur.active) {
      cur.end = i
      cur.records += timeline[i].record_count
    } else {
      segs.push(cur)
      cur = { start: i, end: i, active: timeline[i].active, records: timeline[i].record_count }
    }
  }
  segs.push(cur)
  return segs
}

function findSegment(segments: Segment[], bi: number): Segment | null {
  for (const s of segments) {
    if (bi >= s.start && bi <= s.end) return s
  }
  return null
}

function FleetHeatmap({
  devices, bucketSec,
}: {
  devices: DeviceActivityDevice[]
  bucketSec: number
}) {
  const [hoveredBucket, setHoveredBucket] = useState<number | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timeAxisRef = useRef<HTMLDivElement>(null)
  const firstBarRef = useRef<HTMLDivElement>(null)

  const totalBuckets = devices[0]?.timeline.length ?? 0
  const tickInterval = Math.max(1, Math.round(totalBuckets / 10))

  const segmentsMap = useMemo(() => {
    const map = new Map<number, Segment[]>()
    for (const d of devices) map.set(d.device_id, buildSegments(d.timeline))
    return map
  }, [devices])

  const calcBucket = useCallback((e: React.MouseEvent, barEl?: HTMLDivElement | null) => {
    const el = barEl ?? firstBarRef.current
    if (!el || totalBuckets === 0) return null
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < 0 || x > rect.width) return null
    return Math.max(0, Math.min(totalBuckets - 1, Math.floor((x / rect.width) * totalBuckets)))
  }, [totalBuckets])

  const handleRowMove = useCallback((e: React.MouseEvent, di: number) => {
    const bi = calcBucket(e)
    setHoveredBucket(bi)
    setHoveredRow(bi !== null ? di : null)
  }, [calcBucket])

  const handleLeave = useCallback(() => {
    setHoveredBucket(null)
    setHoveredRow(null)
  }, [])

  // Sync horizontal scroll between rows and time axis
  const handleScroll = useCallback(() => {
    if (scrollRef.current && timeAxisRef.current) {
      timeAxisRef.current.scrollLeft = scrollRef.current.scrollLeft
    }
  }, [])

  if (devices.length === 0) return null

  const hoveredTs = hoveredBucket !== null ? (devices[0]?.timeline[hoveredBucket]?.ts ?? null) : null

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={13} className="text-[var(--electric)]" />
          <span className="text-[13px] font-semibold text-[var(--text)]">Barcha qurilmalar</span>
          <span className="text-[11px] text-ink-300">
            {devices.length} ta · bucket {formatDuration(bucketSec)}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div
            className="font-mono text-[11px] text-white font-semibold transition-opacity duration-150"
            style={{ opacity: hoveredTs ? 1 : 0 }}
          >
            {hoveredTs ? formatTimeAxis(hoveredTs) : ''}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-ink-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[#00D68F] opacity-75 inline-block" />
              faol
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[#FF3D71] opacity-65 inline-block" />
              uzilish
            </span>
          </div>
        </div>
      </div>

      {/* Heatmap body — 3-column layout: sticky left | scrollable middle | sticky right */}
      <div className="pt-3 pb-2 select-none">
        <div className="flex">
          {/* ── LEFT: device names (sticky) ─────────── */}
          <div className="shrink-0 w-[130px] pl-4 pr-2 z-10">
            {devices.map((device, di) => (
              <div
                key={device.device_id}
                className="h-[18px] flex items-center justify-end"
              >
                <span
                  className="text-[10px] font-mono truncate transition-colors duration-100"
                  style={{
                    color: hoveredRow === di ? '#fff' : undefined,
                    fontWeight: hoveredRow === di ? 600 : 400,
                  }}
                  title={`${device.name} (${device.host}:${device.port})`}
                >
                  {device.name}
                </span>
              </div>
            ))}
          </div>

          {/* ── MIDDLE: scrollable timeline bars ────── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-x-auto overflow-y-hidden relative"
            onScroll={handleScroll}
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
          >
            <div style={{ minWidth: Math.max(totalBuckets * 3, 600) }}>
              {devices.map((device, di) => {
                const seg = hoveredRow === di && hoveredBucket !== null
                  ? findSegment(segmentsMap.get(device.device_id) ?? [], hoveredBucket)
                  : null

                return (
                  <div key={device.device_id} className="relative">
                    {/* Timeline bars */}
                    <div
                      ref={di === 0 ? firstBarRef : undefined}
                      className="flex gap-[1px] h-[18px]"
                      onMouseMove={e => handleRowMove(e, di)}
                      onMouseLeave={handleLeave}
                    >
                      {device.timeline.map((bucket, bi) => {
                        const isHot = bi === hoveredBucket
                        const isInSeg = seg && bi >= seg.start && bi <= seg.end && hoveredRow === di
                        return (
                          <div
                            key={bi}
                            className="flex-1 rounded-[1px]"
                            style={{
                              minWidth: 2,
                              backgroundColor: bucket.active ? '#00D68F' : '#FF3D71',
                              opacity: isHot ? 1 : isInSeg ? 0.85 : bucket.active ? 0.6 : 0.45,
                              transform: isHot ? 'scaleY(1.4)' : 'scaleY(1)',
                              boxShadow: isHot
                                ? `0 0 5px ${bucket.active ? '#00D68F' : '#FF3D71'}`
                                : 'none',
                              transition: 'opacity 75ms, transform 75ms, box-shadow 75ms',
                            }}
                          />
                        )
                      })}
                    </div>

                    {/* ── Inline segment tooltip (row-level) ─── */}
                    {seg && hoveredRow === di && hoveredBucket !== null && (
                      <div
                        className="absolute z-30 pointer-events-none"
                        style={{
                          left: `${((seg.start + seg.end) / 2 / totalBuckets) * 100}%`,
                          bottom: '100%',
                          transform: 'translateX(-50%)',
                          marginBottom: 4,
                        }}
                      >
                        <div
                          className="rounded-lg px-3 py-2.5 shadow-2xl border backdrop-blur-md whitespace-nowrap"
                          style={{
                            backgroundColor: 'rgba(8,12,24,0.95)',
                            borderColor: seg.active ? 'rgba(0,214,143,0.4)' : 'rgba(255,61,113,0.4)',
                            minWidth: 180,
                          }}
                        >
                          {/* Status */}
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{
                                backgroundColor: seg.active ? '#00D68F' : '#FF3D71',
                                boxShadow: `0 0 6px ${seg.active ? '#00D68F' : '#FF3D71'}80`,
                              }}
                            />
                            <span className="text-[12px] font-bold" style={{ color: seg.active ? '#00D68F' : '#FF3D71' }}>
                              {seg.active ? 'Faol' : 'Offline'}
                            </span>
                            <span className="text-[12px] font-bold text-white ml-auto">
                              {formatDuration((seg.end - seg.start + 1) * bucketSec)}
                            </span>
                          </div>
                          {/* Details grid */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono">
                            <span className="text-ink-300">Boshi:</span>
                            <span className="text-white text-right">{formatTimeAxis(device.timeline[seg.start].ts)}</span>
                            <span className="text-ink-300">Oxiri:</span>
                            <span className="text-white text-right">{formatTimeAxis(device.timeline[seg.end].ts)}</span>
                            {seg.active && (
                              <>
                                <span className="text-ink-300">Records:</span>
                                <span className="text-[#00D68F] font-semibold text-right">{seg.records.toLocaleString()}</span>
                              </>
                            )}
                          </div>
                          {/* Arrow */}
                          <div
                            className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
                            style={{
                              top: '100%',
                              borderLeft: '6px solid transparent',
                              borderRight: '6px solid transparent',
                              borderTop: `6px solid ${seg.active ? 'rgba(0,214,143,0.4)' : 'rgba(255,61,113,0.4)'}`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── RIGHT: info column (sticky) ────────── */}
          <div className="shrink-0 w-[90px] pr-4 pl-2 z-10">
            {devices.map((device, di) => {
              const bucketData = hoveredBucket !== null ? device.timeline[hoveredBucket] : null
              const activeSec = device.active_buckets * bucketSec
              const isRow = hoveredRow === di

              return (
                <div key={device.device_id} className="h-[18px] flex items-center justify-end">
                  {isRow && bucketData ? (
                    <span
                      className="text-[10px] font-mono font-bold"
                      style={{ color: bucketData.active ? '#00D68F' : '#FF3D71' }}
                    >
                      {bucketData.active ? `${bucketData.record_count} rec` : 'offline'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[10px] font-mono">
                      <span className="font-bold" style={{ color: statusColor(device.uptime_percent) }}>
                        {device.uptime_percent.toFixed(0)}%
                      </span>
                      <span className="text-[8px] text-ink-300">{formatDuration(activeSec)}</span>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Time axis (synced scroll) ──────────────── */}
        {totalBuckets > 0 && (
          <div className="flex mt-2 pt-2 border-t border-white/[0.06]">
            <div className="shrink-0 w-[130px]" />
            <div
              ref={timeAxisRef}
              className="flex-1 overflow-hidden"
              style={{ height: 28 }}
            >
              <div
                className="flex gap-[1px] relative"
                style={{ minWidth: Math.max(totalBuckets * 3, 600), height: 28 }}
              >
                {devices[0].timeline.map((bucket, bi) => {
                  const isHot = bi === hoveredBucket
                  const showRegular = bi % tickInterval === 0
                  if (!showRegular && !isHot) {
                    return <div key={bi} className="flex-1" style={{ minWidth: 2 }} />
                  }
                  return (
                    <div key={bi} className="flex-1 relative flex flex-col items-center" style={{ minWidth: 2 }}>
                      <div
                        className="w-[1px]"
                        style={{
                          height: isHot ? 6 : 4,
                          backgroundColor: isHot ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.18)',
                          transition: 'all 100ms',
                        }}
                      />
                      <span
                        className="absolute font-mono whitespace-nowrap"
                        style={{
                          top: 7,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: isHot ? 11 : 9,
                          fontWeight: isHot ? 700 : 400,
                          color: isHot ? '#ffffff' : 'rgba(107,116,148,0.55)',
                          textShadow: isHot ? '0 0 8px rgba(255,255,255,0.4)' : 'none',
                          transition: 'all 100ms',
                        }}
                      >
                        {formatTimeAxis(bucket.ts)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="shrink-0 w-[90px]" />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared interactive timeline with time axis ──────────────────────────────

function InteractiveTimeline({
  timeline, height = 22, tickCount = 8,
}: {
  timeline: DeviceActivityDevice['timeline']
  height?: number
  tickCount?: number
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const total = timeline.length

  const tickInterval = Math.max(1, Math.round(total / tickCount))

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!barRef.current || total === 0) return
    const rect = barRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < 0 || x > rect.width) { setHovered(null); return }
    setHovered(Math.max(0, Math.min(total - 1, Math.floor((x / rect.width) * total))))
  }, [total])

  const onLeave = useCallback(() => setHovered(null), [])

  const hoveredTs = hovered !== null ? (timeline[hovered]?.ts ?? null) : null
  const hoveredBucket = hovered !== null ? timeline[hovered] : null

  return (
    <div className="select-none" onMouseMove={onMove} onMouseLeave={onLeave}>
      {/* Hovered info pill */}
      <div
        className="h-5 flex items-center justify-between mb-1.5 transition-opacity duration-100"
        style={{ opacity: hoveredTs ? 1 : 0 }}
      >
        <span className="text-[10px] font-mono font-semibold text-white">
          {hoveredTs ? formatTimeAxis(hoveredTs) : ' '}
        </span>
        {hoveredBucket && (
          <span className={`text-[10px] font-mono font-medium ${hoveredBucket.active ? 'text-[#00D68F]' : 'text-[#FF3D71]'}`}>
            {hoveredBucket.active ? `${hoveredBucket.record_count} records` : 'offline'}
          </span>
        )}
      </div>

      {/* Bar chart */}
      <div
        ref={barRef}
        className="flex gap-[1.5px] rounded-sm overflow-hidden"
        style={{ height }}
      >
        {timeline.map((bucket, bi) => {
          const isHot = bi === hovered
          return (
            <div
              key={bi}
              className="flex-1 rounded-[1px] transition-all duration-75"
              style={{
                minWidth: 1,
                backgroundColor: bucket.active ? '#00D68F' : '#FF3D71',
                opacity: isHot ? 1 : bucket.active ? 0.65 : 0.5,
                transform: isHot ? 'scaleY(1.4)' : 'scaleY(1)',
                boxShadow: isHot ? `0 0 5px ${bucket.active ? '#00D68F' : '#FF3D71'}` : 'none',
              }}
            />
          )
        })}
      </div>

      {/* Time axis ticks */}
      {total > 0 && (
        <div className="flex gap-[1.5px] mt-1.5" style={{ height: 22 }}>
          {timeline.map((bucket, bi) => {
            const isHot = bi === hovered
            const showTick = bi % tickInterval === 0
            if (!showTick && !isHot) return <div key={bi} className="flex-1" style={{ minWidth: 1 }} />
            return (
              <div key={bi} className="flex-1 relative flex flex-col items-center" style={{ minWidth: 1 }}>
                <div
                  className="w-[1px] transition-all duration-75"
                  style={{
                    height: isHot ? 5 : 3,
                    backgroundColor: isHot ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.15)',
                  }}
                />
                <span
                  className="absolute font-mono whitespace-nowrap transition-all duration-100"
                  style={{
                    top: 5,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: isHot ? 10 : 8,
                    fontWeight: isHot ? 700 : 400,
                    color: isHot ? '#ffffff' : 'rgba(107,116,148,0.45)',
                    textShadow: isHot ? '0 0 8px rgba(255,255,255,0.35)' : 'none',
                  }}
                >
                  {formatTimeAxis(bucket.ts)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Device Row (collapsible + interactive timeline) ─────────────────────────

function DeviceActivityRow({
  device, index,
}: {
  device: DeviceActivityDevice
  index: number
}) {
  const [expanded, setExpanded] = useState(false)

  const topOutages = device.outages
    .filter(item => item.duration_sec > 0)
    .sort((a, b) => b.duration_sec - a.duration_sec)
    .slice(0, 3)

  const color = statusColor(device.uptime_percent)

  return (
    <motion.div
      className="glass-card rounded-xl overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.022, 0.3) }}
    >
      {/* Header — clickable to expand */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.022] transition-colors text-left"
      >
        <div
          className="shrink-0 w-2 h-2 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 7px ${color}90` }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[13px] text-[var(--text)] truncate">
              {device.name}
            </span>
            <ActivityTone device={device} />
          </div>
          <div className="mt-0.5 text-[10px] text-ink-300 font-mono">
            {device.host}:{device.port}
            <span className="mx-1.5 opacity-40">·</span>
            {device.total_records.toLocaleString()} records
            <span className="mx-1.5 opacity-40">·</span>
            {device.active_buckets}/{device.bucket_count} bucket
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <UptimeRing percent={device.uptime_percent} />
          <ChevronDown
            size={14}
            className={`text-ink-300 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Interactive timeline — always visible */}
      <div className="px-4 pb-3">
        <InteractiveTimeline timeline={device.timeline} />
      </div>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 border-t border-[var(--border)] space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <StatChip icon={<Clock size={11} />} label="Birinchi data" value={formatDateTime(device.first_seen)} />
                <StatChip icon={<Clock size={11} />} label="Oxirgi data" value={formatDateTime(device.last_seen)} />
                <StatChip
                  icon={<AlertTriangle size={11} />}
                  label="Uzilishlar"
                  value={`${device.outages.length} ta`}
                  accent={device.outages.length > 0 ? '#FFAA00' : undefined}
                />
                <StatChip
                  icon={<WifiOff size={11} />}
                  label="Downtime"
                  value={`${device.downtime_percent.toFixed(1)}%`}
                  accent={device.downtime_percent > 5 ? '#FF3D71' : undefined}
                />
              </div>

              {topOutages.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-ink-300 mb-2">
                    Eng katta uzilishlar
                  </div>
                  <div className="space-y-1.5">
                    {topOutages.map((outage, i) => (
                      <div
                        key={`${outage.from_ts}-${i}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[#FF3D71]/15 bg-[#FF3D71]/[0.04] px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#FF3D71] shrink-0" />
                          <span className="text-[11px] font-mono text-ink-200">
                            {formatDateTime(outage.from_ts)} → {formatDateTime(outage.to_ts)}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-[#FF3D71] shrink-0">
                          {formatDuration(outage.duration_sec)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function DeviceActivity({ substationId }: { substationId: number }) {
  const today = useMemo(() => new Date(), [])
  const [mode, setMode] = useState<'day' | 'range'>('day')
  const [day, setDay] = useState(dateInputValue(today))
  const [fromValue, setFromValue] = useState(
    toLocalInputValue(new Date(today.getTime() - 24 * 60 * 60_000)).slice(0, 16),
  )
  const [toValue, setToValue] = useState(toLocalInputValue(today).slice(0, 16))

  const { fromTs, toTs } = useMemo(() => {
    if (mode === 'day') return { fromTs: startOfDay(day), toTs: endOfDay(day) }
    return {
      fromTs: fromLocalInputValue(fromValue) ?? startOfDay(day),
      toTs:   fromLocalInputValue(toValue)   ?? endOfDay(day),
    }
  }, [day, fromValue, mode, toValue])

  const queryEnabled = Boolean(substationId && toTs > fromTs)
  const { data, isFetching, isLoading, error } = useQuery({
    queryKey: ['device-activity', substationId, fromTs.toISOString(), toTs.toISOString()],
    queryFn: ({ signal }) =>
      telemetryApi.deviceActivity({ substation_id: substationId, from_ts: fromTs, to_ts: toTs }, signal),
    enabled: queryEnabled,
    staleTime: 30_000,
  })

  const devices = useMemo(() => {
    return [...(data?.devices ?? [])].sort((a, b) => {
      if (a.total_records === 0 && b.total_records > 0) return -1
      if (b.total_records === 0 && a.total_records > 0) return 1
      return a.uptime_percent - b.uptime_percent
    })
  }, [data?.devices])

  const summary = useMemo(() => {
    const total    = devices.length
    const silent   = devices.filter(d => d.total_records === 0).length
    const degraded = devices.filter(d => d.total_records > 0 && d.uptime_percent < 95).length
    const ok       = total - silent - degraded
    return { total, silent, degraded, ok }
  }, [devices])

  const fleetHealth = useMemo(() => {
    const active = devices.filter(d => d.total_records > 0)
    if (active.length === 0) return 0
    return active.reduce((sum, d) => sum + d.uptime_percent, 0) / active.length
  }, [devices])

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* ── Controls ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Activity size={15} className="text-[var(--electric)]" />
          <div>
            <div className="text-[13px] font-semibold text-[var(--text)]">Device Activity</div>
            <div className="text-[11px] text-ink-300">
              Record tarixidan qurilma ishlash/uzilish analizi
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode toggle */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
            {(['day', 'range'] as const).map(item => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={`h-8 px-3 rounded-md text-[12px] font-medium transition-colors ${
                  mode === item
                    ? 'bg-[var(--electric)] text-white'
                    : 'text-ink-300 hover:text-[var(--text)]'
                }`}
              >
                {item === 'day' ? '1 kun' : 'Oraliq'}
              </button>
            ))}
          </div>

          {mode === 'day' ? (
            <label className="relative">
              <CalendarDays size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                type="date"
                value={day}
                onChange={e => setDay(e.target.value)}
                className="h-9 pl-9 pr-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[12px] text-[var(--text)]"
              />
            </label>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="relative">
                <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                <input
                  type="datetime-local"
                  value={fromValue}
                  onChange={e => setFromValue(e.target.value)}
                  className="h-9 pl-9 pr-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[12px] text-[var(--text)]"
                />
              </label>
              <span className="text-[11px] text-ink-300">→</span>
              <label className="relative">
                <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                <input
                  type="datetime-local"
                  value={toValue}
                  onChange={e => setToValue(e.target.value)}
                  className="h-9 pl-9 pr-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[12px] text-[var(--text)]"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* ── Date range info bar ───────────────────────── */}
      <div className="scada-toolbar flex items-center justify-between gap-3 p-3 text-[11px] text-ink-300">
        <span className="font-mono">
          {formatDateTime(fromTs.toISOString())} — {formatDateTime(toTs.toISOString())}
        </span>
        <span className="font-mono">
          bucket: {data ? formatDuration(data.bucket_sec) : '—'}
        </span>
      </div>

      {/* Error: bad date range */}
      {toTs <= fromTs && (
        <div className="rounded-xl border border-[#FF3D71]/30 bg-[#FF3D71]/8 p-4 text-[12px] text-[#FF3D71]">
          Sana oralig'i noto'g'ri: "gacha" vaqti "dan" vaqtidan katta bo'lishi kerak.
        </div>
      )}

      {/* ── Loading / error / empty ───────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-ink-300 gap-2.5">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Analiz qilinyapti...</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[#FF3D71]/30 bg-[#FF3D71]/8 p-4 text-[13px] text-[#FF3D71]">
          Device activity ma'lumotini olishda xatolik bo'ldi.
        </div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-12 text-center text-ink-300">
          Bu oraliqda qurilma topilmadi.
        </div>
      ) : (
        <div className={`flex flex-col gap-5 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>

          {/* ── KPI Cards ───────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Fleet Health — spans 1 col but feels heavier */}
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-ink-300 uppercase tracking-[0.1em]">Fleet Health</span>
                <Activity size={13} className="text-[var(--electric)]" />
              </div>
              <div
                className="text-[28px] font-bold font-mono leading-none"
                style={{ color: statusColor(fleetHealth) }}
              >
                {fleetHealth.toFixed(1)}%
              </div>
              <div className="mt-2.5 h-[3px] rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${fleetHealth}%`,
                    backgroundColor: statusColor(fleetHealth),
                    boxShadow: `0 0 6px ${statusColor(fleetHealth)}50`,
                  }}
                />
              </div>
              <div className="mt-1.5 text-[10px] text-ink-300 font-mono">
                {summary.total} qurilma · o'rtacha uptime
              </div>
            </div>

            <KpiCard
              icon={<CheckCircle2 size={13} />}
              label="Barqaror"
              value={summary.ok}
              color="#00D68F"
              total={summary.total}
            />
            <KpiCard
              icon={<AlertTriangle size={13} />}
              label="Uzilish bor"
              value={summary.degraded}
              color="#FFAA00"
              total={summary.total}
            />
            <KpiCard
              icon={<WifiOff size={13} />}
              label="Data kelmagan"
              value={summary.silent}
              color="#FF3D71"
              total={summary.total}
            />
          </div>

          {/* ── Fleet Heatmap ────────────────────────── */}
          <FleetHeatmap devices={devices} bucketSec={data?.bucket_sec ?? 60} />

          {/* ── Device list ──────────────────────────── */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-ink-300 uppercase tracking-[0.1em]">
              Qurilmalar — bosing, batafsil ko'ring
            </span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          <div className="grid gap-3">
            {devices.map((device, index) => (
              <DeviceActivityRow
                key={device.device_id}
                device={device}
                index={index}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

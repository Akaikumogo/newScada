import { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, Area, AreaChart,
  XAxis, YAxis, Tooltip, ReferenceLine,
  CartesianGrid,
} from 'recharts'
import { format } from 'date-fns'
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'
import { telemetryApi } from '@/lib/api'
import type { Signal } from '@/types'

// ── Smart number formatter ───────────────────────
export function smartFormat(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1000)   return v.toFixed(1)
  if (abs >= 100)    return v.toFixed(2)
  if (abs >= 10)     return v.toFixed(3)
  if (abs >= 1)      return v.toFixed(3)
  if (abs >= 0.1)    return v.toFixed(4)
  if (abs >= 0.01)   return v.toFixed(5)
  if (abs >= 0.001)  return v.toFixed(6)
  return v.toExponential(2)
}

export function axisFormat(v: number | null | undefined): string {
  if (v == null) return ''
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1000)   return v.toFixed(0)
  if (abs >= 100)    return v.toFixed(1)
  if (abs >= 10)     return v.toFixed(2)
  if (abs >= 1)      return v.toFixed(2)
  if (abs >= 0.1)    return v.toFixed(3)
  if (abs >= 0.01)   return v.toFixed(4)
  if (abs >= 0.001)  return v.toFixed(5)
  return v.toExponential(1)
}

// ── Trend calculation ────────────────────────────
type TrendDir = 'up' | 'down' | 'stable'

interface TrendInfo {
  direction:  TrendDir
  changePercent: number  // foiz o'zgarish
  slope: number
}

function calculateTrend(values: number[]): TrendInfo {
  if (values.length < 3) return { direction: 'stable', changePercent: 0, slope: 0 }

  // Oxirgi 30% qiymatlarni olish (trend uchun)
  const recentCount = Math.max(3, Math.floor(values.length * 0.3))
  const recent = values.slice(-recentCount)

  // Linear regression: y = mx + b
  const n = recent.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  for (let i = 0; i < n; i++) {
    sumX  += i
    sumY  += recent[i]
    sumXY += i * recent[i]
    sumX2 += i * i
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

  // Foiz o'zgarish (boshi va oxiri)
  const first = values[0]
  const last  = values[values.length - 1]
  const avg   = values.reduce((a, b) => a + b, 0) / values.length
  const base  = Math.abs(avg) > 0 ? avg : 1
  const changePercent = ((last - first) / Math.abs(base)) * 100

  // Trend aniqlash: slope ni normalize qilish
  const normalizedSlope = slope / (Math.abs(base) || 1)
  const threshold = 0.001 // 0.1% dan kichik o'zgarish = stable

  let direction: TrendDir = 'stable'
  if (normalizedSlope > threshold)       direction = 'up'
  else if (normalizedSlope < -threshold) direction = 'down'

  return { direction, changePercent, slope }
}

// ── Trend Badge ──────────────────────────────────
function TrendBadge({ trend }: { trend: TrendInfo }) {
  const config = {
    up:     { icon: TrendingUp,   color: '#00D68F', bg: 'rgba(0,214,143,0.12)', label: 'Oshmoqda' },
    down:   { icon: TrendingDown, color: '#FF3D71', bg: 'rgba(255,61,113,0.12)', label: 'Tushmoqda' },
    stable: { icon: Minus,        color: '#7B8ECC', bg: 'rgba(123,142,204,0.12)', label: 'Barqaror' },
  }
  const c = config[trend.direction]
  const Icon = c.icon
  const pct  = Math.abs(trend.changePercent)

  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      <Icon size={10} />
      <span>{pct > 999 ? '>999' : pct.toFixed(1)}%</span>
    </div>
  )
}

// ── Time range config ─────────────────────────────
export type TimeRange = '1h' | '6h' | '24h' | '7d'

const RANGE_CONFIG: Record<TimeRange, { label: string; tickFormat: string }> = {
  '1h':  { label: '1 soat',  tickFormat: 'HH:mm:ss' },
  '6h':  { label: '6 soat',  tickFormat: 'HH:mm'    },
  '24h': { label: '24 soat', tickFormat: 'HH:mm'    },
  '7d':  { label: '7 kun',   tickFormat: 'dd MMM'   },
}

// ── Custom Tooltip ────────────────────────────────
function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value

  return (
    <div className="
      bg-[var(--bg-card)]/95 backdrop-blur-md
      border border-[var(--border-hover)]
      rounded-xl px-3 py-2.5
      shadow-[0_8px_24px_rgba(0,0,0,0.4)]
      text-[12px]
    ">
      <div className="text-ink-300 mb-1">{label}</div>
      <div className="font-mono font-semibold text-[var(--text)] text-[14px]">
        {smartFormat(value)}
        <span className="text-ink-300 font-normal text-[11px] ml-1">{unit}</span>
      </div>
    </div>
  )
}

// ── Chart skeleton ────────────────────────────────
function ChartSkeleton() {
  return (
    <div className="h-[180px] flex items-end gap-px px-2 pb-2">
      {Array.from({ length: 40 }).map((_, i) => {
        const h = 20 + Math.sin(i * 0.4) * 15 + Math.random() * 20
        return (
          <div
            key={i}
            className="skeleton flex-1 rounded-sm"
            style={{ height: `${h}%` }}
          />
        )
      })}
    </div>
  )
}

// ── Main Chart ────────────────────────────────────
interface SignalChartProps {
  deviceId:  number
  signal:    Signal
  timeRange: TimeRange
  index:     number
}

export const SignalChart = memo(function SignalChart({
  deviceId, signal, timeRange, index,
}: SignalChartProps) {
  const cfg = RANGE_CONFIG[timeRange]

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['history', deviceId, signal.signal_name, timeRange],
    queryFn:  ({ signal: abortSignal }) => telemetryApi.history({
      device_id:   deviceId,
      signal_name: signal.signal_name,
      range:       timeRange,
    }, abortSignal),
    staleTime: 60_000,
    refetchInterval: timeRange === '1h' ? 30_000 : 120_000,
  })

  const { values, min, max, avg, trend, chartData } = useMemo(() => {
    const vals = data.map(d => d.value).filter((v): v is number => v != null)
    const mn = vals.length ? Math.min(...vals) : null
    const mx = vals.length ? Math.max(...vals) : null
    const av = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null

    const tr = calculateTrend(vals)

    const cd = data.map(d => ({
      ts:    format(new Date(d.captured_at), cfg.tickFormat),
      value: d.value,
    }))

    return { values: vals, min: mn, max: mx, avg: av, trend: tr, chartData: cd }
  }, [data, cfg.tickFormat])

  // Trend rangini chiziq rangiga moslashtirish
  const lineColor = trend.direction === 'up'     ? '#00D68F'
                  : trend.direction === 'down'   ? '#FF3D71'
                  :                                '#2979FF'

  const gradientId = `grad-${signal.id}`

  return (
    <motion.div
      className="glass-card rounded-2xl overflow-hidden"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Chart header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div
            className="w-1 h-5 rounded-full transition-colors"
            style={{ backgroundColor: lineColor }}
          />
          <div>
            <span className="text-[13px] font-semibold text-[var(--text)]">
              {signal.signal_name}
            </span>
            {signal.signal_title && (
              <span className="text-[11px] text-ink-300 ml-2">{signal.signal_title}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Trend badge */}
          {values.length >= 3 && <TrendBadge trend={trend} />}

          {/* Stats */}
          {avg != null && (
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-ink-300">
                min <span className="text-[var(--text)]">{smartFormat(min)}</span>
              </span>
              <span className="text-ink-300">
                avg <span className="text-[#FFAA00]">{smartFormat(avg)}</span>
              </span>
              <span className="text-ink-300">
                max <span className="text-[var(--text)]">{smartFormat(max)}</span>
              </span>
              {signal.unit && (
                <span className="text-ink-300/60">{signal.unit}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chart body */}
      <div className="px-2 pt-2 pb-1">
        {isLoading ? (
          <ChartSkeleton />
        ) : isError ? (
          <div className="h-[180px] flex flex-col items-center justify-center gap-2 text-ink-300">
            <AlertCircle size={20} className="text-[#FF3D71]/60" />
            <span className="text-[12px]">Ma'lumot yuklanmadi</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[180px] flex flex-col items-center justify-center gap-2 text-ink-300">
            <TrendingUp size={20} className="opacity-30" />
            <span className="text-[12px]">Tarix topilmadi</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={lineColor} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(30,34,64,0.8)"
                vertical={false}
              />
              <XAxis
                dataKey="ts"
                tick={{ fill: '#3D4270', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#3D4270', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                axisLine={false}
                width={60}
                tickFormatter={v => axisFormat(Number(v))}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={<CustomTooltip unit={signal.unit} />}
                cursor={{ stroke: 'rgba(41,121,255,0.3)', strokeWidth: 1, strokeDasharray: '4 2' }}
              />

              {/* Average reference line */}
              {avg != null && (
                <ReferenceLine
                  y={avg}
                  stroke="rgba(255,170,0,0.25)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              )}

              <Area
                type={signal.value_type === 'status' ? 'stepAfter' : 'monotone'}
                dataKey="value"
                stroke={lineColor}
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, fill: lineColor, stroke: '#0C0F1E', strokeWidth: 2 }}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Record count */}
      {!isLoading && !isError && (
        <div className="px-4 pb-2.5 text-[10px] text-ink-300/50 text-right">
          {data.length} ta yozuv
        </div>
      )}
    </motion.div>
  )
})

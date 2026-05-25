import { useRef, useCallback, memo, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Minus,
  Loader2, Database, AlertCircle,
} from 'lucide-react'
import { telemetryApi, type HistoryRange } from '@/lib/api'
import { smartFormat } from './SignalChart'
import type { Signal } from '@/types'

// ── Row height ───────────────────────────────────
const ROW_HEIGHT = 36

// ── Trend icon helper ────────────────────────────
function TrendIcon({ prev, curr }: { prev: number | null; curr: number }) {
  if (prev == null) return <Minus size={11} className="text-ink-300/40" />
  const diff = curr - prev
  if (Math.abs(diff) < 1e-10) return <Minus size={11} className="text-[#7B8ECC]" />
  if (diff > 0) return <TrendingUp size={11} className="text-[#00D68F]" />
  return <TrendingDown size={11} className="text-[#FF3D71]" />
}

// ── Quality badge ────────────────────────────────
function QualityBadge({ quality }: { quality: number }) {
  if (quality === 0) return (
    <span className="w-1.5 h-1.5 rounded-full bg-[#00D68F] inline-block" />
  )
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF3D71]/15 text-[#FF3D71] font-mono">
      Q{quality}
    </span>
  )
}

// ── Main Component ───────────────────────────────
interface HistoryTableProps {
  deviceId:  number
  signal:    Signal
  timeRange: HistoryRange
  index:     number
}

const PAGE_SIZE = 100

export const HistoryTable = memo(function HistoryTable({
  deviceId, signal, timeRange, index,
}: HistoryTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['history-table', deviceId, signal.signal_name, timeRange],
    queryFn: async ({ pageParam }) => {
      return telemetryApi.historyPage({
        device_id:   deviceId,
        signal_name: signal.signal_name,
        range:       timeRange,
        cursor:      pageParam ?? undefined,
        limit:       PAGE_SIZE,
      })
    },
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return lastPage[lastPage.length - 1]?.id ?? undefined
    },
    staleTime: 60_000,
    refetchInterval: timeRange === '1h' ? 30_000 : 120_000,
  })

  // Flatten pages
  const allRows = useMemo(() => {
    return data?.pages.flat() ?? []
  }, [data])

  const totalCount = allRows.length

  // Stats
  const stats = useMemo(() => {
    if (!allRows.length) return null
    const vals = allRows.map(r => r.value).filter((v): v is number => v != null)
    if (!vals.length) return null
    return {
      count: allRows.length,
      min:   Math.min(...vals),
      max:   Math.max(...vals),
      avg:   vals.reduce((a, b) => a + b, 0) / vals.length,
      last:  vals[0],
      first: vals[vals.length - 1],
    }
  }, [allRows])

  // Virtual list
  const virtualizer = useVirtualizer({
    count: totalCount + (hasNextPage ? 1 : 0), // +1 for loader row
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  })

  // Infinite scroll trigger
  const handleScroll = useCallback(() => {
    const items = virtualizer.getVirtualItems()
    if (!items.length) return
    const lastItem = items[items.length - 1]
    if (
      lastItem.index >= totalCount - 5 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage()
    }
  }, [virtualizer, totalCount, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <motion.div
      className="glass-card rounded-2xl overflow-hidden flex flex-col"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-[var(--electric)]" />
          <div>
            <span className="text-[13px] font-semibold text-[var(--text)]">
              {signal.signal_name}
            </span>
            {signal.signal_title && (
              <span className="text-[11px] text-ink-300 ml-2">{signal.signal_title}</span>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-ink-300">
              min <span className="text-[var(--text)]">{smartFormat(stats.min)}</span>
            </span>
            <span className="text-ink-300">
              avg <span className="text-[#FFAA00]">{smartFormat(stats.avg)}</span>
            </span>
            <span className="text-ink-300">
              max <span className="text-[var(--text)]">{smartFormat(stats.max)}</span>
            </span>
            {signal.unit && (
              <span className="text-ink-300/60">{signal.unit}</span>
            )}
            <span className="text-ink-300/40">·</span>
            <span className="text-ink-300">{stats.count} ta</span>
          </div>
        )}
      </div>

      {/* Table header row */}
      <div className="flex items-center px-4 py-1.5 text-[10px] font-semibold text-ink-300 uppercase tracking-wider border-b border-[var(--border)] bg-[var(--bg-subtle)]/30">
        <div className="w-10 text-center">#</div>
        <div className="flex-1 min-w-[160px]">Vaqt</div>
        <div className="w-[140px] text-right">Qiymat</div>
        <div className="w-10 text-center">Q</div>
        <div className="w-10 text-center">Trend</div>
      </div>

      {/* Virtual scrolled body */}
      {isLoading ? (
        <div className="h-[360px] flex flex-col items-center justify-center gap-2 text-ink-300">
          <Loader2 size={20} className="animate-spin text-[var(--electric)]" />
          <span className="text-[12px]">Yuklanmoqda...</span>
        </div>
      ) : isError ? (
        <div className="h-[360px] flex flex-col items-center justify-center gap-2 text-ink-300">
          <AlertCircle size={20} className="text-[#FF3D71]/60" />
          <span className="text-[12px]">Ma'lumot yuklanmadi</span>
        </div>
      ) : totalCount === 0 ? (
        <div className="h-[360px] flex flex-col items-center justify-center gap-2 text-ink-300">
          <Database size={20} className="opacity-30" />
          <span className="text-[12px]">Tarix topilmadi</span>
        </div>
      ) : (
        <div
          ref={parentRef}
          className="h-[360px] overflow-y-auto"
          onScroll={handleScroll}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map(virtualRow => {
              const idx = virtualRow.index

              // Loader row
              if (idx >= totalCount) {
                return (
                  <div
                    key="loader"
                    className="absolute left-0 w-full flex items-center justify-center"
                    style={{
                      top:    virtualRow.start,
                      height: ROW_HEIGHT,
                    }}
                  >
                    {isFetchingNextPage ? (
                      <div className="flex items-center gap-2 text-ink-300 text-[11px]">
                        <Loader2 size={12} className="animate-spin" />
                        Yuklanmoqda...
                      </div>
                    ) : (
                      <span className="text-ink-300/40 text-[11px]">Yana yuklash uchun pastga aylantiring</span>
                    )}
                  </div>
                )
              }

              const row = allRows[idx]
              const prevRow = idx < totalCount - 1 ? allRows[idx + 1] : null // desc order
              const rowNum = idx + 1

              return (
                <div
                  key={row.id}
                  className={`
                    absolute left-0 w-full flex items-center px-4
                    text-[12px] border-b border-[var(--border)]/50
                    hover:bg-[var(--bg-subtle)]/40 transition-colors
                    ${idx % 2 === 0 ? '' : 'bg-[var(--bg-subtle)]/15'}
                  `}
                  style={{
                    top:    virtualRow.start,
                    height: ROW_HEIGHT,
                  }}
                >
                  {/* Row number */}
                  <div className="w-10 text-center text-[10px] text-ink-300/50 font-mono">
                    {rowNum}
                  </div>

                  {/* Timestamp */}
                  <div className="flex-1 min-w-[160px] font-mono text-ink-200 text-[11px]">
                    {format(new Date(row.captured_at), 'yyyy-MM-dd HH:mm:ss.SSS')}
                  </div>

                  {/* Value */}
                  <div className="w-[140px] text-right font-mono font-medium text-[var(--text)]">
                    {smartFormat(row.value)}
                    {signal.unit && (
                      <span className="text-ink-300/60 font-normal text-[10px] ml-1">{signal.unit}</span>
                    )}
                  </div>

                  {/* Quality */}
                  <div className="w-10 flex items-center justify-center">
                    <QualityBadge quality={row.quality} />
                  </div>

                  {/* Trend icon */}
                  <div className="w-10 flex items-center justify-center">
                    <TrendIcon prev={prevRow?.value ?? null} curr={row.value} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      {!isLoading && !isError && totalCount > 0 && (
        <div className="px-4 py-2 border-t border-[var(--border)] flex items-center justify-between text-[10px] text-ink-300/50">
          <span>{totalCount} ta yozuv yuklandi</span>
          {hasNextPage && (
            <span className="text-[var(--electric)]/60">↓ yana bor</span>
          )}
        </div>
      )}
    </motion.div>
  )
})

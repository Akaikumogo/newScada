import { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { WifiOff, Clock, Server, Wifi, ArrowUpRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { StatusBadge } from './StatusBadge'
import { SignalRow } from './SignalRow'
import { useDispatcherStore } from '@/store/dispatcher'
import type { Device, DeviceStatus } from '@/types'

// ── Skeleton ──────────────────────────────────────
export function DeviceCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-[var(--border)]">
        <div className="skeleton h-5 w-40 rounded-lg mb-2" />
        <div className="skeleton h-3.5 w-28 rounded-md" />
      </div>
      <div className="p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between py-2 px-2">
            <div className="skeleton h-3 w-16 rounded-md" />
            <div className="skeleton h-3 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────
function getStatusGradient(status: DeviceStatus): string {
  const map: Record<DeviceStatus, string> = {
    online:  'from-[#00D68F]/8 via-transparent to-transparent',
    offline: 'from-[#FF3D71]/8 via-transparent to-transparent',
    warning: 'from-[#FFAA00]/8 via-transparent to-transparent',
    unknown: 'from-transparent to-transparent',
    stale:   'from-[#7B8ECC]/6 via-transparent to-transparent',
  }
  return map[status] ?? map.unknown
}

function getStatusBorder(status: DeviceStatus): string {
  const map: Record<DeviceStatus, string> = {
    online:  'hover:border-[#00D68F]/30',
    offline: 'hover:border-[#FF3D71]/30',
    warning: 'hover:border-[#FFAA00]/30',
    unknown: '',
    stale:   'hover:border-[#7B8ECC]/20',
  }
  return map[status] ?? ''
}

// ── Main Card ─────────────────────────────────────
interface Props {
  device: Device
  index:  number
}

export const DeviceCard = memo(function DeviceCard({ device, index }: Props) {
  const navigate = useNavigate()
  const { id: substationIdParam } = useParams<{ id: string }>()
  // ── Granular selectors: only re-render when THIS device's data changes ──
  const signals    = useDispatcherStore(s => s.signals[device.id])
  const statusInfo = useDispatcherStore(s => s.statuses[device.id])
  // Subscribe to revision counter — lightweight re-render trigger
  useDispatcherStore(s => s.revisions[device.id])

  const status: DeviceStatus = statusInfo?.status ?? 'unknown'

  function openDetail(signalName?: string) {
    const subId = substationIdParam ?? device.substation_id
    const url = `/substation/${subId}/device/${device.id}` +
                (signalName ? `?signal=${encodeURIComponent(signalName)}` : '')
    navigate(url)
  }

  const lastUpdate = useMemo(() => {
    if (!statusInfo?.updated_at) return null
    try {
      return formatDistanceToNow(new Date(statusInfo.updated_at), { addSuffix: true })
    } catch { return null }
  }, [statusInfo?.updated_at])

  const sortedSignals = useMemo(() => {
    if (!device.signals) return []
    return [...device.signals]
      .filter(s => s.active || s.only_realtime)
      .sort((a, b) => a.register_code - b.register_code)
  }, [device.signals])

  const activeCount = sortedSignals.length
  const totalCount  = device.signals?.length ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay:    Math.min(index * 0.04, 0.3),
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
      }}
      onClick={() => openDetail()}
      className={`
        scada-panel overflow-hidden
        flex flex-col select-none cursor-pointer group/card
        ${getStatusBorder(status)}
      `}
    >
      {/* ── Header ─────────────────────────────────── */}
      <div
        className={`
          relative px-4 pt-4 pb-3
          bg-gradient-to-b ${getStatusGradient(status)}
          border-b border-[var(--border)]
        `}
      >
        {/* Background glow */}
        <div
          className="absolute top-0 right-0 w-32 h-32 opacity-20 pointer-events-none"
          style={{
            background: status === 'online'
              ? 'radial-gradient(circle, #00D68F 0%, transparent 70%)'
              : status === 'offline'
              ? 'radial-gradient(circle, #FF3D71 0%, transparent 70%)'
              : 'none',
            filter: 'blur(24px)',
          }}
        />

        <div className="flex items-start justify-between gap-2 relative z-10">
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-[var(--text)] truncate leading-tight flex items-center gap-1.5">
              {device.name}
              <ArrowUpRight
                size={14}
                className="text-[var(--electric)] opacity-0 -translate-x-1 group-hover/card:opacity-100 group-hover/card:translate-x-0 transition-all duration-200"
              />
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <Server size={10} className="text-ink-300 flex-shrink-0" />
              <code className="text-[11px] font-mono text-ink-300">
                {device.iec104_host}:{device.iec104_port}
              </code>
            </div>
          </div>
          <StatusBadge status={status} size="sm" />
        </div>

        {/* Signal count + model */}
        <div className="mt-1.5 relative z-10 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-ink-300/60 font-mono">
            model #{device.model_id}
          </span>
          <span className="text-ink-300/30">·</span>
          <span className="text-[10px] uppercase tracking-wide text-ink-300/60">
            {activeCount}/{totalCount} signal
          </span>
        </div>
      </div>

      {/* ── Signals ────────────────────────────────── */}
      <div className="flex-1 overflow-hidden bg-[var(--bg-elevated)]/20">
        {status === 'offline' && !sortedSignals.length ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <WifiOff size={24} className="text-[#FF3D71]/60" />
            <p className="text-[12px] text-ink-300 text-center px-4">
              {statusInfo?.message ?? 'Qurilma bilan aloqa yo\'q'}
            </p>
          </div>
        ) : sortedSignals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Wifi size={24} className="text-ink-300/40" />
            <p className="text-[12px] text-ink-300">Signal topilmadi</p>
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              {sortedSignals.map(sig => (
                <SignalRow
                  key={sig.id}
                  signalName={sig.signal_name}
                  signalTitle={sig.signal_title ?? sig.signal_name}
                  unit={sig.unit}
                  data={signals?.[sig.signal_name]}
                  onHistoryClick={() => openDetail(sig.signal_name)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────── */}
      <div className="px-4 py-2.5 border-t border-[var(--border)] flex items-center justify-between bg-[var(--bg-elevated)]/35">
        <div className="flex items-center gap-1.5 text-ink-300">
          <Clock size={10} />
          <span className="text-[11px]">
            {lastUpdate ?? 'Ma\'lumot yo\'q'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[11px] text-ink-300 font-mono">
            CASDU {device.iec104_common_address}
          </span>
          <span className="text-ink-300/30 text-[11px]">·</span>
          <span className="text-[11px] text-ink-300 font-mono">
            {device.poll_interval_seconds}s
          </span>
        </div>
      </div>
    </motion.div>
  )
})

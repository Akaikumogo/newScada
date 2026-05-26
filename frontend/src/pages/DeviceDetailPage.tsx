import { useMemo, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Activity, Server, Cpu,
  Wifi, WifiOff, Loader2,
} from 'lucide-react'
import { deviceApi } from '@/lib/api'
import { useDispatcherStore } from '@/store/dispatcher'
import { StatusBadge } from '@/components/dispatcher/StatusBadge'

// Lazy-load trading chart (pulls in lightweight-charts only when needed)
const TradingChart = lazy(() =>
  import('@/components/dispatcher/TradingChart').then(m => ({ default: m.TradingChart }))
)

// ──────────────────────────────────────────────────
//  DeviceDetailPage — device info + multi-signal chart
// ──────────────────────────────────────────────────
//
//  URL: /substation/:id/device/:deviceId
//
//  Layout:
//   ┌──────────────────────────────────────────────┐
//   │  Header: back · device info · status badge   │
//   ├──────────────────────────────────────────────┤
//   │                                              │
//   │         Multi-line trading chart             │
//   │         (all active signals together)        │
//   │                                              │
//   └──────────────────────────────────────────────┘
//
function ChartLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={24} className="animate-spin text-[var(--electric)]" />
        <span className="text-[12px] text-ink-300">Trading chart yuklanmoqda...</span>
      </div>
    </div>
  )
}

export function DeviceDetailPage() {
  const { id, deviceId } = useParams<{ id: string; deviceId: string }>()
  const navigate = useNavigate()
  const statusInfo = useDispatcherStore(s => s.statuses[Number(deviceId)])
  useDispatcherStore(s => s.revisions[Number(deviceId)])

  // ── Fetch device + signals ───────────────────────
  const { data: device, isLoading } = useQuery({
    queryKey: ['device', deviceId],
    queryFn:  ({ signal }) => deviceApi.getById(Number(deviceId), signal),
    enabled:  !!deviceId,
    staleTime: 60_000,
  })

  // ── Active/realtime signals only ─────────────────
  const activeSignals = useMemo(
    () => (device?.signals ?? [])
      .filter(s => s.active || s.only_realtime)
      .sort((a, b) => a.register_code - b.register_code),
    [device?.signals],
  )

  const status = statusInfo?.status ?? 'unknown'

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      {/* ── Page Header ───────────────────────────────── */}
      <div className="
        flex-shrink-0 px-6 py-4
        border-b border-[var(--border)]
        bg-[var(--bg-base)]/80 backdrop-blur-sm
      ">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(`/substation/${id}`)}
              className="
                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                bg-[var(--bg-card)] border border-[var(--border)]
                text-ink-200 hover:text-[var(--text)] hover:border-[var(--border-hover)]
                transition-all active:scale-95
              "
            >
              <ArrowLeft size={14} />
            </button>

            <div className="w-10 h-10 rounded-xl bg-[var(--electric)]/10 border border-[var(--electric)]/20 flex items-center justify-center flex-shrink-0">
              <Cpu size={18} className="text-[var(--electric)]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[17px] font-semibold text-[var(--text)] truncate">
                  {device?.name ?? 'Loading...'}
                </h1>
                <StatusBadge status={status} size="sm" />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Server size={11} className="text-ink-300" />
                <code className="text-[11px] font-mono text-ink-300">
                  {device?.iec104_host}:{device?.iec104_port} · CASDU {device?.iec104_common_address}
                </code>
                <span className="text-ink-300/30">·</span>
                <span className="text-[11px] text-ink-300">
                  {activeSignals.length} ta active signal · poll {device?.poll_interval_seconds}s
                </span>
              </div>
            </div>
          </div>

          {/* Live status pill */}
          <div className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full
            ${status === 'online'
              ? 'bg-[#00D68F]/10 text-[#00D68F] border border-[#00D68F]/20'
              : 'bg-[#FF3D71]/10 text-[#FF3D71] border border-[#FF3D71]/20'
            }
            text-[12px] font-medium
          `}>
            {status === 'online' ? <Wifi size={12} /> : <WifiOff size={12} />}
            {status === 'online' ? 'Live' : 'Offline'}
          </div>
        </div>
      </div>

      {/* ── Body: full-width multi-signal chart ──────── */}
      <div className="flex-1 overflow-hidden p-4">
        {isLoading ? (
          <ChartLoader />
        ) : activeSignals.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <Activity size={32} className="text-ink-300/30" />
            <p className="text-[14px] text-ink-300">Active signal yo'q</p>
            <p className="text-[12px] text-ink-300/60">Editor da signallarni active qiling</p>
          </div>
        ) : (
          <Suspense fallback={<ChartLoader />}>
            <TradingChart
              key={deviceId}
              deviceId={Number(deviceId)}
              signals={activeSignals}
              height={Math.max(window.innerHeight - 180, 460)}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}

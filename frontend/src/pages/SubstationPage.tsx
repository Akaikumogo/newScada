import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Network, LayoutGrid, BarChart2, Table2,
  ChevronDown, Wifi, WifiOff,
} from 'lucide-react'
import { DeviceCard, DeviceCardSkeleton } from '@/components/dispatcher/DeviceCard'
import { SignalChart, type TimeRange } from '@/components/dispatcher/SignalChart'
import { HistoryTable } from '@/components/dispatcher/HistoryTable'
import { StatusBadge } from '@/components/dispatcher/StatusBadge'
import { deviceApi, substationApi } from '@/lib/api'
import { useDispatcherStore } from '@/store/dispatcher'
import type { Device } from '@/types'

// ── Time Range Selector ──────────────────────────
const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1h',  label: '1S' },
  { value: '6h',  label: '6S' },
  { value: '24h', label: '24S' },
  { value: '7d',  label: '7K' },
]

function TimeRangeBar({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
      {TIME_RANGES.map(r => (
        <motion.button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`
            relative px-3 h-7 rounded-md text-[12px] font-medium transition-colors
            ${value === r.value ? 'text-white' : 'text-ink-300 hover:text-[var(--text)]'}
          `}
          whileTap={{ scale: 0.96 }}
        >
          {value === r.value && (
            <motion.div
              layoutId="time-range-active"
              className="absolute inset-0 rounded-md bg-[var(--electric)]"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{r.label}</span>
        </motion.button>
      ))}
    </div>
  )
}

// ── Device Selector ───────────────────────────────
function DeviceSelector({
  devices, selectedId, onChange,
}: {
  devices: Device[]
  selectedId: number | null
  onChange: (id: number) => void
}) {

  return (
    <div className="relative">
      <select
        value={selectedId ?? ''}
        onChange={e => onChange(Number(e.target.value))}
        className="
          appearance-none h-9 pl-3 pr-9 rounded-xl text-[13px] font-medium
          bg-[var(--bg-card)] text-[var(--text)]
          border border-[var(--border)] hover:border-[var(--border-hover)]
          focus:outline-none focus:ring-1 focus:ring-[var(--electric)]/50
          cursor-pointer transition-all min-w-[220px]
        "
      >
        <option value="">Qurilma tanlang...</option>
        {devices.map(d => (
          <option key={d.id} value={d.id}>
            {d.name} — {d.iec104_host}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none"
      />
    </div>
  )
}

// ── Tab Button ────────────────────────────────────
function TabButton({
  active, icon: Icon, label, count, onClick,
}: {
  active: boolean; icon: React.ElementType; label: string; count?: number; onClick: () => void
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-4 h-10 text-[13px] font-medium
        transition-colors duration-150
        ${active ? 'text-[var(--electric-light)]' : 'text-ink-300 hover:text-[var(--text)]'}
      `}
      whileTap={{ scale: 0.97 }}
    >
      <Icon size={14} />
      <span>{label}</span>
      {count != null && (
        <span className={`
          text-[11px] px-1.5 py-0.5 rounded-full font-medium
          ${active ? 'bg-[var(--electric)]/20 text-[var(--electric-light)]' : 'bg-[var(--bg-subtle)] text-ink-300'}
        `}>
          {count}
        </span>
      )}

      {/* Bottom active bar */}
      {active && (
        <motion.div
          layoutId="tab-indicator"
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[var(--electric)]"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </motion.button>
  )
}

// ════════════════════════════════════════════════════
//  Main Page
// ════════════════════════════════════════════════════
type Tab = 'monitoring' | 'charts' | 'table'

export function SubstationPage() {
  const { id }         = useParams<{ id: string }>()
  const substationId   = Number(id)
  const navigate       = useNavigate()
  const statuses       = useDispatcherStore(s => s.statuses)
  const selectSubstation = useDispatcherStore(s => s.selectSubstation)

  const [tab,           setTab]          = useState<Tab>('monitoring')
  const [timeRange,     setTimeRange]    = useState<TimeRange>('1h')
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null)

  // Sync selected substation to store
  useEffect(() => {
    selectSubstation(substationId)
  }, [substationId, selectSubstation])

  // Fetch substation info
  const { data: substation } = useQuery({
    queryKey: ['substation-info', substationId],
    queryFn:  () => substationApi.list().then(list => list.find(s => s.id === substationId)),
    enabled:  !!substationId,
  })

  // Fetch devices + their signals
  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices', substationId],
    queryFn:  () => deviceApi.list(substationId),
    enabled:  !!substationId,
    staleTime: 60_000,
  })

  // Auto-select first device for charts when devices load
  useEffect(() => {
    if (devices.length && selectedDevice === null) {
      setSelectedDevice(devices[0].id)
    }
  }, [devices, selectedDevice])

  // Online stats
  const { onlineCount, offlineCount } = useMemo(() => {
    const online  = devices.filter(d => statuses[d.id]?.status === 'online').length
    const offline = devices.filter(d => statuses[d.id]?.status === 'offline').length
    return { onlineCount: online, offlineCount: offline }
  }, [devices, statuses])

  // Selected device for charts
  const chartDevice = devices.find(d => d.id === selectedDevice)
  const chartSignals = (chartDevice?.signals ?? []).filter(s => s.active || s.only_realtime)

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Page Header ──────────────────────────────── */}
      <motion.div
        className="
          flex-shrink-0 px-6 pt-5 pb-0
          border-b border-[var(--border)]
          bg-[var(--bg-base)]/80 backdrop-blur-sm
        "
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Top row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => navigate('/')}
              className="
                w-8 h-8 rounded-full flex items-center justify-center
                bg-[var(--bg-card)] border border-[var(--border)]
                text-ink-200 hover:text-[var(--text)] hover:border-[var(--border-hover)]
                transition-all
              "
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft size={14} />
            </motion.button>

            <div>
              <motion.h1
                className="text-[18px] font-semibold text-[var(--text)] leading-tight"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 }}
              >
                {substation?.name ?? 'Podstansiya'}
              </motion.h1>

              {/* Online/offline stats */}
              <motion.div
                className="flex items-center gap-3 mt-0.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
              >
                {!isLoading && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Wifi size={11} className="text-[#00D68F]" />
                      <span className="text-[12px] font-mono text-[#00D68F] font-semibold">{onlineCount}</span>
                      <span className="text-[12px] text-ink-300">online</span>
                    </div>
                    {offlineCount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <WifiOff size={11} className="text-[#FF3D71]" />
                        <span className="text-[12px] font-mono text-[#FF3D71] font-semibold">{offlineCount}</span>
                        <span className="text-[12px] text-ink-300">offline</span>
                      </div>
                    )}
                    <span className="text-ink-300/40 text-[12px]">·</span>
                    <span className="text-[12px] text-ink-300">{devices.length} ta qurilma</span>
                  </>
                )}
              </motion.div>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => navigate(`/substation/${substationId}/schema`)}
              className="
                flex items-center gap-1.5 h-8 px-3 rounded-lg
                text-[12px] font-medium text-ink-200
                hover:text-[var(--text)] bg-[var(--bg-card)]
                border border-[var(--border)] hover:border-[var(--border-hover)]
                transition-all
              "
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <Network size={13} />
              Sxema
            </motion.button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1">
          <TabButton
            active={tab === 'monitoring'}
            icon={LayoutGrid}
            label="Monitoring"
            count={devices.length}
            onClick={() => setTab('monitoring')}
          />
          <TabButton
            active={tab === 'charts'}
            icon={BarChart2}
            label="Grafiklar"
            onClick={() => setTab('charts')}
          />
          <TabButton
            active={tab === 'table'}
            icon={Table2}
            label="Jadval"
            onClick={() => setTab('table')}
          />
        </div>
      </motion.div>

      {/* ── Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ── MONITORING TAB ──────────────────────── */}
          {tab === 'monitoring' && (
            <motion.div
              key="monitoring"
              className="p-6"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {isLoading ? (
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
                >
                  {Array.from({ length: 6 }).map((_, i) => <DeviceCardSkeleton key={i} />)}
                </div>
              ) : devices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
                    <LayoutGrid size={28} className="text-ink-300/40" />
                  </div>
                  <div className="text-center">
                    <p className="text-[15px] font-medium text-[var(--text)]">Qurilmalar yo'q</p>
                    <p className="text-[13px] text-ink-300 mt-1">Editor da qurilma qo'shing</p>
                  </div>
                </div>
              ) : (
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
                >
                  {devices.map((device, i) => (
                    <DeviceCard key={device.id} device={device} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── CHARTS TAB ───────────────────────────── */}
          {tab === 'charts' && (
            <motion.div
              key="charts"
              className="p-6 flex flex-col gap-5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {/* Controls */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <BarChart2 size={16} className="text-[var(--electric)]" />
                  <span className="text-[14px] font-medium text-[var(--text)]">Signal tarixi</span>
                </div>

                <div className="flex items-center gap-3">
                  <DeviceSelector
                    devices={devices}
                    selectedId={selectedDevice}
                    onChange={setSelectedDevice}
                  />
                  <TimeRangeBar value={timeRange} onChange={setTimeRange} />
                </div>
              </div>

              {/* Device status (small) */}
              {chartDevice && (
                <motion.div
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <StatusBadge status={statuses[chartDevice.id]?.status ?? 'unknown'} size="sm" />
                  <code className="text-[11px] font-mono text-ink-300">
                    {chartDevice.iec104_host}:{chartDevice.iec104_port} · CASDU {chartDevice.iec104_common_address}
                  </code>
                  <span className="text-[11px] text-ink-300">
                    · {chartSignals.length} ta signal
                  </span>
                </motion.div>
              )}

              {/* Charts grid */}
              {isLoading || !chartDevice ? (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))' }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="glass-card rounded-2xl overflow-hidden">
                      <div className="px-4 py-3.5 border-b border-[var(--border)]">
                        <div className="skeleton h-4 w-32 rounded-lg" />
                      </div>
                      <div className="p-2">
                        <div className="skeleton h-[160px] rounded-xl" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : chartSignals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <BarChart2 size={32} className="text-ink-300/30" />
                  <div className="text-center">
                    <p className="text-[15px] font-medium text-[var(--text)]">Signal topilmadi</p>
                    <p className="text-[13px] text-ink-300 mt-1">Editor da signal konfiguratsiya qiling</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))' }}>
                  {chartSignals.map((sig, i) => (
                    <SignalChart
                      key={sig.id}
                      deviceId={chartDevice.id}
                      signal={sig}
                      timeRange={timeRange}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── TABLE TAB ────────────────────────── */}
          {tab === 'table' && (
            <motion.div
              key="table"
              className="p-6 flex flex-col gap-5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {/* Controls */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Table2 size={16} className="text-[var(--electric)]" />
                  <span className="text-[14px] font-medium text-[var(--text)]">Signal jadvali</span>
                </div>

                <div className="flex items-center gap-3">
                  <DeviceSelector
                    devices={devices}
                    selectedId={selectedDevice}
                    onChange={setSelectedDevice}
                  />
                  <TimeRangeBar value={timeRange} onChange={setTimeRange} />
                </div>
              </div>

              {/* Device status */}
              {chartDevice && (
                <motion.div
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <StatusBadge status={statuses[chartDevice.id]?.status ?? 'unknown'} size="sm" />
                  <code className="text-[11px] font-mono text-ink-300">
                    {chartDevice.iec104_host}:{chartDevice.iec104_port} · CASDU {chartDevice.iec104_common_address}
                  </code>
                  <span className="text-[11px] text-ink-300">
                    · {chartSignals.length} ta signal
                  </span>
                </motion.div>
              )}

              {/* Table grid */}
              {isLoading || !chartDevice ? (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))' }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="glass-card rounded-2xl overflow-hidden">
                      <div className="px-4 py-3.5 border-b border-[var(--border)]">
                        <div className="skeleton h-4 w-32 rounded-lg" />
                      </div>
                      <div className="p-2">
                        <div className="skeleton h-[360px] rounded-xl" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : chartSignals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Table2 size={32} className="text-ink-300/30" />
                  <div className="text-center">
                    <p className="text-[15px] font-medium text-[var(--text)]">Signal topilmadi</p>
                    <p className="text-[13px] text-ink-300 mt-1">Editor da signal konfiguratsiya qiling</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))' }}>
                  {chartSignals.map((sig, i) => (
                    <HistoryTable
                      key={sig.id}
                      deviceId={chartDevice.id}
                      signal={sig}
                      timeRange={timeRange}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

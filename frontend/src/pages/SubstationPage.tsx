import { useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Network, LayoutGrid, BarChart2, Table2,
  ChevronDown, Wifi, WifiOff, Search,
} from 'lucide-react'
import { DeviceCard, DeviceCardSkeleton } from '@/components/dispatcher/DeviceCard'
import { SignalChart, type TimeRange } from '@/components/dispatcher/SignalChart'
import { HistoryTable } from '@/components/dispatcher/HistoryTable'
import { StatusBadge } from '@/components/dispatcher/StatusBadge'
import { deviceApi, substationApi } from '@/lib/api'
import { useDispatcherStore } from '@/store/dispatcher'
import type { Device } from '@/types'

// ── Tabs ─────────────────────────────────────────
type Tab = 'monitoring' | 'charts' | 'table'

const TABS: { value: Tab; icon: React.ElementType; label: string }[] = [
  { value: 'monitoring', icon: LayoutGrid, label: 'Monitoring' },
  { value: 'charts',     icon: BarChart2,  label: 'Grafiklar' },
  { value: 'table',      icon: Table2,     label: 'Jadval' },
]

// ── Time Ranges ──────────────────────────────────
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
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`
            relative px-3 h-7 rounded-md text-[12px] font-medium transition-colors
            ${value === r.value
              ? 'text-white bg-[var(--electric)]'
              : 'text-ink-300 hover:text-[var(--text)]'
            }
          `}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

// ── Device Selector ──────────────────────────────
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

// ── Tab Button ───────────────────────────────────
function TabButton({
  active, icon: Icon, label, count, onClick,
}: {
  active: boolean; icon: React.ElementType; label: string; count?: number; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-4 h-10 text-[13px] font-medium
        transition-colors duration-150
        ${active ? 'text-[var(--electric-light)]' : 'text-ink-300 hover:text-[var(--text)]'}
      `}
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
      {active && (
        <motion.div
          layoutId="tab-indicator"
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[var(--electric)]"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </button>
  )
}

// ════════════════════════════════════════════════════
//  SubstationPage — with URL query params
// ════════════════════════════════════════════════════
//
//  URL format: /substation/:id?tab=charts&device=12&range=6h&q=search
//
//  All filter state persists in the URL:
//   • tab       → monitoring | charts | table
//   • device    → selected device ID
//   • range     → 1h | 6h | 24h | 7d
//   • q         → device search query (monitoring tab)
//
export function SubstationPage() {
  const { id }         = useParams<{ id: string }>()
  const substationId   = Number(id)
  const navigate       = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const statuses       = useDispatcherStore(s => s.statuses)
  const selectSubstation = useDispatcherStore(s => s.selectSubstation)

  // ── Read state from URL ────────────────────────
  const tab            = (searchParams.get('tab') as Tab) || 'monitoring'
  const timeRange      = (searchParams.get('range') as TimeRange) || '1h'
  const selectedDevice = searchParams.has('device') ? Number(searchParams.get('device')) : null
  const searchQuery    = searchParams.get('q') || ''

  // ── URL updaters (replace: true → no history spam) ──
  const updateParam = useCallback((key: string, value: string | null) => {
    setSearchParams(prev => {
      if (value === null || value === '') {
        prev.delete(key)
      } else {
        prev.set(key, value)
      }
      return prev
    }, { replace: true })
  }, [setSearchParams])

  const setTab = useCallback((t: Tab) => {
    updateParam('tab', t === 'monitoring' ? null : t)
  }, [updateParam])

  const setTimeRange = useCallback((r: TimeRange) => {
    updateParam('range', r === '1h' ? null : r)
  }, [updateParam])

  const setSelectedDevice = useCallback((id: number) => {
    updateParam('device', String(id))
  }, [updateParam])

  const setSearchQuery = useCallback((q: string) => {
    updateParam('q', q || null)
  }, [updateParam])

  // Sync selected substation to store
  useEffect(() => {
    selectSubstation(substationId)
  }, [substationId, selectSubstation])

  // ── API Queries ────────────────────────────────
  const { data: substation } = useQuery({
    queryKey: ['substation', substationId],
    queryFn:  ({ signal }) => substationApi.getById(substationId, signal),
    enabled:  !!substationId,
    staleTime: 5 * 60_000,
  })

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices', substationId],
    queryFn:  ({ signal }) => deviceApi.list(substationId, signal),
    enabled:  !!substationId,
    staleTime: 60_000,
  })

  // Auto-select first device for charts/table when devices load
  useEffect(() => {
    if (devices.length && selectedDevice === null && tab !== 'monitoring') {
      setSelectedDevice(devices[0].id)
    }
  }, [devices, selectedDevice, tab, setSelectedDevice])

  // ── Computed values ────────────────────────────
  const { onlineCount, offlineCount } = useMemo(() => {
    const online  = devices.filter(d => statuses[d.id]?.status === 'online').length
    const offline = devices.filter(d => statuses[d.id]?.status === 'offline').length
    return { onlineCount: online, offlineCount: offline }
  }, [devices, statuses])

  // Filter devices by search query (monitoring tab)
  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) return devices
    const needle = searchQuery.toLowerCase()
    return devices.filter(d =>
      d.name.toLowerCase().includes(needle) ||
      d.iec104_host.includes(needle) ||
      d.signals?.some(s =>
        s.signal_name.toLowerCase().includes(needle) ||
        (s.signal_title ?? '').toLowerCase().includes(needle)
      )
    )
  }, [devices, searchQuery])

  const chartDevice  = devices.find(d => d.id === selectedDevice)
  const chartSignals = useMemo(() =>
    (chartDevice?.signals ?? []).filter(s => s.active || s.only_realtime),
    [chartDevice?.signals]
  )

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Page Header ────────────────────────────── */}
      <div
        className="
          flex-shrink-0 px-6 pt-5 pb-0
          border-b border-[var(--border)]
          bg-[var(--bg-base)]/80 backdrop-blur-sm
        "
      >
        {/* Top row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="
                w-8 h-8 rounded-full flex items-center justify-center
                bg-[var(--bg-card)] border border-[var(--border)]
                text-ink-200 hover:text-[var(--text)] hover:border-[var(--border-hover)]
                transition-all active:scale-95
              "
            >
              <ArrowLeft size={14} />
            </button>

            <div>
              <h1 className="text-[18px] font-semibold text-[var(--text)] leading-tight">
                {substation?.name ?? 'Podstansiya'}
              </h1>

              <div className="flex items-center gap-3 mt-0.5">
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
              </div>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Search (monitoring tab) */}
            {tab === 'monitoring' && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Qurilma qidirish..."
                  className="
                    h-8 w-[200px] pl-9 pr-3 rounded-lg
                    bg-[var(--bg-card)] border border-[var(--border)]
                    text-[12px] text-[var(--text)] placeholder:text-ink-300/40
                    focus:outline-none focus:ring-1 focus:ring-[var(--electric)]/40
                    transition-all focus:w-[260px]
                  "
                />
              </div>
            )}

            <button
              onClick={() => navigate(`/substation/${substationId}/schema`)}
              className="
                flex items-center gap-1.5 h-8 px-3 rounded-lg
                text-[12px] font-medium text-ink-200
                hover:text-[var(--text)] bg-[var(--bg-card)]
                border border-[var(--border)] hover:border-[var(--border-hover)]
                transition-all active:scale-[0.97]
              "
            >
              <Network size={13} />
              Sxema
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1">
          {TABS.map(t => (
            <TabButton
              key={t.value}
              active={tab === t.value}
              icon={t.icon}
              label={t.label}
              count={t.value === 'monitoring' ? devices.length : undefined}
              onClick={() => setTab(t.value)}
            />
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ── MONITORING TAB ──────────────────── */}
          {tab === 'monitoring' && (
            <motion.div
              key="monitoring"
              className="p-6"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading ? (
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
                >
                  {Array.from({ length: 6 }).map((_, i) => <DeviceCardSkeleton key={i} />)}
                </div>
              ) : filteredDevices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
                    <LayoutGrid size={28} className="text-ink-300/40" />
                  </div>
                  <div className="text-center">
                    <p className="text-[15px] font-medium text-[var(--text)]">
                      {searchQuery ? 'Natija topilmadi' : 'Qurilmalar yo\'q'}
                    </p>
                    <p className="text-[13px] text-ink-300 mt-1">
                      {searchQuery
                        ? `"${searchQuery}" bo'yicha qurilma topilmadi`
                        : 'Editor da qurilma qo\'shing'
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
                >
                  {filteredDevices.map((device, i) => (
                    <DeviceCard key={device.id} device={device} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── CHARTS TAB ──────────────────────── */}
          {tab === 'charts' && (
            <motion.div
              key="charts"
              className="p-6 flex flex-col gap-5"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
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

              {chartDevice && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                  <StatusBadge status={statuses[chartDevice.id]?.status ?? 'unknown'} size="sm" />
                  <code className="text-[11px] font-mono text-ink-300">
                    {chartDevice.iec104_host}:{chartDevice.iec104_port} · CASDU {chartDevice.iec104_common_address}
                  </code>
                  <span className="text-[11px] text-ink-300">
                    · {chartSignals.length} ta signal
                  </span>
                </div>
              )}

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

          {/* ── TABLE TAB ───────────────────────── */}
          {tab === 'table' && (
            <motion.div
              key="table"
              className="p-6 flex flex-col gap-5"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
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

              {chartDevice && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                  <StatusBadge status={statuses[chartDevice.id]?.status ?? 'unknown'} size="sm" />
                  <code className="text-[11px] font-mono text-ink-300">
                    {chartDevice.iec104_host}:{chartDevice.iec104_port} · CASDU {chartDevice.iec104_common_address}
                  </code>
                  <span className="text-[11px] text-ink-300">
                    · {chartSignals.length} ta signal
                  </span>
                </div>
              )}

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

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Activity, DatabaseZap, RefreshCw, Search, Wifi, WifiOff } from 'lucide-react'
import { deviceApi, telemetryApi } from '@/lib/api'
import { useDispatcherStore } from '@/store/dispatcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Device, Signal } from '@/types'

function formatValue(value: number | null | undefined) {
  if (value == null) return '-'
  const abs = Math.abs(value)
  if (abs >= 1000) return value.toFixed(1)
  if (abs >= 100) return value.toFixed(2)
  if (abs >= 1) return value.toFixed(3)
  if (abs >= 0.001) return value.toFixed(6)
  return value.toExponential(2)
}

function formatTime(ts: string | null | undefined) {
  if (!ts) return '-'
  try {
    return new Date(ts).toLocaleTimeString()
  } catch {
    return ts
  }
}

function RealtimeRow({ device, signal }: { device: Device; signal: Signal }) {
  const data = useDispatcherStore(s => s.signals[device.id]?.[signal.signal_name])
  // Subscribe to revision to re-render when device data updates
  useDispatcherStore(s => s.revisions[device.id])

  return (
    <tr className="border-b border-[var(--border)] last:border-0">
      <td className="px-4 py-2.5">
        <div className="text-[13px] font-medium text-[var(--text)]">{device.name}</div>
        <code className="text-[11px] text-ink-300">{device.iec104_host}:{device.iec104_port}</code>
      </td>
      <td className="px-4 py-2.5">
        <div className="text-[13px] text-ink-200">{signal.signal_name}</div>
        <div className="text-[11px] text-ink-300">IOA {signal.register_code}</div>
      </td>
      <td className="px-4 py-2.5 text-ink-300 text-[12px]">{signal.signal_title || '-'}</td>
      <td className="px-4 py-2.5 text-right">
        <span className="mono-value text-[14px] font-semibold text-[var(--text)]">
          {formatValue(data?.value)}
        </span>
      </td>
      <td className="px-4 py-2.5 text-[12px] text-ink-300">{signal.unit}</td>
      <td className="px-4 py-2.5 text-[12px] text-ink-300">{data?.quality ?? '-'}</td>
      <td className="px-4 py-2.5 text-[12px] text-ink-300">{formatTime(data?.ts)}</td>
    </tr>
  )
}

export function RealtimeRedisPage() {
  const [query, setQuery] = useState('')
  const hydrateLiveSnapshot = useDispatcherStore(s => s.hydrateLiveSnapshot)
  const statuses = useDispatcherStore(s => s.statuses)
  const wsState = useDispatcherStore(s => s.wsState)

  const { data: devices = [] } = useQuery({
    queryKey: ['devices-all'],
    queryFn: ({ signal }) => deviceApi.listAll(signal),
    staleTime: 60_000,
  })

  const { data: live = [], refetch } = useQuery({
    queryKey: ['telemetry-live-all'],
    queryFn: ({ signal }) => telemetryApi.live(undefined, signal),
    refetchInterval: 10_000,
  })

  useEffect(() => {
    hydrateLiveSnapshot(live)
  }, [hydrateLiveSnapshot, live])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return devices.flatMap(device =>
      (device.signals ?? [])
        .filter(signal => signal.active || signal.only_realtime)
        .map(signal => ({ device, signal }))
    ).filter(({ device, signal }) => {
      if (!needle) return true
      return [
        device.name,
        device.iec104_host,
        signal.signal_name,
        signal.signal_title ?? '',
        String(signal.register_code),
      ].some(value => value.toLowerCase().includes(needle))
    })
  }, [devices, query])

  const onlineCount = Object.values(statuses).filter(s => s.status === 'online').length

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      <div className="px-6 py-5 border-b border-[var(--border)] bg-[var(--bg-base)]/80 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--electric)]/10 border border-[var(--electric)]/20 flex items-center justify-center">
              <DatabaseZap size={17} className="text-[var(--electric)]" />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold text-[var(--text)]">Redis realtime</h1>
              <div className="flex items-center gap-3 mt-0.5 text-[12px] text-ink-300">
                <span className="metric-tile px-2.5 py-1">{rows.length} ta active signal</span>
                <span className="metric-tile px-2.5 py-1">{onlineCount} online device</span>
                <span className={wsState === 'connected' ? 'text-[#00D68F]' : 'text-[#FFAA00]'}>
                  WS {wsState}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Device, IOA, signal..."
                className="h-9 w-[280px] pl-9 pr-3 text-[13px]"
              />
            </div>
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="h-9"
            >
              <RefreshCw size={13} />
              Snapshot
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <motion.div
          className="scada-panel overflow-hidden"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <table className="w-full">
            <thead className="sticky top-0 bg-[var(--bg-elevated)] border-b border-[var(--border)]">
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-300">
                <th className="px-4 py-3 font-semibold">Device</th>
                <th className="px-4 py-3 font-semibold">Signal</th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold text-right">Value</th>
                <th className="px-4 py-3 font-semibold">Unit</th>
                <th className="px-4 py-3 font-semibold">Q</th>
                <th className="px-4 py-3 font-semibold">Redis time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ device, signal }) => (
                <RealtimeRow key={`${device.id}:${signal.id}`} device={device} signal={signal} />
              ))}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-3 text-ink-300">
              <Activity size={28} className="opacity-40" />
              <p className="text-[13px]">Active signal topilmadi</p>
            </div>
          )}
        </motion.div>

        <div className="mt-3 flex items-center gap-4 text-[11px] text-ink-300">
          <span className="flex items-center gap-1.5"><Wifi size={11} className="text-[#00D68F]" /> Redis snapshot + WebSocket</span>
          <span className="flex items-center gap-1.5"><WifiOff size={11} className="text-[#FF3D71]" /> DB yozuvi kutib turilmaydi</span>
        </div>
      </div>
    </div>
  )
}

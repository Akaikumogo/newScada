import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, Circle, Filter, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { logApi } from '@/lib/api'
import type { RegisterLog } from '@/types'

const MAX_ROWS = 500

function wsUrl(params: URLSearchParams) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const qs = params.toString()
  return `${protocol}//${window.location.host}/ws/log${qs ? `?${qs}` : ''}`
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return `${date.toLocaleTimeString('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}.${ms}`
}

export function LogPage() {
  const [deviceId, setDeviceId] = useState('')
  const [registerCode, setRegisterCode] = useState('')
  const [signalName, setSignalName] = useState('')
  const [logs, setLogs] = useState<RegisterLog[]>([])
  const [connected, setConnected] = useState(false)
  const [paused, setPaused] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const pausedRef = useRef(paused)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const filterParams = useMemo(() => {
    const params = new URLSearchParams()
    const dev = Number(deviceId)
    const reg = Number(registerCode)
    if (deviceId.trim() && Number.isFinite(dev)) params.set('device_id', String(dev))
    if (registerCode.trim() && Number.isFinite(reg)) params.set('register_code', String(reg))
    if (signalName.trim()) params.set('signal_name', signalName.trim())
    return params
  }, [deviceId, registerCode, signalName])

  useEffect(() => {
    let alive = true
    logApi.recent({
      device_id: filterParams.get('device_id') ? Number(filterParams.get('device_id')) : undefined,
      register_code: filterParams.get('register_code') ? Number(filterParams.get('register_code')) : undefined,
      signal_name: filterParams.get('signal_name') || undefined,
      limit: 200,
    }).then(res => {
      if (alive) setLogs(res.items)
    }).catch(() => {
      if (alive) setLogs([])
    })
    return () => { alive = false }
  }, [filterParams])

  useEffect(() => {
    const socket = new WebSocket(wsUrl(filterParams))
    setConnected(false)
    setLastError(null)

    socket.onopen = () => {
      setConnected(true)
      setLastError(null)
    }
    socket.onerror = () => setLastError('WebSocket ulanmayapti')
    socket.onclose = () => setConnected(false)
    socket.onmessage = event => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'snapshot') {
          if (!pausedRef.current) setLogs((data.items ?? []).slice(0, MAX_ROWS))
          return
        }
        if (data.type !== 'signal_log' || pausedRef.current) return
        setLogs(prev => [data, ...prev].slice(0, MAX_ROWS))
      } catch {
        setLastError('Log xabari o‘qilmadi')
      }
    }

    return () => socket.close()
  }, [filterParams])

  const total = logs.length
  const latest = logs[0]

  return (
    <div className="p-6 flex flex-col gap-5">
      <motion.div className="flex flex-wrap items-center justify-between gap-3" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h1 className="text-[20px] font-semibold text-[var(--text)]">Realtime log</h1>
          <div className="flex items-center gap-2 mt-1 text-[12px] text-[var(--text-secondary)]">
            <Circle size={9} className={connected ? 'fill-[var(--success)] text-[var(--success)]' : 'fill-[var(--danger)] text-[var(--danger)]'} />
            <span>{connected ? 'Ulangan' : 'Uzilgan'}</span>
            <span className="text-[var(--text-tertiary)]">|</span>
            <span>{total} ta yozuv</span>
            {latest && (
              <>
                <span className="text-[var(--text-tertiary)]">|</span>
                <span>oxirgisi {formatTime(latest.ts)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={paused ? <Play size={14} /> : <Pause size={14} />} onClick={() => setPaused(v => !v)}>
            {paused ? 'Davom etish' : 'Pauza'}
          </Button>
          <Button variant="ghost" icon={<RotateCcw size={14} />} onClick={() => setLogs([])}>
            Tozalash
          </Button>
        </div>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.4fr_auto] gap-3 items-end bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Input label="Device ID" type="number" inputMode="numeric" mono placeholder="1" value={deviceId} onChange={e => setDeviceId(e.target.value)} />
        <Input label="Register" type="number" inputMode="numeric" mono placeholder="641" value={registerCode} onChange={e => setRegisterCode(e.target.value)} />
        <Input label="Signal" mono placeholder="ai_641" value={signalName} onChange={e => setSignalName(e.target.value)} />
        <div className="h-9 flex items-center gap-2 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] text-[12px] text-[var(--text-secondary)]">
          <Filter size={13} />
          Live filter
        </div>
      </motion.div>

      {lastError && (
        <div className="px-4 py-3 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)]/20 text-[12px] text-[var(--danger)]">
          {lastError}
        </div>
      )}

      <motion.div
        className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="grid grid-cols-[130px_90px_110px_1fr_120px_90px_100px] gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-hover)] text-[11px] font-semibold uppercase text-[var(--text-secondary)]">
          <span>Vaqt</span>
          <span>Device</span>
          <span>Register</span>
          <span>Signal</span>
          <span>Qiymat</span>
          <span>Quality</span>
          <span>ASDU</span>
        </div>

        <div className="max-h-[calc(100vh-270px)] overflow-auto">
          {logs.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
              <Activity size={22} />
              <span className="text-[13px]">Log kutilmoqda</span>
            </div>
          ) : (
            logs.map((row, index) => (
              <div
                key={`${row.ts}-${row.device_id}-${row.register_code}-${index}`}
                className="grid grid-cols-[130px_90px_110px_1fr_120px_90px_100px] gap-3 items-center px-4 py-2 border-b border-[var(--border)]/70 text-[12px] hover:bg-[var(--bg-hover)]"
              >
                <span className="mono text-[var(--text-secondary)]">{formatTime(row.ts)}</span>
                <span className="mono text-[var(--text)]">#{row.device_id}</span>
                <span className="mono text-[var(--brand)]">{row.register_code}</span>
                <span className="truncate text-[var(--text)]" title={row.signal_title || row.signal_name}>{row.signal_name}</span>
                <span className="mono text-[var(--text)]">{Number(row.value).toFixed(4)}</span>
                <span className="mono text-[var(--text-secondary)]">{row.quality}</span>
                <span className="mono text-[var(--text-secondary)] truncate">{row.asdu_type || '-'}</span>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  )
}

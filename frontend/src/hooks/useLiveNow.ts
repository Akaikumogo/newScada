import { useEffect, useState } from 'react'

/**
 * Returns a live Date that updates periodically.
 * Default: every 30s — enough for charts without hammering the API.
 * Monitoring page uses WebSocket for real-time; charts just need periodic refresh.
 */
export function useLiveNow(enabled = true, intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!enabled) return
    const tick = () => setNow(new Date())
    tick()
    const id = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs])

  return now
}

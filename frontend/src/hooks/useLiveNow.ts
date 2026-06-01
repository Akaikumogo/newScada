import { useEffect, useState } from 'react'

export function useLiveNow(enabled = true): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!enabled) return
    const tick = () => setNow(new Date())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [enabled])

  return now
}

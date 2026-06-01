import { useEffect, useRef, useState, memo } from 'react'
import { ChevronRight } from 'lucide-react'
import type { SignalValue } from '@/types'

interface Props {
  signalName:  string
  signalTitle: string
  unit:        string
  data:        SignalValue | undefined
  onHistoryClick?: () => void
}

function QualityDot({ quality }: { quality: number }) {
  const good = quality === 0
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${good ? 'bg-[#00D68F]' : 'bg-[#FF3D71]'}`}
      title={good ? 'Sifat: Yaxshi' : `Sifat kodi: ${quality}`}
    />
  )
}

/**
 * Animated number display — smooth value transitions.
 * Uses CSS transition on opacity for flash, requestAnimationFrame
 * for value interpolation (12 steps @ 16ms = ~200ms).
 */
function AnimatedNumber({ value }: { value: number | null }) {
  const prevRef  = useRef<number | null>(null)
  const [display, setDisplay] = useState(value)
  const rafRef = useRef(0)

  useEffect(() => {
    if (value === null) { setDisplay(null); prevRef.current = null; return }
    if (prevRef.current === null || prevRef.current === value) {
      setDisplay(value)
      prevRef.current = value
      return
    }

    const start = prevRef.current
    const end   = value
    const diff  = end - start
    const steps = 10
    let step    = 0
    const startTime = performance.now()
    const duration  = 160 // ms

    function animate() {
      step++
      const elapsed  = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(start + diff * eased)

      if (progress < 1 && step < steps) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDisplay(end)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    prevRef.current = value

    return () => cancelAnimationFrame(rafRef.current)
  }, [value])

  if (display === null) return <span className="text-ink-300">—</span>

  return <span>{formatNumber(display)}</span>
}

function formatNumber(v: number): string {
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1000)  return v.toFixed(1)
  if (abs >= 100)   return v.toFixed(2)
  if (abs >= 10)    return v.toFixed(3)
  if (abs >= 1)     return v.toFixed(3)
  if (abs >= 0.1)   return v.toFixed(4)
  if (abs >= 0.01)  return v.toFixed(5)
  if (abs >= 0.001) return v.toFixed(6)
  return v.toExponential(2)
}

/**
 * SignalRow — self-contained flash detection.
 *
 * Instead of subscribing to a global `recentlyChanged` Map (which
 * caused ALL cards to re-render on every signal change), each row
 * detects value changes locally via useRef. Flash only affects THIS row.
 */
export const SignalRow = memo(function SignalRow({
  signalName, signalTitle, unit, data, onHistoryClick,
}: Props) {
  const prevValueRef = useRef<number | null | undefined>(undefined)
  const [flashing, setFlashing]   = useState(false)

  // Detect value change locally — no global subscription needed
  useEffect(() => {
    const curr = data?.value
    const prev = prevValueRef.current

    // First render or no data — just store
    if (prev === undefined) {
      prevValueRef.current = curr ?? null
      return
    }

    // Value actually changed → flash
    if (curr !== undefined && curr !== null && curr !== prev) {
      setFlashing(true)
      const t = setTimeout(() => setFlashing(false), 1200)
      prevValueRef.current = curr
      return () => clearTimeout(t)
    }

    prevValueRef.current = curr ?? null
  }, [data?.value])

  return (
    <tr
      className={`
        group border-b border-[var(--border)]/70 last:border-0
        cursor-pointer transition-colors duration-150
        ${flashing ? 'signal-flash' : 'hover:bg-[var(--bg-subtle)]/35'}
      `}
      onClick={onHistoryClick ? (e) => { e.stopPropagation(); onHistoryClick() } : undefined}
    >
      {/* Signal short name */}
      <td className="py-2.5 pl-4 pr-2 w-16">
        <span className="text-[11px] font-semibold text-ink-200 font-mono">{signalName}</span>
      </td>

      {/* Signal title */}
      <td className="py-2.5 pr-2">
        <span className="text-[11px] text-ink-300 truncate block max-w-[150px]">{signalTitle}</span>
      </td>

      {/* Value */}
      <td className="py-2.5 pr-2 text-right">
        <span className="mono-value text-[15px] font-semibold text-[var(--text)] tabular-nums">
          <AnimatedNumber value={data?.value ?? null} />
        </span>
      </td>

      {/* Unit */}
      <td className="py-2.5 pr-2 w-10">
        <span className="text-[10px] text-ink-300 font-mono">{unit}</span>
      </td>

      {/* Quality */}
      <td className="py-2.5 pr-2 w-5">
        {data && <QualityDot quality={data.quality} />}
      </td>

      {/* History arrow */}
      <td className="py-2.5 pr-3 w-5">
        <ChevronRight
          size={12}
          className="text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </td>
    </tr>
  )
})

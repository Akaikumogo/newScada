import { useEffect, useRef, useState, memo } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import type { SignalValue } from '@/types'

interface Props {
  signalName:  string
  signalTitle: string
  unit:        string
  data:        SignalValue | undefined
  isChanged:   boolean
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

function AnimatedNumber({ value }: { value: number | null }) {
  const prevRef  = useRef<number | null>(null)
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    if (value === null) { setDisplay(null); return }
    if (prevRef.current === null) { setDisplay(value); prevRef.current = value; return }

    const start  = prevRef.current
    const end    = value
    const diff   = end - start
    const steps  = 12
    let step     = 0

    const timer = setInterval(() => {
      step++
      const progress = step / steps
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(start + diff * eased)
      if (step >= steps) {
        clearInterval(timer)
        setDisplay(end)
      }
    }, 16)

    prevRef.current = value
    return () => clearInterval(timer)
  }, [value])

  if (display === null) return <span className="text-ink-300">—</span>

  const abs = Math.abs(display)
  let formatted: string
  if (abs === 0)         formatted = '0'
  else if (abs >= 1000)  formatted = display.toFixed(1)
  else if (abs >= 100)   formatted = display.toFixed(2)
  else if (abs >= 10)    formatted = display.toFixed(3)
  else if (abs >= 1)     formatted = display.toFixed(3)
  else if (abs >= 0.1)   formatted = display.toFixed(4)
  else if (abs >= 0.01)  formatted = display.toFixed(5)
  else if (abs >= 0.001) formatted = display.toFixed(6)
  else                   formatted = display.toExponential(2)

  return <span>{formatted}</span>
}

export const SignalRow = memo(function SignalRow({
  signalName, signalTitle, unit, data, isChanged, onHistoryClick,
}: Props) {
  const [flashing, setFlashing] = useState(false)

  useEffect(() => {
    if (isChanged) {
      setFlashing(true)
      const t = setTimeout(() => setFlashing(false), 1300)
      return () => clearTimeout(t)
    }
  }, [isChanged, data?.value])

  return (
    <motion.tr
      layout
      className={`
        group border-b border-[var(--border)] last:border-0
        cursor-pointer transition-colors duration-150
        ${flashing ? 'signal-flash' : 'hover:bg-[var(--bg-subtle)]/40'}
      `}
      onClick={onHistoryClick}
      whileHover={{ x: 2 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
    >
      {/* Signal short name */}
      <td className="py-2 pl-4 pr-2 w-14">
        <span className="text-[13px] font-medium text-ink-200">{signalName}</span>
      </td>

      {/* Signal title */}
      <td className="py-2 pr-2">
        <span className="text-[12px] text-ink-300 truncate block max-w-[120px]">{signalTitle}</span>
      </td>

      {/* Value */}
      <td className="py-2 pr-2 text-right">
        <span className="mono-value text-[14px] font-medium text-[var(--text)]">
          <AnimatedNumber value={data?.value ?? null} />
        </span>
      </td>

      {/* Unit (from signal definition) */}
      <td className="py-2 pr-2 w-10">
        <span className="text-[11px] text-ink-300">{unit}</span>
      </td>

      {/* Quality */}
      <td className="py-2 pr-2 w-5">
        {data && <QualityDot quality={data.quality} />}
      </td>

      {/* History arrow */}
      <td className="py-2 pr-3 w-5">
        <ChevronRight
          size={12}
          className="text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </td>
    </motion.tr>
  )
})

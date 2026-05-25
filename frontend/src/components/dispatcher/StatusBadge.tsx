import { motion } from 'framer-motion'
import type { DeviceStatus } from '@/types'

const STATUS_MAP: Record<DeviceStatus, {
  label: string
  color: string
  ringColor: string
  dotColor: string
  bg: string
  pulse: boolean
}> = {
  online:  { label: 'Online',   color: 'text-[#00D68F]', ringColor: '#00D68F', dotColor: 'bg-[#00D68F]', bg: 'bg-[#00D68F]/10', pulse: true  },
  offline: { label: 'Offline',  color: 'text-[#FF3D71]', ringColor: '#FF3D71', dotColor: 'bg-[#FF3D71]', bg: 'bg-[#FF3D71]/10', pulse: false },
  warning: { label: 'Warning',  color: 'text-[#FFAA00]', ringColor: '#FFAA00', dotColor: 'bg-[#FFAA00]', bg: 'bg-[#FFAA00]/10', pulse: true  },
  unknown: { label: 'Unknown',  color: 'text-[#7B8ECC]', ringColor: '#7B8ECC', dotColor: 'bg-[#7B8ECC]', bg: 'bg-[#7B8ECC]/10', pulse: false },
  stale:   { label: 'Stale',    color: 'text-[#7B8ECC]', ringColor: '#7B8ECC', dotColor: 'bg-[#7B8ECC]', bg: 'bg-[#7B8ECC]/10', pulse: false },
}

interface Props {
  status: DeviceStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.unknown
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'

  return (
    <motion.div
      className={`
        inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
        ${cfg.bg} ${cfg.color}
        border border-current/10 text-xs font-medium
      `}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      {/* Dot with optional ping animation */}
      <span className="relative flex items-center justify-center">
        <span className={`${dotSize} rounded-full ${cfg.dotColor}`} />
        {cfg.pulse && (
          <motion.span
            className={`absolute ${dotSize} rounded-full ${cfg.dotColor} opacity-60`}
            animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </span>

      {/* Label */}
      <span>{cfg.label}</span>
    </motion.div>
  )
}

/* ── Standalone dot for sidebar use ─────────────── */
export function StatusDot({ status }: { status: DeviceStatus }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.unknown
  return (
    <span className="relative flex items-center justify-center w-2.5 h-2.5">
      <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
      {cfg.pulse && (
        <motion.span
          className={`absolute w-2 h-2 rounded-full ${cfg.dotColor} opacity-50`}
          animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
    </span>
  )
}

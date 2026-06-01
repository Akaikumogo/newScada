import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import type { DeviceStatus } from '@/types'

const STATUS_MAP: Record<DeviceStatus, {
  label: string
  color: string
  dotColor: string
  bg: string
  pulse: boolean
}> = {
  online:  { label: 'Online',  color: 'text-[#00D68F]', dotColor: 'bg-[#00D68F]', bg: 'bg-[#00D68F]/10', pulse: false },
  offline: { label: 'Offline', color: 'text-[#FF3D71]', dotColor: 'bg-[#FF3D71]', bg: 'bg-[#FF3D71]/10', pulse: false },
  warning: { label: 'Warning', color: 'text-[#FFAA00]', dotColor: 'bg-[#FFAA00]', bg: 'bg-[#FFAA00]/10', pulse: true  },
  unknown: { label: 'Unknown', color: 'text-[#7B8ECC]', dotColor: 'bg-[#7B8ECC]', bg: 'bg-[#7B8ECC]/10', pulse: false },
  stale:   { label: 'Stale',   color: 'text-[#7B8ECC]', dotColor: 'bg-[#7B8ECC]', bg: 'bg-[#7B8ECC]/10', pulse: false },
}

interface Props {
  status: DeviceStatus
  size?: 'sm' | 'md'
}

export const StatusBadge = memo(function StatusBadge({ status, size = 'md' }: Props) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.unknown
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'

  return (
    <Badge
      variant={
        status === 'online' ? 'online' :
        status === 'offline' ? 'offline' :
        status === 'warning' ? 'warning' :
        'outline'
      }
      className={`gap-1.5 px-2.5 py-1 text-[11px] ${cfg.color}`}
    >
      {/* Dot with optional CSS-only pulse */}
      <span className="relative flex items-center justify-center">
        <span className={`${dotSize} rounded-full ${cfg.dotColor}`} />
        {cfg.pulse && (
          <span className={`absolute ${dotSize} rounded-full ${cfg.dotColor} opacity-60 animate-ping`} />
        )}
      </span>
      <span>{cfg.label}</span>
    </Badge>
  )
})

/* ── Standalone dot for sidebar use ─────────────── */
export const StatusDot = memo(function StatusDot({ status }: { status: DeviceStatus }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.unknown
  return (
    <span className="relative flex items-center justify-center w-2.5 h-2.5">
      <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
      {cfg.pulse && (
        <span className={`absolute w-2 h-2 rounded-full ${cfg.dotColor} opacity-50 animate-ping`} />
      )}
    </span>
  )
})

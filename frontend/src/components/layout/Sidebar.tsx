import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, ChevronRight, Wifi, WifiOff } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useDispatcherStore } from '@/store/dispatcher'
import type { Substation } from '@/types'

// ── Substation item ───────────────────────────────
const SubstationItem = memo(function SubstationItem({
  sub, isActive, onClick,
}: {
  sub: Substation
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left
        transition-colors duration-150 group relative
        ${isActive
          ? 'bg-[var(--electric)]/10'
          : 'hover:bg-[var(--bg-subtle)]/50'
        }
      `}
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="sidebar-active-bar"
          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[var(--electric)]"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      {/* Icon */}
      <div className={`
        w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
        ${isActive ? 'bg-[var(--electric)]/20' : 'bg-[var(--bg-subtle)] group-hover:bg-[var(--bg-subtle)]'}
      `}>
        <Building2 size={13} className={isActive ? 'text-[var(--electric)]' : 'text-ink-300'} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-medium truncate leading-tight ${
          isActive ? 'text-[var(--electric-light)]' : 'text-ink-200'
        }`}>
          {sub.name}
        </div>
      </div>

      <ChevronRight
        size={13}
        className={`flex-shrink-0 transition-all duration-200 ${
          isActive ? 'text-[var(--electric)]/60 opacity-100' : 'opacity-0 group-hover:opacity-40 text-ink-300'
        }`}
      />
    </button>
  )
})

// ── Main Sidebar ─────────────────────────────────
export function Sidebar({ substations }: { substations: Substation[]; devices: Record<number, any> }) {
  const navigate       = useNavigate()
  const location       = useLocation()
  const selectedId     = useDispatcherStore(s => s.selectedSubstationId)
  const selectSubstation = useDispatcherStore(s => s.selectSubstation)
  const wsState        = useDispatcherStore(s => s.wsState)

  function handleSelect(sub: Substation) {
    selectSubstation(sub.id)
    navigate(`/substation/${sub.id}`)
  }

  // Extract active substation id from URL
  const urlSubId = (() => {
    const m = location.pathname.match(/\/substation\/(\d+)/)
    return m ? Number(m[1]) : null
  })()

  const activeId = urlSubId ?? selectedId

  return (
    <aside
      className="
        fixed top-14 left-0 bottom-0 w-[240px] z-40
        bg-[var(--bg-elevated)] backdrop-blur-xl
        border-r border-[var(--border)]
        flex flex-col
        shadow-[8px_0_28px_rgba(0,0,0,0.18)]
      "
    >
      {/* Substation list */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {/* Section label */}
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-300/60 flex items-center justify-between">
          <span>Podstansiyalar</span>
          {substations.length > 0 && (
            <span className="text-ink-300/40">{substations.length}</span>
          )}
        </div>

        <AnimatePresence initial={false}>
          {substations.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-ink-300">
              <div className="text-2xl mb-2 opacity-30">📡</div>
              Filial tanlang
            </div>
          ) : (
            substations.map((sub, i) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ delay: i * 0.02, duration: 0.2 }}
              >
                <SubstationItem
                  sub={sub}
                  isActive={activeId === sub.id}
                  onClick={() => handleSelect(sub)}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-card)]/40">
        <div className="flex items-center justify-between text-[10px] text-ink-300/40">
          <span>newSCADA Dispatcher</span>
          <span className={`flex items-center gap-1 ${
            wsState === 'connected' ? 'text-[#00D68F]/60' :
            wsState === 'connecting' ? 'text-[#FFAA00]/60' : 'text-[#FF3D71]/60'
          }`}>
            {wsState === 'connected' ? <Wifi size={9} /> : <WifiOff size={9} />}
            {wsState === 'connected' ? 'Live' : wsState === 'connecting' ? '...' : 'Off'}
          </span>
        </div>
      </div>
    </aside>
  )
}

import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Building2, ArrowRight, Zap, Loader2 } from 'lucide-react'
import type { Substation } from '@/types'

interface Props {
  substations: Substation[]
}

// ── Podstansiya kartasi ───────────────────────────
function SubstationCard({ sub, index }: { sub: Substation; index: number }) {
  const navigate = useNavigate()

  return (
    <motion.button
      onClick={() => navigate(`/substation/${sub.id}`)}
      className="scada-panel p-5 text-left flex flex-col gap-4 group"
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-[var(--electric)]/10 border border-[var(--electric)]/20 flex items-center justify-center">
          <Building2 size={18} className="text-[var(--electric)]" />
        </div>
        <ArrowRight
          size={16}
          className="text-ink-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200"
        />
      </div>

      <div>
        <h3 className="text-[15px] font-semibold text-[var(--text)] group-hover:text-[var(--electric-light)] transition-colors">
          {sub.name}
        </h3>
        <p className="text-[12px] text-ink-300 mt-0.5">Monitoring · Grafiklar</p>
      </div>
    </motion.button>
  )
}

// ── Main ─────────────────────────────────────────
export function HomePage({ substations }: Props) {
  // Agar podstansiyalar yuklanayotgan bo'lsa — loader ko'rsatish
  if (substations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
        {/* Animated logo */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Pulsing rings */}
          {[1, 2, 3].map(i => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-[var(--electric)]/20"
              style={{ inset: `${-i * 14}px` }}
              animate={{ scale: [1, 1.04, 1], opacity: [0.4, 0.1, 0.4] }}
              transition={{ duration: 2.5, delay: i * 0.35, repeat: Infinity }}
            />
          ))}
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2979FF] to-[#1248C0] flex items-center justify-center shadow-[0_0_40px_rgba(41,121,255,0.35)]">
            <Zap size={28} className="text-white" fill="white" />
          </div>
        </motion.div>

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 justify-center mb-2">
            <Loader2 size={14} className="text-[var(--electric)] animate-spin" />
            <span className="text-[14px] text-ink-300">Backend dan ma'lumot olinmoqda...</span>
          </div>
          <p className="text-[12px] text-ink-300/50">
            Filial va podstansiyalar yuklanmoqda
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <motion.div
        className="mb-6 scada-panel px-5 py-4"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-[20px] font-semibold text-[var(--text)]">Dispatcher boshqaruv paneli</h1>
        <p className="text-[13px] text-ink-300 mt-1">{substations.length} ta podstansiya monitoringga tayyor</p>
      </motion.div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
      >
        {substations.map((sub, i) => (
          <SubstationCard key={sub.id} sub={sub} index={i} />
        ))}
      </div>
    </div>
  )
}

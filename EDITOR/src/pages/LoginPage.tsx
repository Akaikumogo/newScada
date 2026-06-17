import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, User, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { auth, authApi } from '@/lib/api'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/devices'

  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await authApi.login(username.trim(), password)
      auth.setToken(r.token)
      toast.success(`Salom, ${r.username}!`)
      navigate(from, { replace: true })
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Kirish amalga oshmadi'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4">
      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-7 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-[var(--brand)] flex items-center justify-center shadow-sm">
            <Zap size={18} className="text-white" fill="white" />
          </div>
          <div>
            <div className="text-[15px] font-bold text-[var(--text)]">newSCADA</div>
            <div className="text-[11px] text-[var(--text-secondary)]">Editor — kirish</div>
          </div>
        </div>

        <label className="block mb-3">
          <span className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Login</span>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--brand)]"
              placeholder="admin"
              autoComplete="username"
            />
          </div>
        </label>

        <label className="block mb-5">
          <span className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Parol</span>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--brand)]"
              placeholder="admin"
              autoComplete="current-password"
            />
          </div>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full h-10 rounded-lg bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {busy ? 'Kirilmoqda…' : 'Kirish'}
        </button>

        <p className="mt-4 text-[11px] text-center text-[var(--text-secondary)]">
          Default: <span className="font-mono">admin</span> / <span className="font-mono">admin</span>
        </p>
      </motion.form>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useDispatcherStore } from '@/store/dispatcher'
import type { Branch, Substation } from '@/types'

/**
 * Backend dan kelgan birinchi filial + birinchi podstansiyani
 * avtomatik tanlaydi va navigatsiya qiladi.
 * Faqat bir marta ishlaydi (user o'zi navigatsiya qilsa — teginmaydi).
 */
export function useAutoSelect(branches: Branch[], substations: Substation[]) {
  const navigate         = useNavigate()
  const location         = useLocation()
  const didAutoSelect    = useRef(false)
  const selectBranch     = useDispatcherStore(s => s.selectBranch)
  const selectSubstation = useDispatcherStore(s => s.selectSubstation)

  useEffect(() => {
    // Agar user allaqachon biror sahifada bo'lsa — teginma
    if (location.pathname !== '/') return
    // Agar bir marta ishlagan bo'lsa — qayta ishlatma
    if (didAutoSelect.current) return
    // Ma'lumot hali kelmagan
    if (!branches.length || !substations.length) return

    const firstBranch = branches[0]
    const firstSub    = substations[0]

    selectBranch(firstBranch.id)
    selectSubstation(firstSub.id)
    navigate(`/substation/${firstSub.id}`, { replace: true })
    didAutoSelect.current = true
  }, [branches, substations, location.pathname, navigate, selectBranch, selectSubstation])
}

import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { TopBar }  from '@/components/layout/TopBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { useWebSocket }   from '@/hooks/useWebSocket'
import { useAutoSelect }  from '@/hooks/useAutoSelect'
import { useDispatcherStore } from '@/store/dispatcher'
import { branchApi, substationApi } from '@/lib/api'

const SubstationPage = lazy(() => import('@/pages/SubstationPage').then(m => ({ default: m.SubstationPage })))
const HomePage       = lazy(() => import('@/pages/HomePage').then(m => ({ default: m.HomePage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

// ── PageLoader ────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <motion.div
        className="w-8 h-8 rounded-full border-2 border-[var(--electric)] border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

// ── App Layout (needs QueryContext) ───────────────
function AppLayout() {
  useWebSocket()

  const selectedBranchId  = useDispatcherStore(s => s.selectedBranchId)
  const selectBranch      = useDispatcherStore(s => s.selectBranch)
  const selectSubstation  = useDispatcherStore(s => s.selectSubstation)

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn:  branchApi.list,
  })

  // Fetch substations (for selected branch, or all if no branch selected yet)
  const { data: substations = [] } = useQuery({
    queryKey: ['substations', selectedBranchId],
    queryFn:  () => substationApi.list(selectedBranchId ?? undefined),
    enabled:  true,
  })

  // ★ Auto-select first branch + first substation on load
  useAutoSelect(branches, substations)

  function handleBranchChange(id: number) {
    selectBranch(id)
    selectSubstation(null)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <TopBar
        branches={branches}
        substations={substations}
        onBranchChange={handleBranchChange}
      />
      <Sidebar substations={substations} devices={{}} />

      {/* Main */}
      <main className="pl-[240px] pt-14 h-screen overflow-hidden">
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/"                       element={<HomePage substations={substations} />} />
              <Route path="/substation/:id"         element={<SubstationPage />} />
              <Route path="/substation/:id/schema"  element={<SubstationPage />} />
              <Route path="*"                       element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>
    </div>
  )
}

// ── Root ─────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

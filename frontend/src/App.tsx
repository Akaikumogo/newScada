import { Suspense, lazy, Component, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig, motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { TopBar }  from '@/components/layout/TopBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { useWebSocket }   from '@/hooks/useWebSocket'
import { useAutoSelect }  from '@/hooks/useAutoSelect'
import { useDispatcherStore } from '@/store/dispatcher'
import { branchApi, substationApi } from '@/lib/api'
import { AlertTriangle, RefreshCw } from 'lucide-react'

// ── Lazy routes ──────────────────────────────────
const SubstationPage = lazy(() =>
  import('@/pages/SubstationPage').then(m => ({ default: m.SubstationPage }))
)
const HomePage = lazy(() =>
  import('@/pages/HomePage').then(m => ({ default: m.HomePage }))
)
const RealtimeRedisPage = lazy(() =>
  import('@/pages/RealtimeRedisPage').then(m => ({ default: m.RealtimeRedisPage }))
)
const DeviceDetailPage = lazy(() =>
  import('@/pages/DeviceDetailPage').then(m => ({ default: m.DeviceDetailPage }))
)
const SchemaViewPage = lazy(() =>
  import('@/pages/SchemaViewPage').then(m => ({ default: m.SchemaViewPage }))
)
const DiffPage = lazy(() =>
  import('@/pages/DiffPage').then(m => ({ default: m.DiffPage }))
)

// ── Query Client — optimized defaults ────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
})

// ── Error Boundary ───────────────────────────────
interface EBState { hasError: boolean; error: Error | null }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-6 bg-[var(--bg-base)]">
          <div className="w-16 h-16 rounded-2xl bg-[#FF3D71]/10 border border-[#FF3D71]/20 flex items-center justify-center">
            <AlertTriangle size={28} className="text-[#FF3D71]" />
          </div>
          <div className="text-center">
            <h2 className="text-[18px] font-semibold text-[var(--text)]">Xatolik yuz berdi</h2>
            <p className="text-[13px] text-ink-300 mt-2 max-w-md">
              {this.state.error?.message ?? 'Noma\'lum xatolik'}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            className="
              flex items-center gap-2 h-10 px-5 rounded-xl
              bg-[var(--electric)] text-white font-medium text-[13px]
              hover:bg-[var(--electric)]/90 transition-colors active:scale-[0.97]
            "
          >
            <RefreshCw size={14} />
            Qayta yuklash
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── PageLoader ───────────────────────────────────
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

// ── App Layout ───────────────────────────────────
function AppLayout() {
  useWebSocket()

  const selectedBranchId  = useDispatcherStore(s => s.selectedBranchId)
  const selectBranch      = useDispatcherStore(s => s.selectBranch)
  const selectSubstation  = useDispatcherStore(s => s.selectSubstation)

  // Fetch branches — long staleTime, rarely changes
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn:  ({ signal }) => branchApi.list(signal),
    staleTime: 5 * 60_000,
  })

  // Fetch substations for selected branch
  const { data: substations = [] } = useQuery({
    queryKey: ['substations', selectedBranchId],
    queryFn:  ({ signal }) => substationApi.list(selectedBranchId ?? undefined, signal),
    enabled:  true,
    staleTime: 2 * 60_000,
  })

  // Auto-select first branch + substation on initial load
  useAutoSelect(branches, substations)

  function handleBranchChange(id: number) {
    selectBranch(id)
    selectSubstation(null)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text)]">
      <TopBar
        branches={branches}
        substations={substations}
        onBranchChange={handleBranchChange}
      />
      <Sidebar substations={substations} devices={{}} />

      <main className="pl-[240px] pt-14 h-screen overflow-hidden scada-page">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"                                    element={<HomePage substations={substations} />} />
              <Route path="/substation/:id"                      element={<SubstationPage />} />
              <Route path="/substation/:id/schema"               element={<SchemaViewPage />} />
              <Route path="/substation/:id/device/:deviceId"     element={<DeviceDetailPage />} />
              <Route path="/realtime"                            element={<RealtimeRedisPage />} />
              <Route path="/diff"                                element={<DiffPage />} />
              <Route path="/substation/:id/diff"                 element={<DiffPage />} />
              <Route path="/substation/:id/dif"                  element={<DiffPage />} />
              <Route path="*"                                    element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}

// ── Root ─────────────────────────────────────────
export default function App() {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </QueryClientProvider>
    </MotionConfig>
  )
}

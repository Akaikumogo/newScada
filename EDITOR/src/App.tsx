import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'sonner'
import { TopBar } from '@/components/layout/TopBar'

// Lazy pages
const BranchesPage    = lazy(() => import('@/pages/BranchesPage').then(m => ({ default: m.BranchesPage })))
const SubstationsPage = lazy(() => import('@/pages/SubstationsPage').then(m => ({ default: m.SubstationsPage })))
const DevicesPage     = lazy(() => import('@/pages/DevicesPage').then(m => ({ default: m.DevicesPage })))
const SignalsPage     = lazy(() => import('@/pages/SignalsPage').then(m => ({ default: m.SignalsPage })))
const ModelsPage      = lazy(() => import('@/pages/ModelsPage').then(m => ({ default: m.ModelsPage })))
const SchemaEditorPage  = lazy(() => import('@/pages/SchemaEditorPage').then(m => ({ default: m.SchemaEditorPage })))
const ModelSignalsPage  = lazy(() => import('@/pages/ModelSignalsPage').then(m => ({ default: m.ModelSignalsPage })))
const LogPage           = lazy(() => import('@/pages/LogPage').then(m => ({ default: m.LogPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
})

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <motion.div
        className="w-7 h-7 rounded-full border-2 border-[var(--brand)] border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

function AppLayout() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <TopBar />
      <main className="pt-14 min-h-screen">
        <AnimatePresence mode="wait">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"                              element={<Navigate to="/devices" replace />} />
              <Route path="/branches"                      element={<BranchesPage />} />
              <Route path="/substations"                   element={<SubstationsPage />} />
              <Route path="/devices"                       element={<DevicesPage />} />
              <Route path="/devices/:id/signals"           element={<SignalsPage />} />
              <Route path="/models"                        element={<ModelsPage />} />
              <Route path="/models/:id/signals"            element={<ModelSignalsPage />} />
              <Route path="/substations/:id/schema"        element={<SchemaEditorPage />} />
              <Route path="/log"                           element={<LogPage />} />
              <Route path="*"                              element={<Navigate to="/devices" replace />} />
            </Routes>
          </Suspense>
        </AnimatePresence>
      </main>

      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            border:     '1px solid var(--border)',
            color:      'var(--text)',
            boxShadow:  'var(--shadow-card)',
          },
        }}
      />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

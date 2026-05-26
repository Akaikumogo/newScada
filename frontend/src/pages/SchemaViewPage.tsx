import { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge,
  BackgroundVariant, ReactFlowProvider,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Network, AlertCircle, Loader2 } from 'lucide-react'
import { substationApi, deviceApi, telemetryApi } from '@/lib/api'
import { useDispatcherStore } from '@/store/dispatcher'
import { SCHEMA_NODE_TYPES } from '@/components/schema/SchemaNodes'

// ──────────────────────────────────────────────────
//  SchemaViewPage — read-only schema renderer
// ──────────────────────────────────────────────────
//
//  URL: /substation/:id/schema
//
//  Loads the substation's saved canvas_json and renders it with
//  ReactFlow.  All `device` and `signal-value` nodes are wired to
//  the WebSocket-driven dispatcher store, so values update live.
//
//  A one-time REST snapshot fills initial values, then WS keeps it fresh.
// ──────────────────────────────────────────────────

function Inner() {
  const { id } = useParams<{ id: string }>()
  const subId  = Number(id)
  const navigate = useNavigate()
  const hydrateLiveSnapshot = useDispatcherStore(s => s.hydrateLiveSnapshot)

  // Load substation info
  const { data: substation } = useQuery({
    queryKey: ['substation', subId],
    queryFn:  ({ signal }) => substationApi.getById(subId, signal),
    enabled:  !!subId,
    staleTime: 5 * 60_000,
  })

  // Load schema
  const { data: schema, isLoading } = useQuery({
    queryKey: ['substation-schema', subId],
    queryFn:  ({ signal }) => substationApi.getSchema(subId, signal),
    enabled:  !!subId,
  })

  // Load all devices for the substation (for status info)
  useQuery({
    queryKey: ['devices', subId],
    queryFn:  ({ signal }) => deviceApi.list(subId, signal),
    enabled:  !!subId,
    staleTime: 60_000,
  })

  // One-time live snapshot from REST (Redis)
  const { data: liveData = [] } = useQuery({
    queryKey: ['telemetry-live', subId],
    queryFn:  ({ signal }) => telemetryApi.live(subId, signal),
    enabled:  !!subId,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (liveData.length) hydrateLiveSnapshot(liveData)
  }, [liveData, hydrateLiveSnapshot])

  // Parse schema
  const { nodes, edges } = useMemo(() => {
    const json = (schema as any)?.canvas_json
    if (!json) return { nodes: [] as Node[], edges: [] as Edge[] }
    return {
      nodes: (json.nodes ?? []) as Node[],
      edges: (json.edges ?? []) as Edge[],
    }
  }, [schema])

  const hasSchema = nodes.length > 0

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* ── Header ────────────────────────────────── */}
      <div className="
        flex-shrink-0 px-6 py-4
        border-b border-[var(--border)]
        bg-[var(--bg-base)]/80 backdrop-blur-sm
      ">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(`/substation/${subId}`)}
              className="
                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                bg-[var(--bg-card)] border border-[var(--border)]
                text-ink-200 hover:text-[var(--text)] hover:border-[var(--border-hover)]
                transition-all active:scale-95
              "
            >
              <ArrowLeft size={14} />
            </button>

            <div className="w-10 h-10 rounded-xl bg-[var(--electric)]/10 border border-[var(--electric)]/20 flex items-center justify-center flex-shrink-0">
              <Network size={18} className="text-[var(--electric)]" />
            </div>

            <div className="min-w-0">
              <h1 className="text-[17px] font-semibold text-[var(--text)] truncate">
                {substation?.name ?? 'Loading...'}
              </h1>
              <p className="text-[11px] text-ink-300 mt-0.5">
                Bir liniyali sxema · {nodes.length} ta element · {edges.length} ta ulanish
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Canvas ───────────────────────────────── */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={24} className="animate-spin text-[var(--electric)]" />
              <span className="text-[12px] text-ink-300">Sxema yuklanmoqda...</span>
            </div>
          </div>
        ) : !hasSchema ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
                <AlertCircle size={28} className="text-ink-300/40" />
              </div>
              <div>
                <p className="text-[15px] font-medium text-[var(--text)]">Sxema mavjud emas</p>
                <p className="text-[13px] text-ink-300 mt-1">Editor'da sxema yarating va saqlang</p>
              </div>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges.map(e => ({
              ...e,
              type: e.type ?? 'step',
              style: { stroke: 'var(--text)', strokeWidth: 1.5, ...(e.style ?? {}) },
              markerEnd: e.markerEnd ?? { type: MarkerType.ArrowClosed, color: 'var(--text)' },
            }))}
            nodeTypes={SCHEMA_NODE_TYPES}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            fitView
            proOptions={{ hideAttribution: true }}
            style={{ background: 'var(--bg-base)' }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
            <Controls
              showInteractive={false}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
            />
            <MiniMap
              pannable zoomable
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
              nodeColor="#2979FF"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}

export function SchemaViewPage() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  )
}

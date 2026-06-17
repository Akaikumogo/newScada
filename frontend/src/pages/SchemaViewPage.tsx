import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Activity, AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Network } from 'lucide-react'
import { deviceApi, substationApi, telemetryApi, yunusobodApi, type YunusobodBalance } from '@/lib/api'
import { SCHEMA_NODE_TYPES } from '@/components/schema/SchemaNodes'
import { useDispatcherStore } from '@/store/dispatcher'
import type { Device } from '@/types'

function Inner() {
  const { id } = useParams<{ id: string }>()
  const subId = Number(id)
  const navigate = useNavigate()
  const hydrateLiveSnapshot = useDispatcherStore(s => s.hydrateLiveSnapshot)

  const { data: substation } = useQuery({
    queryKey: ['substation', subId],
    queryFn: ({ signal }) => substationApi.getById(subId, signal),
    enabled: !!subId,
    staleTime: 5 * 60_000,
  })

  const { data: schema, isLoading } = useQuery({
    queryKey: ['substation-schema', subId],
    queryFn: ({ signal }) => substationApi.getSchema(subId, signal),
    enabled: !!subId,
  })

  const { data: devices = [] } = useQuery({
    queryKey: ['devices', subId],
    queryFn: ({ signal }) => deviceApi.list(subId, signal),
    enabled: !!subId,
    staleTime: 60_000,
  })

  const { data: liveData = [] } = useQuery({
    queryKey: ['telemetry-live', subId],
    queryFn: ({ signal }) => telemetryApi.live(subId, signal),
    enabled: !!subId,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (liveData.length) hydrateLiveSnapshot(liveData)
  }, [hydrateLiveSnapshot, liveData])

  const isYunusobod = subId === 5 || (substation?.name ?? '').toLowerCase().includes('yunusobod')
  const { data: balance } = useQuery({
    queryKey: ['yunusobod-balance', subId],
    queryFn: ({ signal }) => yunusobodApi.balance(subId, signal),
    enabled: !!subId && isYunusobod,
    refetchInterval: 2_500,
    staleTime: 2_000,
  })

  const { nodes, edges } = useMemo(() => {
    const json = (schema as any)?.canvas_json
    return {
      nodes: (json?.nodes ?? []) as Node[],
      edges: (json?.edges ?? []) as Edge[],
    }
  }, [schema])

  const hasSchema = nodes.length > 0

  return (
    <div className="schema-dark-canvas flex h-[calc(100vh-56px)] flex-col">
      <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--bg-elevated)]/80 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => navigate(`/substation/${subId}`)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition-all hover:border-[var(--border-hover)] hover:text-[var(--text)] active:scale-95"
            >
              <ArrowLeft size={14} />
            </button>
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--electric)]/30 bg-[var(--electric)]/10">
              <Network size={16} className="text-[var(--electric)]" />
            </div>
            <div className="min-w-0">
              <h1 className="scada-mono truncate text-[15px] font-semibold uppercase tracking-wider text-[var(--text)]">
                {substation?.name ?? 'Loading...'}
              </h1>
              <p className="mt-0.5 text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
                ReactFlow canvas schema - {nodes.length} element - {edges.length} ulanish
              </p>
            </div>
          </div>
          <span className="scada-pill" style={{ color: 'var(--status-success)' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-success)]" />
            LIVE
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex-1">
          {isLoading ? (
            <CenteredState icon={<Loader2 size={24} className="animate-spin text-[var(--electric)]" />} title="Sxema yuklanmoqda" />
          ) : !hasSchema ? (
            <CenteredState
              icon={<AlertCircle size={28} className="text-[var(--text-tertiary)]" />}
              title="Sxema mavjud emas"
              subtitle="Editor'da sxema yarating va saqlang"
            />
          ) : (
            <ReactFlow
                nodes={nodes}
                edges={edges.map(edge => ({
                  ...edge,
                  type: edge.type ?? 'step',
                  style: { stroke: '#9BB0D3', strokeWidth: 1.5, ...(edge.style ?? {}) },
                  // No arrowheads — SCADA SLD edges represent busbar/cable connections, not signal flow
                  markerEnd: undefined,
                }))}
                nodeTypes={SCHEMA_NODE_TYPES}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                fitView
                fitViewOptions={{ padding: 0.08, maxZoom: 1.4 }}
                minZoom={0.2}
                maxZoom={2.5}
                proOptions={{ hideAttribution: true }}
                style={{ background: '#020617' }}
              >
                <Background id="grid-minor" variant={BackgroundVariant.Lines} gap={24} size={1} color="rgba(59,130,246,0.05)" />
                <Background id="grid-major" variant={BackgroundVariant.Lines} gap={120} size={1} color="rgba(59,130,246,0.10)" />
                <Controls />
                <MiniMap
                  pannable
                  zoomable
                  style={{ background: '#071428', border: '1px solid rgba(59,130,246,0.22)', borderRadius: '8px' }}
                  maskColor="rgba(3,7,18,0.7)"
                  nodeColor="#3B82F6"
                />
            </ReactFlow>
          )}
        </div>
        <SchemaDashboard devices={devices} edges={edges} balance={balance} />
      </div>
    </div>
  )
}

function CenteredState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
          {icon}
        </div>
        <div>
          <p className="text-[15px] font-medium text-[var(--text)]">{title}</p>
          {subtitle && <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

function SchemaDashboard({ devices, edges, balance }: { devices: Device[]; edges: Edge[]; balance?: YunusobodBalance }) {
  const statuses = useDispatcherStore(s => s.statuses)
  const onlineCount = useMemo(() => devices.filter(d => statuses[d.id]?.status === 'online').length, [devices, statuses])
  const quality = balance?.quality ?? 'Loading'
  const qualityColor = quality === 'Bad'
    ? 'var(--status-danger)'
    : quality === 'MissingRealtime'
      ? 'var(--status-warning)'
      : 'var(--status-success)'

  return (
    <aside className="scada-dash w-[340px] flex-shrink-0 space-y-3 overflow-y-auto px-3 py-3">
      <PanelCard title="Quvvat balansi - real vaqt">
        <div className="grid grid-cols-2 gap-3">
          <BalanceMetric label="Kirish" value={formatValue(balance?.totals.P_kirish_mw, 1)} unit="MW" color="var(--kv-110)" />
          <BalanceMetric label="35 kV chiqish" value={formatValue(balance?.totals.P35_out_mw, 1)} unit="MW" color="var(--kv-10)" />
          <BalanceMetric label="Yo'qotish" value={formatValue(balance?.totals.P_yoqotish_mw, 1)} unit="MW" color="var(--status-warning)" />
          <BalanceMetric label="Yo'qotish %" value={formatValue(balance?.totals.loss_percent, 1)} unit="%" color="var(--status-warning)" />
        </div>
      </PanelCard>

      <PanelCard title="Balans sifati">
        <div className="flex items-start gap-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/15">
            <AlertTriangle size={13} style={{ color: qualityColor }} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: qualityColor }}>
              {quality}
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-secondary)]">
              {balance?.status_note ?? 'IEC-104 P nuqtalari va Redis realtime qiymatlari yuklanmoqda.'}
            </p>
            {balance && (
              <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] uppercase tracking-wider text-[var(--text-secondary)]">
                <span>Missing: {balance.missing_realtime_points}</span>
                <span>Bad Q: {balance.bad_quality_points}</span>
              </div>
            )}
          </div>
        </div>
      </PanelCard>

      <PanelCard title="Qurilma / Tizim">
        <div className="space-y-1.5 text-[11px]">
          <KvRow label="Transformator" value="2 x 110/35/10 kV" />
          <KvRow label="Kirish kutaklari" value="V-T1, V-T2" />
          <KvRow label="Sektsiya" value="SV-35, SV-A, SV-B" />
          <KvRow label="IEC-104 BMRZ" value={`${devices.length || 21} qurilma`} />
          <KvRow label="Schema ulanishlari" value={`${edges.length} ulanish`} />
        </div>
      </PanelCard>

      <PanelCard title="Signal holatlari">
        <div className="grid grid-cols-3 gap-2 text-center">
          <StatTile icon={<CheckCircle2 size={12} />} label="Online" value={onlineCount} color="var(--status-success)" />
          <StatTile icon={<AlertCircle size={12} />} label="Offline" value={Math.max(devices.length - onlineCount, 0)} color="var(--status-danger)" />
          <StatTile icon={<Activity size={12} />} label="Jami" value={devices.length} color="var(--electric)" />
        </div>
      </PanelCard>

      <PanelCard title="Legenda">
        <div className="grid grid-cols-4 gap-1.5">
          <LegendKv color="var(--kv-110)" label="110 kV" />
          <LegendKv color="var(--kv-35)" label="35 kV" />
          <LegendKv color="var(--kv-10)" label="10 kV" />
          <LegendKv color="var(--kv-04)" label="0.4 kV" />
        </div>
      </PanelCard>
    </aside>
  )
}

function PanelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="scada-card px-3 py-2.5">
      <div className="scada-card__title mb-2">{title}</div>
      {children}
    </div>
  )
}

function BalanceMetric({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color }}>{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="scada-mono text-[20px] font-bold leading-none text-[var(--text)]">{value}</span>
        <span className="scada-mono text-[10px] text-[var(--text-secondary)]">{unit}</span>
      </div>
    </div>
  )
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">{label}</span>
      <span className="scada-mono text-right text-[10px] text-[var(--text)]">{value}</span>
    </div>
  )
}

function StatTile({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-card)]/60 py-1.5">
      <div className="flex items-center justify-center gap-1" style={{ color }}>
        {icon}
        <span className="scada-mono text-[14px] font-bold">{value}</span>
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-widest text-[var(--text-secondary)]">{label}</div>
    </div>
  )
}

function LegendKv({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-1 w-full rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}80` }} />
      <span className="scada-mono text-[9px] uppercase tracking-wider text-[var(--text-secondary)]">{label}</span>
    </div>
  )
}

function formatValue(value: number | null | undefined, digits: number): string {
  return value == null || !Number.isFinite(value) ? '--' : value.toFixed(digits)
}

export function SchemaViewPage() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  )
}

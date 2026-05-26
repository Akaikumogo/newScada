import { useCallback, useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type Node, type Edge,
  BackgroundVariant, ReactFlowProvider,
  useReactFlow, MarkerType,
  ConnectionLineType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Save, ArrowLeft, Maximize2, Trash2,
  Zap, Square, Slash, Sigma, Globe, Type as TypeIcon,
  Cpu, Activity, ChevronDown, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { substationApi, deviceApi, signalApi } from '@/lib/api'
import { SCHEMA_NODE_TYPES, type SchemaNodeKind } from '@/components/schema/SchemaNodes'
import type { Device, Signal } from '@/types'

// ══════════════════════════════════════════════════
//  Palette items
// ══════════════════════════════════════════════════
interface PaletteItem {
  kind:     SchemaNodeKind
  icon:     React.ElementType
  label:    string
  category: 'busbar' | 'switch' | 'apparat' | 'data' | 'label'
  defaults: Record<string, any>
}

const PALETTE: PaletteItem[] = [
  // Busbars
  { kind: 'bus', icon: Zap, label: 'Shina (H)', category: 'busbar',
    defaults: { orientation: 'horizontal', length: 240, voltage: '220 kV' } },
  { kind: 'bus', icon: Zap, label: 'Shina (V)', category: 'busbar',
    defaults: { orientation: 'vertical',   length: 240, voltage: '10 kV' } },

  // Switches
  { kind: 'breaker',      icon: Square, label: "Vyklyuchatel",   category: 'switch',
    defaults: { state: 'closed', label: 'Q' } },
  { kind: 'disconnector', icon: Slash,  label: "Razedinitel",    category: 'switch',
    defaults: { state: 'closed', label: 'QS' } },

  // Apparat
  { kind: 'transformer', icon: Sigma, label: "Transformator", category: 'apparat',
    defaults: { windings: 2, label: 'T', rating: '40 MVA' } },
  { kind: 'ground',      icon: Globe, label: "Yerga",         category: 'apparat',
    defaults: {} },

  // Data
  { kind: 'device',       icon: Cpu,      label: "Qurilma",      category: 'data',
    defaults: { label: 'Device' } },
  { kind: 'signal-value', icon: Activity, label: "Signal qiymati", category: 'data',
    defaults: { label: 'Signal' } },

  // Labels
  { kind: 'voltage-label', icon: TypeIcon, label: "Voltaj yorlig'i", category: 'label',
    defaults: { text: '220 kV', size: 14 } },
  { kind: 'text',          icon: TypeIcon, label: "Matn",            category: 'label',
    defaults: { text: 'Matn', size: 12 } },
]

const CATEGORIES: { key: PaletteItem['category']; label: string }[] = [
  { key: 'busbar',  label: 'Shinalar' },
  { key: 'switch',  label: 'Komutatsion' },
  { key: 'apparat', label: 'Apparatlar' },
  { key: 'data',    label: 'Ma\'lumot' },
  { key: 'label',   label: 'Yorliqlar' },
]

let nodeIdCounter = 1
function newId() { return `n_${Date.now()}_${nodeIdCounter++}` }

// ══════════════════════════════════════════════════
//  Editor (inner — needs ReactFlowProvider)
// ══════════════════════════════════════════════════
function SchemaEditorInner() {
  const { id }   = useParams<{ id: string }>()
  const subId    = Number(id)
  const navigate = useNavigate()
  const rf       = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedId, setSelectedId]      = useState<string | null>(null)
  const [isDirty,    setIsDirty]         = useState(false)

  // ── Load schema ───────────────────────────────────
  useQuery({
    queryKey: ['substation-schema', subId],
    queryFn: async () => {
      const schema = await substationApi.getSchema(subId)
      if (schema) {
        const json = schema.canvas_json as any
        if (json?.nodes) setNodes(json.nodes)
        if (json?.edges) setEdges(json.edges)
      }
      return schema
    },
    enabled: !!subId,
  })

  // ── Load all devices for the substation ───────────
  const { data: devicesPage } = useQuery({
    queryKey: ['devices', subId],
    queryFn:  () => deviceApi.list(subId),
    enabled:  !!subId,
  })
  const devices: Device[] = devicesPage?.items ?? []

  // ── Save schema ───────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => substationApi.saveSchema(subId, { nodes, edges }),
    onSuccess:  () => { toast.success('Sxema saqlandi'); setIsDirty(false) },
    onError:    (e: Error) => toast.error(e.message),
  })

  // ── Connection handler — step-routed edges ────────
  const onConnect = useCallback(
    (conn: Connection) => {
      setEdges(eds => addEdge({
        ...conn,
        type: 'step',
        style: { stroke: 'var(--text)', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text)' },
      }, eds))
      setIsDirty(true)
    },
    [setEdges],
  )

  // ── Add node from palette ─────────────────────────
  const addNode = useCallback((item: PaletteItem) => {
    // Drop near center of viewport
    const center = rf.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    const node: Node = {
      id:       newId(),
      type:     item.kind,
      position: {
        x: center.x + (Math.random() - 0.5) * 80,
        y: center.y + (Math.random() - 0.5) * 80,
      },
      data:     { ...item.defaults },
    }
    setNodes(ns => [...ns, node])
    setIsDirty(true)
    setSelectedId(node.id)
  }, [rf, setNodes])

  // ── Update selected node ──────────────────────────
  const updateNodeData = useCallback((patch: Record<string, any>) => {
    if (!selectedId) return
    setNodes(ns => ns.map(n =>
      n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n
    ))
    setIsDirty(true)
  }, [selectedId, setNodes])

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    setNodes(ns => ns.filter(n => n.id !== selectedId))
    setEdges(es => es.filter(e => e.source !== selectedId && e.target !== selectedId))
    setSelectedId(null)
    setIsDirty(true)
  }, [selectedId, setNodes, setEdges])

  // ── Keyboard delete ───────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        // Don't fire while typing in input/textarea
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        deleteSelected()
      }
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (isDirty) saveMutation.mutate()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId, deleteSelected, isDirty, saveMutation])

  // ── Selected node lookup ──────────────────────────
  const selectedNode = useMemo(
    () => nodes.find(n => n.id === selectedId) ?? null,
    [nodes, selectedId],
  )

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* ── Toolbar ──────────────────────────────────── */}
      <motion.div
        className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-card)]/90 backdrop-blur-sm z-10 flex-shrink-0"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />} onClick={() => navigate('/substations')}>
            Orqaga
          </Button>
          <div className="h-4 w-px bg-[var(--border)]" />
          <div>
            <span className="text-[13px] font-medium text-[var(--text)]">SCADA Sxema Muharriri</span>
            {isDirty && <span className="ml-2 text-[11px] text-[var(--warning)]">● Saqlanmagan</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<Maximize2 size={13} />}
            onClick={() => rf.fitView({ padding: 0.15 })} title="Fit view (F)" />
          {selectedId && (
            <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={deleteSelected} title="O'chirish (Del)">
              O'chirish
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={13} />}
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Saqlash <kbd className="ml-1 px-1 py-0.5 text-[9px] bg-white/10 rounded">⌘S</kbd>
          </Button>
        </div>
      </motion.div>

      {/* ── Body: Palette + Canvas + Properties ───────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: Palette ─────────────────────────── */}
        <aside className="w-[200px] border-r border-[var(--border)] bg-[var(--bg-card)]/40 overflow-y-auto flex-shrink-0">
          <div className="px-3 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-300/60 mb-2">
              Palette
            </div>
            {CATEGORIES.map(cat => {
              const items = PALETTE.filter(p => p.category === cat.key)
              return (
                <div key={cat.key} className="mb-3">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-300/50 mb-1.5 px-1">
                    {cat.label}
                  </div>
                  <div className="space-y-1">
                    {items.map((item, i) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={`${item.kind}-${i}`}
                          onClick={() => addNode(item)}
                          className="
                            w-full flex items-center gap-2 px-2 py-1.5 rounded-md
                            text-[12px] text-ink-200 hover:text-[var(--text)]
                            hover:bg-[var(--bg-page)] border border-transparent hover:border-[var(--border)]
                            transition-all text-left
                          "
                        >
                          <Icon size={13} className="text-[var(--brand)] flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </aside>

        {/* ── Center: Canvas ──────────────────────── */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={changes => { onNodesChange(changes); setIsDirty(true) }}
            onEdgesChange={changes => { onEdgesChange(changes); setIsDirty(true) }}
            onConnect={onConnect}
            onSelectionChange={({ nodes: sel }) => setSelectedId(sel[0]?.id ?? null)}
            nodeTypes={SCHEMA_NODE_TYPES}
            connectionLineType={ConnectionLineType.Step}
            defaultEdgeOptions={{
              type: 'step',
              style: { stroke: 'var(--text)', strokeWidth: 1.5 },
              markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text)' },
            }}
            snapToGrid
            snapGrid={[8, 8]}
            fitView
            proOptions={{ hideAttribution: true }}
            style={{ background: 'var(--bg-page)' }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--border)" />
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
              nodeColor={(n) => {
                const colorMap: Record<string, string> = {
                  bus:            '#2979FF',
                  breaker:        '#00D68F',
                  disconnector:   '#FFAA00',
                  transformer:    '#FFAA00',
                  ground:         '#7B8ECC',
                  'voltage-label':'#2979FF',
                  device:         '#5C9DFF',
                  'signal-value': '#00D68F',
                  text:           '#7B8ECC',
                }
                return colorMap[n.type ?? 'bus'] ?? '#7B8ECC'
              }}
            />
          </ReactFlow>
        </div>

        {/* ── Right: Properties ─────────────────────── */}
        <aside className="w-[280px] border-l border-[var(--border)] bg-[var(--bg-card)]/40 overflow-y-auto flex-shrink-0">
          {selectedNode ? (
            <PropertiesPanel
              node={selectedNode}
              devices={devices}
              onPatch={updateNodeData}
              onDelete={deleteSelected}
            />
          ) : (
            <div className="p-6 text-center text-[12px] text-ink-300/60">
              Element tanlang sozlamalar uchun
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════
//  Properties Panel
// ══════════════════════════════════════════════════
function PropertiesPanel({
  node, devices, onPatch, onDelete,
}: {
  node: Node
  devices: Device[]
  onPatch: (patch: Record<string, any>) => void
  onDelete: () => void
}) {
  const data = (node.data ?? {}) as any
  const kind = node.type as SchemaNodeKind

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border)]">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-300/60">
            {nodeTypeName(kind)}
          </div>
          <div className="text-[9px] font-mono text-ink-300/40">#{node.id.slice(-6)}</div>
        </div>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#FF3D71] hover:bg-[#FF3D71]/10 transition-colors"
          title="O'chirish"
        >
          <X size={14} />
        </button>
      </div>

      {/* Generic position info */}
      <FieldGroup label="Pozitsiya">
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="X" value={Math.round(node.position.x)} disabled />
          <NumInput label="Y" value={Math.round(node.position.y)} disabled />
        </div>
      </FieldGroup>

      {/* Type-specific properties */}
      {kind === 'bus' && (
        <>
          <FieldGroup label="Voltaj">
            <TextInput value={data.voltage ?? ''} onChange={v => onPatch({ voltage: v })} placeholder="220 kV" />
          </FieldGroup>
          <FieldGroup label="Yo'nalish">
            <Select
              value={data.orientation ?? 'horizontal'}
              onChange={v => onPatch({ orientation: v })}
              options={[
                { value: 'horizontal', label: 'Gorizontal' },
                { value: 'vertical',   label: 'Vertikal' },
              ]}
            />
          </FieldGroup>
          <FieldGroup label="Uzunlik (px)">
            <NumInput value={data.length ?? 240} onChange={v => onPatch({ length: v })} min={40} max={800} />
          </FieldGroup>
          <FieldGroup label="Rang">
            <ColorPicker value={data.color ?? '#2979FF'} onChange={v => onPatch({ color: v })} />
          </FieldGroup>
        </>
      )}

      {(kind === 'breaker' || kind === 'disconnector') && (
        <>
          <FieldGroup label="Yorliq">
            <TextInput value={data.label ?? ''} onChange={v => onPatch({ label: v })} placeholder="Q1, QS-1, ..." />
          </FieldGroup>
          <FieldGroup label="Holat">
            <Select
              value={data.state ?? 'closed'}
              onChange={v => onPatch({ state: v })}
              options={[
                { value: 'closed', label: '● Yopiq' },
                { value: 'open',   label: '○ Ochiq' },
              ]}
            />
          </FieldGroup>
        </>
      )}

      {kind === 'transformer' && (
        <>
          <FieldGroup label="Yorliq">
            <TextInput value={data.label ?? ''} onChange={v => onPatch({ label: v })} placeholder="T-1" />
          </FieldGroup>
          <FieldGroup label="Quvvat">
            <TextInput value={data.rating ?? ''} onChange={v => onPatch({ rating: v })} placeholder="40 MVA" />
          </FieldGroup>
          <FieldGroup label="O'rama soni">
            <Select
              value={String(data.windings ?? 2)}
              onChange={v => onPatch({ windings: Number(v) })}
              options={[
                { value: '2', label: '2 o\'rama' },
                { value: '3', label: '3 o\'rama' },
              ]}
            />
          </FieldGroup>
        </>
      )}

      {kind === 'voltage-label' && (
        <>
          <FieldGroup label="Matn">
            <TextInput value={data.text ?? ''} onChange={v => onPatch({ text: v })} placeholder="220 kV" />
          </FieldGroup>
          <FieldGroup label="Hajm (px)">
            <NumInput value={data.size ?? 14} onChange={v => onPatch({ size: v })} min={8} max={48} />
          </FieldGroup>
          <FieldGroup label="Rang">
            <ColorPicker value={data.color ?? '#2979FF'} onChange={v => onPatch({ color: v })} />
          </FieldGroup>
        </>
      )}

      {kind === 'text' && (
        <>
          <FieldGroup label="Matn">
            <TextArea value={data.text ?? ''} onChange={v => onPatch({ text: v })} />
          </FieldGroup>
          <FieldGroup label="Hajm">
            <NumInput value={data.size ?? 12} onChange={v => onPatch({ size: v })} min={8} max={48} />
          </FieldGroup>
          <FieldGroup label="Rang">
            <ColorPicker value={data.color ?? '#E8EBF8'} onChange={v => onPatch({ color: v })} />
          </FieldGroup>
          <FieldGroup label="Qalin">
            <Switch checked={!!data.bold} onChange={v => onPatch({ bold: v })} />
          </FieldGroup>
        </>
      )}

      {kind === 'device' && (
        <DeviceBindingFields data={data} devices={devices} onPatch={onPatch} />
      )}

      {kind === 'signal-value' && (
        <SignalBindingFields data={data} devices={devices} onPatch={onPatch} />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════
//  Device / Signal binding fields
// ══════════════════════════════════════════════════
function DeviceBindingFields({
  data, devices, onPatch,
}: { data: any; devices: Device[]; onPatch: (p: Record<string, any>) => void }) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() =>
    devices.filter(d =>
      !search.trim() ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.iec104_host.includes(search)
    ),
    [devices, search],
  )

  const selectedDevice = devices.find(d => d.id === data.device_id)

  return (
    <>
      <FieldGroup label="Yorliq (ko'rinish)">
        <TextInput value={data.label ?? ''} onChange={v => onPatch({ label: v })} placeholder="Avto" />
      </FieldGroup>

      <FieldGroup label="Bog'langan qurilma">
        {selectedDevice && (
          <div className="mb-2 p-2 rounded-md bg-[var(--bg-page)] border border-[var(--brand)]/30">
            <div className="text-[12px] font-medium text-[var(--text)]">{selectedDevice.name}</div>
            <code className="text-[10px] text-ink-300">{selectedDevice.iec104_host}:{selectedDevice.iec104_port}</code>
          </div>
        )}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Qidirish..."
          className="w-full h-8 px-2 mb-1 text-[11px] rounded-md bg-[var(--bg-page)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/40"
        />
        <div className="max-h-[200px] overflow-y-auto rounded-md border border-[var(--border)]">
          {filtered.length === 0 ? (
            <div className="px-2 py-3 text-center text-[10px] text-ink-300/60">Topilmadi</div>
          ) : (
            filtered.map(d => (
              <button
                key={d.id}
                onClick={() => onPatch({
                  device_id: d.id,
                  label:     data.label || d.name,
                  ip:        `${d.iec104_host}:${d.iec104_port}`,
                })}
                className={`
                  w-full flex flex-col items-start px-2 py-1.5 text-left text-[11px]
                  border-b border-[var(--border)] last:border-0
                  ${data.device_id === d.id ? 'bg-[var(--brand)]/10' : 'hover:bg-[var(--bg-page)]'}
                `}
              >
                <span className="font-medium text-[var(--text)] truncate w-full">{d.name}</span>
                <code className="text-[9px] text-ink-300">{d.iec104_host}</code>
              </button>
            ))
          )}
        </div>
      </FieldGroup>
    </>
  )
}

function SignalBindingFields({
  data, devices, onPatch,
}: { data: any; devices: Device[]; onPatch: (p: Record<string, any>) => void }) {
  const [searchD, setSearchD] = useState('')
  const [searchS, setSearchS] = useState('')
  const [onlyActive, setOnlyActive] = useState(false)

  // Load signals for selected device (no limit, all signals)
  const { data: sigsPage, isLoading: signalsLoading } = useQuery({
    queryKey: ['signals', data.device_id, 'all'],
    queryFn:  () => signalApi.list(data.device_id, 0, 5000),
    enabled:  !!data.device_id,
  })
  const signals: Signal[] = sigsPage?.items ?? []

  const filteredDevices = useMemo(() =>
    devices.filter(d => !searchD.trim() || d.name.toLowerCase().includes(searchD.toLowerCase())),
    [devices, searchD],
  )

  // Show ALL signals by default — active flag controls data flow at runtime,
  // not whether you can bind to it in the schema editor.
  const filteredSignals = useMemo(() =>
    signals
      .filter(s => !onlyActive || s.active || s.only_realtime)
      .filter(s => !searchS.trim() ||
        s.signal_name.toLowerCase().includes(searchS.toLowerCase()) ||
        (s.signal_title ?? '').toLowerCase().includes(searchS.toLowerCase())
      ),
    [signals, searchS, onlyActive],
  )

  const selectedDevice = devices.find(d => d.id === data.device_id)
  const selectedSignal = signals.find(s => s.signal_name === data.signal_name)

  const activeCount = signals.filter(s => s.active || s.only_realtime).length

  return (
    <>
      <FieldGroup label="Yorliq (ko'rinish)">
        <TextInput value={data.label ?? ''} onChange={v => onPatch({ label: v })} placeholder="Avto" />
      </FieldGroup>

      {/* Device picker */}
      <FieldGroup label="Qurilma">
        {selectedDevice && (
          <div className="mb-2 p-1.5 rounded-md bg-[var(--bg-page)] border border-[var(--brand)]/30 text-[11px] truncate">
            <span className="font-medium text-[var(--text)]">{selectedDevice.name}</span>
            <code className="ml-1 text-ink-300">({selectedDevice.iec104_host})</code>
          </div>
        )}
        <input
          type="text"
          value={searchD}
          onChange={e => setSearchD(e.target.value)}
          placeholder="Qurilma qidirish..."
          className="w-full h-7 px-2 mb-1 text-[11px] rounded-md bg-[var(--bg-page)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/40"
        />
        <div className="max-h-[140px] overflow-y-auto rounded-md border border-[var(--border)]">
          {filteredDevices.map(d => (
            <button
              key={d.id}
              onClick={() => onPatch({ device_id: d.id, signal_name: undefined })}
              className={`
                w-full px-2 py-1 text-left text-[11px]
                border-b border-[var(--border)] last:border-0
                ${data.device_id === d.id ? 'bg-[var(--brand)]/10 text-[var(--text)]' : 'text-ink-200 hover:bg-[var(--bg-page)]'}
              `}
            >
              {d.name}
            </button>
          ))}
        </div>
      </FieldGroup>

      {/* Signal picker */}
      {data.device_id && (
        <FieldGroup label="Signal">
          {selectedSignal && (
            <div className="mb-2 p-1.5 rounded-md bg-[var(--bg-page)] border border-[var(--brand)]/30 text-[11px]">
              <div className="font-medium text-[var(--text)]">{selectedSignal.signal_name}</div>
              {selectedSignal.signal_title && (
                <div className="text-[9px] text-ink-300 truncate">{selectedSignal.signal_title}</div>
              )}
            </div>
          )}
          {/* Search + filter toggle */}
          <div className="flex items-center gap-1 mb-1">
            <input
              type="text"
              value={searchS}
              onChange={e => setSearchS(e.target.value)}
              placeholder="Signal qidirish..."
              className="flex-1 h-7 px-2 text-[11px] rounded-md bg-[var(--bg-page)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/40"
            />
            <button
              type="button"
              onClick={() => setOnlyActive(v => !v)}
              className={`
                h-7 px-2 rounded-md text-[10px] font-medium border transition-colors
                ${onlyActive
                  ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                  : 'bg-[var(--bg-page)] text-ink-300 border-[var(--border)] hover:text-[var(--text)]'
                }
              `}
              title="Faqat active/realtime signallar"
            >
              ● active
            </button>
          </div>

          {/* Counts */}
          <div className="text-[9px] text-ink-300/60 mb-1 px-1 flex items-center justify-between">
            <span>
              {signalsLoading ? 'Yuklanmoqda...' :
               `${filteredSignals.length} / ${signals.length} ko'rsatilgan`}
            </span>
            <span className="font-mono">
              {activeCount} active · {signals.length - activeCount} inactive
            </span>
          </div>

          <div className="max-h-[240px] overflow-y-auto rounded-md border border-[var(--border)]">
            {signalsLoading ? (
              <div className="px-2 py-3 text-center text-[10px] text-ink-300/60">Yuklanmoqda...</div>
            ) : signals.length === 0 ? (
              <div className="px-2 py-3 text-center text-[10px] text-ink-300/60">
                Bu qurilmada signal yo'q.
                <br /><span className="text-[9px]">Editorda model qo'llang</span>
              </div>
            ) : filteredSignals.length === 0 ? (
              <div className="px-2 py-3 text-center text-[10px] text-ink-300/60">
                {onlyActive ? 'Active signal topilmadi' : 'Qidiruv natijasi yo\'q'}
              </div>
            ) : (
              filteredSignals.map(s => {
                const isActive   = s.active || s.only_realtime
                const isSelected = data.signal_name === s.signal_name
                return (
                  <button
                    key={s.id}
                    onClick={() => onPatch({
                      signal_name: s.signal_name,
                      unit:        s.unit,
                      label:       data.label || s.signal_title || s.signal_name,
                    })}
                    className={`
                      w-full flex items-center gap-2 px-2 py-1 text-left text-[11px]
                      border-b border-[var(--border)] last:border-0
                      ${isSelected ? 'bg-[var(--brand)]/10 text-[var(--text)]' : 'text-ink-200 hover:bg-[var(--bg-page)]'}
                      ${!isActive ? 'opacity-60' : ''}
                    `}
                  >
                    {/* Status dot */}
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        s.active ? 'bg-[#00D68F]' :
                        s.only_realtime ? 'bg-[#FFAA00]' :
                        'bg-[var(--border)]'
                      }`}
                      title={s.active ? 'Active' : s.only_realtime ? 'Realtime-only' : 'Inactive'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-mono text-[10px]">{s.signal_name}</span>
                        {s.unit && <span className="text-[9px] text-ink-300 flex-shrink-0">{s.unit}</span>}
                      </div>
                      {s.signal_title && (
                        <div className="text-[9px] text-ink-300/70 truncate">{s.signal_title}</div>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </FieldGroup>
      )}

      {data.device_id && data.signal_name && (
        <FieldGroup label="Birlik (override)">
          <TextInput value={data.unit ?? ''} onChange={v => onPatch({ unit: v })} placeholder="Avto" />
        </FieldGroup>
      )}
    </>
  )
}

// ══════════════════════════════════════════════════
//  Reusable form bits
// ══════════════════════════════════════════════════
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-[9px] uppercase tracking-wider font-semibold text-ink-300/60 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, disabled }: {
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="
        w-full h-8 px-2 text-[12px] rounded-md
        bg-[var(--bg-page)] border border-[var(--border)]
        focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/40
        disabled:opacity-50
      "
    />
  )
}

function TextArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={3}
      className="
        w-full px-2 py-1.5 text-[12px] rounded-md resize-none
        bg-[var(--bg-page)] border border-[var(--border)]
        focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/40
      "
    />
  )
}

function NumInput({ label, value, onChange, min, max, disabled }: {
  label?: string
  value: number
  onChange?: (v: number) => void
  min?: number
  max?: number
  disabled?: boolean
}) {
  return (
    <div className="relative">
      {label && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-ink-300/60 font-mono pointer-events-none">
          {label}
        </span>
      )}
      <input
        type="number"
        value={value}
        onChange={e => onChange?.(Number(e.target.value))}
        min={min}
        max={max}
        disabled={disabled}
        className={`
          w-full h-8 ${label ? 'pl-6' : 'pl-2'} pr-2 text-[12px] font-mono rounded-md
          bg-[var(--bg-page)] border border-[var(--border)]
          focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/40
          disabled:opacity-50
        `}
      />
    </div>
  )
}

function Select({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="
          appearance-none w-full h-8 pl-2 pr-7 text-[12px] rounded-md
          bg-[var(--bg-page)] border border-[var(--border)]
          focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/40
        "
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none" />
    </div>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`
        w-9 h-5 rounded-full transition-colors relative
        ${checked ? 'bg-[var(--brand)]' : 'bg-[var(--bg-page)] border border-[var(--border)]'}
      `}
    >
      <span className={`
        absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform
        ${checked ? 'translate-x-4' : ''}
      `} />
    </button>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border border-[var(--border)] bg-[var(--bg-page)]"
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 h-8 px-2 text-[11px] font-mono rounded-md bg-[var(--bg-page)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/40"
      />
    </div>
  )
}

function nodeTypeName(kind: SchemaNodeKind): string {
  const m: Record<SchemaNodeKind, string> = {
    bus:            'Shina',
    breaker:        'Vyklyuchatel',
    disconnector:   'Razedinitel',
    transformer:    'Transformator',
    ground:         'Yerga',
    'voltage-label':'Voltaj yorlig\'i',
    device:         'Qurilma',
    'signal-value': 'Signal qiymati',
    text:           'Matn',
  }
  return m[kind] ?? kind
}

// ══════════════════════════════════════════════════
//  Page wrapper with ReactFlowProvider
// ══════════════════════════════════════════════════
export function SchemaEditorPage() {
  return (
    <ReactFlowProvider>
      <SchemaEditorInner />
    </ReactFlowProvider>
  )
}

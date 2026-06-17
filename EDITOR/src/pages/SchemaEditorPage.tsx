import { useCallback, useState, useMemo, useEffect, type DragEvent, type ElementType } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type Node, type Edge,
  BackgroundVariant, ReactFlowProvider,
  useReactFlow,
  ConnectionLineType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Save, ArrowLeft, Maximize2, Trash2,
  Zap, Square, Slash, Sigma, Globe, Type as TypeIcon,
  Cpu, Activity, ChevronDown, X, Layers3, Plus,
  Ruler, Grid3X3, Magnet, CircleDot, MoveHorizontal, MoveVertical,
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
  icon:     ElementType
  label:    string
  category: 'busbar' | 'line' | 'switch' | 'apparat' | 'data' | 'logic' | 'label' | 'helper'
  defaults: Record<string, any>
}

const PALETTE: PaletteItem[] = [
  // Busbars
  { kind: 'bus', icon: Zap, label: 'Shina (H)', category: 'busbar',
    defaults: { orientation: 'horizontal', length: 240, voltage: '220 kV' } },
  { kind: 'bus', icon: Zap, label: 'Shina (V)', category: 'busbar',
    defaults: { orientation: 'vertical',   length: 240, voltage: '10 kV' } },
  { kind: 'bus', icon: Zap, label: '110 kV shina', category: 'busbar',
    defaults: { orientation: 'horizontal', length: 420, voltage: '110 kV', color: '#FF4D7A' } },
  { kind: 'bus', icon: Zap, label: '35 kV shina', category: 'busbar',
    defaults: { orientation: 'horizontal', length: 360, voltage: '35 kV', color: '#FFB13B' } },
  { kind: 'bus', icon: Zap, label: '10 kV shina', category: 'busbar',
    defaults: { orientation: 'horizontal', length: 360, voltage: '10 kV', color: '#2DDBB3' } },

  // Lines / feeders
  { kind: 'line', icon: MoveVertical, label: 'Chiziq (V)', category: 'line',
    defaults: { orientation: 'vertical', length: 140, color: '#00D68F', dashed: false } },
  { kind: 'line', icon: MoveHorizontal, label: 'Chiziq (H)', category: 'line',
    defaults: { orientation: 'horizontal', length: 160, color: '#00D68F', dashed: false } },
  { kind: 'line', icon: MoveVertical, label: 'Dashed (V)', category: 'line',
    defaults: { orientation: 'vertical', length: 160, color: '#00D68F', dashed: true } },
  { kind: 'line', icon: MoveHorizontal, label: 'Dashed (H)', category: 'line',
    defaults: { orientation: 'horizontal', length: 180, color: '#00D68F', dashed: true } },
  { kind: 'line', icon: Slash, label: '110 kV aloqa', category: 'line',
    defaults: { orientation: 'vertical', length: 150, color: '#FF4D7A', dashed: true } },
  { kind: 'line', icon: Slash, label: '35 kV aloqa', category: 'line',
    defaults: { orientation: 'vertical', length: 120, color: '#FFB13B', dashed: true } },
  { kind: 'line', icon: Slash, label: '10 kV aloqa', category: 'line',
    defaults: { orientation: 'vertical', length: 180, color: '#2DDBB3', dashed: true } },
  { kind: 'feeder', icon: Activity, label: 'Feeder chiqish', category: 'line',
    defaults: { label: 'L-1', length: 170, color: '#00D68F', breaker: true, disconnector: true, ground: false } },

  // Switches
  { kind: 'breaker',      icon: Square, label: "Vyklyuchatel",   category: 'switch',
    defaults: { state: 'closed', label: 'Q' } },
  { kind: 'disconnector', icon: Slash,  label: "Razedinitel",    category: 'switch',
    defaults: { state: 'closed', label: 'QS' } },

  // Apparat
  { kind: 'transformer', icon: Sigma, label: "Transformator", category: 'apparat',
    defaults: { windings: 2, label: 'T', rating: '40 MVA' } },
  { kind: 'current-transformer', icon: Sigma, label: "Trans-r toka", category: 'apparat',
    defaults: { label: 'TT', color: '#9BB0D3' } },
  { kind: 'voltage-transformer', icon: Sigma, label: "TN napryaj.", category: 'apparat',
    defaults: { label: 'TN', color: '#9BB0D3' } },
  { kind: 'reactor', icon: Sigma, label: "Reaktor", category: 'apparat',
    defaults: { label: 'R', color: '#9BB0D3' } },
  { kind: 'ground',      icon: Globe, label: "Yerga",         category: 'apparat',
    defaults: {} },

  // Data
  { kind: 'device',       icon: Cpu,      label: "Qurilma",      category: 'data',
    defaults: { label: 'Device' } },
  { kind: 'signal-value', icon: Activity, label: "Signal qiymati", category: 'data',
    defaults: { label: 'Signal' } },

  // Logic
  { kind: 'block', icon: Layers3, label: 'Formula blok', category: 'logic',
    defaults: { label: 'Block', formula: 'a + b', variables: {}, unit: 'MW', decimals: 2 } },

  // Labels
  { kind: 'voltage-label', icon: TypeIcon, label: "Voltaj yorlig'i", category: 'label',
    defaults: { text: '220 kV', size: 14 } },
  { kind: 'text',          icon: TypeIcon, label: "Matn",            category: 'label',
    defaults: { text: 'Matn', size: 12 } },
  { kind: 'legend', icon: Layers3, label: "Legenda", category: 'label',
    defaults: { title: 'Legenda / Uslovnie' } },

  // Helpers
  { kind: 'junction', icon: CircleDot, label: "Ulanish nuqtasi", category: 'helper',
    defaults: { label: '', color: '#2DDBB3', size: 14 } },
]

const CATEGORIES: { key: PaletteItem['category']; label: string }[] = [
  { key: 'busbar',  label: 'Shinalar' },
  { key: 'line',    label: 'Chiziqlar' },
  { key: 'switch',  label: 'Komutatsion' },
  { key: 'apparat', label: 'Apparatlar' },
  { key: 'data',    label: 'Ma\'lumot' },
  { key: 'logic',   label: 'Formulalar' },
  { key: 'label',   label: 'Yorliqlar' },
  { key: 'helper',  label: 'Helperlar' },
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
  const [showRulers, setShowRulers]       = useState(true)
  const [showGrid,   setShowGrid]         = useState(true)
  const [snapSize,   setSnapSize]         = useState(8)

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
        style: { stroke: '#9BB0D3', strokeWidth: 1.8 },
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

  const addBoundDeviceNode = useCallback((device: Device) => {
    const center = rf.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    const node: Node = {
      id: newId(),
      type: 'device',
      position: {
        x: center.x + (Math.random() - 0.5) * 80,
        y: center.y + (Math.random() - 0.5) * 80,
      },
      data: {
        device_id: device.id,
        label: device.name,
        device_name: device.name,
        common_address: device.iec104_common_address,
        signal_count: device.signals?.length ?? 0,
      },
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
          <button
            type="button"
            onClick={() => setShowRulers(v => !v)}
            className={`h-8 px-2 rounded-md border text-[11px] flex items-center gap-1 ${showRulers ? 'border-[var(--brand)] text-[var(--text)] bg-[var(--brand)]/10' : 'border-[var(--border)] text-ink-300 hover:text-[var(--text)]'}`}
            title="Ruler helper"
          >
            <Ruler size={13} /> Ruler
          </button>
          <button
            type="button"
            onClick={() => setShowGrid(v => !v)}
            className={`h-8 px-2 rounded-md border text-[11px] flex items-center gap-1 ${showGrid ? 'border-[var(--brand)] text-[var(--text)] bg-[var(--brand)]/10' : 'border-[var(--border)] text-ink-300 hover:text-[var(--text)]'}`}
            title="Grid helper"
          >
            <Grid3X3 size={13} /> Grid
          </button>
          <label className="h-8 px-2 rounded-md border border-[var(--border)] flex items-center gap-1 text-[11px] text-ink-300">
            <Magnet size={13} />
            <select
              value={snapSize}
              onChange={e => setSnapSize(Number(e.target.value))}
              className="bg-transparent text-[var(--text)] focus:outline-none"
              title="Snap grid"
            >
              {[4, 8, 16, 24, 32].map(size => <option key={size} value={size}>{size}px</option>)}
            </select>
          </label>
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

            <div className="mt-4 pt-3 border-t border-[var(--border)]">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-300/50 mb-1.5 px-1">
                Qurilmalar
              </div>
              <div className="space-y-1">
                {devices.map(device => (
                  <button
                    key={device.id}
                    onClick={() => addBoundDeviceNode(device)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-ink-200 hover:text-[var(--text)] hover:bg-[var(--bg-page)] border border-transparent hover:border-[var(--border)] transition-all text-left"
                    title={`CASDU ${device.iec104_common_address}`}
                  >
                    <Plus size={12} className="text-[var(--brand)] flex-shrink-0" />
                    <span className="truncate">{device.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ── Center: Canvas ──────────────────────── */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={changes => {
              onNodesChange(changes)
              if (changes.some((change: any) => !['dimensions', 'select'].includes(change.type))) {
                setIsDirty(true)
              }
            }}
            onEdgesChange={changes => {
              onEdgesChange(changes)
              if (changes.some((change: any) => change.type !== 'select')) {
                setIsDirty(true)
              }
            }}
            onConnect={onConnect}
            onSelectionChange={({ nodes: sel }) => setSelectedId(sel[0]?.id ?? null)}
            nodeTypes={SCHEMA_NODE_TYPES}
            connectionLineType={ConnectionLineType.Step}
            defaultEdgeOptions={{
              type: 'step',
              style: { stroke: '#9BB0D3', strokeWidth: 1.8 },
            }}
            snapToGrid
            snapGrid={[snapSize, snapSize]}
            fitView
            proOptions={{ hideAttribution: true }}
            style={{ background: 'var(--bg-page)' }}
          >
            {showGrid && (
              <>
                <Background id="minor-grid" variant={BackgroundVariant.Dots} gap={snapSize * 2} size={1} color="var(--border)" />
                <Background id="major-grid" variant={BackgroundVariant.Lines} gap={snapSize * 10} size={1} color="rgba(92,157,255,0.18)" />
              </>
            )}
            {showRulers && <CanvasRulers snapSize={snapSize} />}
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
                  line:           '#00D68F',
                  feeder:         '#00D68F',
                  'current-transformer': '#9BB0D3',
                  'voltage-transformer': '#9BB0D3',
                  reactor:        '#9BB0D3',
                  legend:         '#5C9DFF',
                  junction:       '#2DDBB3',
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

      {kind === 'line' && (
        <>
          <FieldGroup label="Yorliq">
            <TextInput value={data.label ?? ''} onChange={v => onPatch({ label: v })} placeholder="Liniya" />
          </FieldGroup>
          <FieldGroup label="Yo'nalish">
            <Select
              value={data.orientation ?? 'vertical'}
              onChange={v => onPatch({ orientation: v })}
              options={[
                { value: 'horizontal', label: 'Gorizontal' },
                { value: 'vertical',   label: 'Vertikal' },
              ]}
            />
          </FieldGroup>
          <FieldGroup label="Uzunlik (px)">
            <NumInput value={data.length ?? 120} onChange={v => onPatch({ length: v })} min={20} max={800} />
          </FieldGroup>
          <FieldGroup label="Rang">
            <ColorPicker value={data.color ?? '#00D68F'} onChange={v => onPatch({ color: v })} />
          </FieldGroup>
          <FieldGroup label="Punktir">
            <Switch checked={!!data.dashed} onChange={v => onPatch({ dashed: v })} />
          </FieldGroup>
        </>
      )}

      {kind === 'feeder' && (
        <>
          <FieldGroup label="Yorliq">
            <TextInput value={data.label ?? ''} onChange={v => onPatch({ label: v })} placeholder="Fider" />
          </FieldGroup>
          <FieldGroup label="Uzunlik (px)">
            <NumInput value={data.length ?? 170} onChange={v => onPatch({ length: v })} min={60} max={500} />
          </FieldGroup>
          <FieldGroup label="Rang">
            <ColorPicker value={data.color ?? '#00D68F'} onChange={v => onPatch({ color: v })} />
          </FieldGroup>
          <FieldGroup label="Vyklyuchatel">
            <Switch checked={data.breaker !== false} onChange={v => onPatch({ breaker: v })} />
          </FieldGroup>
          <FieldGroup label="Razedinitel">
            <Switch checked={data.disconnector !== false} onChange={v => onPatch({ disconnector: v })} />
          </FieldGroup>
          <FieldGroup label="Yerga">
            <Switch checked={!!data.ground} onChange={v => onPatch({ ground: v })} />
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

      {(kind === 'current-transformer' || kind === 'voltage-transformer' || kind === 'reactor') && (
        <>
          <FieldGroup label="Yorliq">
            <TextInput value={data.label ?? ''} onChange={v => onPatch({ label: v })} placeholder="TT / TN / R" />
          </FieldGroup>
          <FieldGroup label="Rang">
            <ColorPicker value={data.color ?? '#9BB0D3'} onChange={v => onPatch({ color: v })} />
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

      {kind === 'legend' && (
        <FieldGroup label="Sarlavha">
          <TextInput value={data.title ?? ''} onChange={v => onPatch({ title: v })} placeholder="Legenda / Uslovnie" />
        </FieldGroup>
      )}

      {kind === 'junction' && (
        <>
          <FieldGroup label="Yorliq">
            <TextInput value={data.label ?? ''} onChange={v => onPatch({ label: v })} placeholder="Ulanish" />
          </FieldGroup>
          <FieldGroup label="Hajm (px)">
            <NumInput value={data.size ?? 14} onChange={v => onPatch({ size: v })} min={6} max={40} />
          </FieldGroup>
          <FieldGroup label="Rang">
            <ColorPicker value={data.color ?? '#2DDBB3'} onChange={v => onPatch({ color: v })} />
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

      {kind === 'block' && (
        <BlockFields data={data} devices={devices} onPatch={onPatch} />
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

function CanvasRulers({ snapSize }: { snapSize: number }) {
  const major = snapSize * 10
  const ticks = Array.from({ length: 40 }, (_, index) => index * major)
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute left-0 top-0 h-6 w-full border-b border-[var(--border)] bg-[rgba(7,12,26,0.78)] backdrop-blur-sm">
        {ticks.map(x => (
          <div key={`x-${x}`} className="absolute top-0 h-full border-l border-[rgba(155,176,211,0.35)]" style={{ left: x }}>
            <span className="ml-1 text-[9px] font-mono text-ink-300">{x}</span>
          </div>
        ))}
      </div>
      <div className="absolute left-0 top-0 h-full w-8 border-r border-[var(--border)] bg-[rgba(7,12,26,0.78)] backdrop-blur-sm">
        {ticks.map(y => (
          <div key={`y-${y}`} className="absolute left-0 w-full border-t border-[rgba(155,176,211,0.35)]" style={{ top: y }}>
            <span className="absolute left-1 top-1 text-[9px] font-mono text-ink-300 [writing-mode:vertical-rl]">{y}</span>
          </div>
        ))}
      </div>
      <div className="absolute left-0 top-0 h-6 w-8 border-b border-r border-[var(--border)] bg-[rgba(9,17,35,0.96)]" />
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
      String(d.iec104_common_address).includes(search)
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
            <code className="text-[10px] text-ink-300">CASDU {selectedDevice.iec104_common_address} · {selectedDevice.signals?.length ?? 0} signal</code>
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
                  device_name: d.name,
                  common_address: d.iec104_common_address,
                  signal_count: d.signals?.length ?? 0,
                })}
                className={`
                  w-full flex flex-col items-start px-2 py-1.5 text-left text-[11px]
                  border-b border-[var(--border)] last:border-0
                  ${data.device_id === d.id ? 'bg-[var(--brand)]/10' : 'hover:bg-[var(--bg-page)]'}
                `}
              >
                <span className="font-medium text-[var(--text)] truncate w-full">{d.name}</span>
                <code className="text-[9px] text-ink-300">CASDU {d.iec104_common_address}</code>
              </button>
            ))
          )}
        </div>
      </FieldGroup>
    </>
  )
}

function BlockFields({
  data, devices, onPatch,
}: { data: any; devices: Device[]; onPatch: (p: Record<string, any>) => void }) {
  const variables = useMemo<Record<string, any>>(() => data.variables ?? {}, [data.variables])
  const variableKeys = useMemo(() => Object.keys(variables).sort(), [variables])
  const [selectedVar, setSelectedVar] = useState<string>('')
  const [deviceSearch, setDeviceSearch] = useState('')
  const [signalSearch, setSignalSearch] = useState('')
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | ''>('')

  useEffect(() => {
    if (!selectedVar && variableKeys.length > 0) setSelectedVar(variableKeys[0])
    if (selectedVar && !variables[selectedVar]) setSelectedVar(variableKeys[0] ?? '')
  }, [selectedVar, variableKeys, variables])

  useEffect(() => {
    function handleVariableClick(event: Event) {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key
      if (!key) return
      if (!variables[key]) {
        patchVariables({ ...variables, [key]: { signal_name: '', scale: 1, offset: 0 } })
      }
      setSelectedVar(key)
      setTimeout(() => document.getElementById('block-signal-source')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 20)
    }
    window.addEventListener('schema:block-variable-click', handleVariableClick)
    return () => window.removeEventListener('schema:block-variable-click', handleVariableClick)
  }, [variables])

  const { data: sigsPage, isLoading: signalsLoading } = useQuery({
    queryKey: ['block-signals', selectedDeviceId],
    queryFn:  () => signalApi.list(Number(selectedDeviceId), 0, 5000),
    enabled:  selectedDeviceId !== '',
  })
  const signals: Signal[] = sigsPage?.items ?? []

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase()
    return devices.filter(d =>
      !q ||
      d.name.toLowerCase().includes(q) ||
      String(d.iec104_common_address).includes(q)
    )
  }, [deviceSearch, devices])

  const filteredSignals = useMemo(() => {
    const q = signalSearch.trim().toLowerCase()
    return signals.filter(s =>
      !q ||
      s.signal_name.toLowerCase().includes(q) ||
      (s.signal_title ?? '').toLowerCase().includes(q) ||
      String(s.register_code).includes(q)
    )
  }, [signalSearch, signals])

  function nextVariableKey() {
    for (const key of 'abcdefghijklmnopqrstuvwxyz') {
      if (!variables[key]) return key
    }
    return `v${variableKeys.length + 1}`
  }

  function patchVariables(next: Record<string, any>) {
    onPatch({ variables: next })
  }

  function addVariable() {
    const key = nextVariableKey()
    patchVariables({
      ...variables,
      [key]: { device_id: selectedDeviceId || undefined, signal_name: '', scale: 1, offset: 0 },
    })
    setSelectedVar(key)
  }

  function renameVariable(oldKey: string, nextKeyRaw: string) {
    const nextKey = nextKeyRaw.trim().replace(/[^A-Za-z0-9_]/g, '')
    if (!nextKey || nextKey === oldKey || variables[nextKey]) return
    const next: Record<string, any> = {}
    for (const [key, value] of Object.entries(variables)) {
      next[key === oldKey ? nextKey : key] = value
    }
    patchVariables(next)
    setSelectedVar(nextKey)
  }

  function updateVariable(key: string, patch: Record<string, any>) {
    patchVariables({
      ...variables,
      [key]: { ...(variables[key] ?? {}), ...patch },
    })
  }

  function removeVariable(key: string) {
    const next = { ...variables }
    delete next[key]
    patchVariables(next)
    setSelectedVar(Object.keys(next)[0] ?? '')
  }

  function bindSignal(key: string, signal: Signal, deviceId = selectedDeviceId) {
    if (!deviceId) return
    updateVariable(key, {
      device_id: Number(deviceId),
      signal_name: signal.signal_name,
      scale: variables[key]?.scale ?? 1,
      offset: variables[key]?.offset ?? 0,
    })
  }

  function addSignalAsVariable(signal: Signal) {
    if (!selectedDeviceId) return
    const key = nextVariableKey()
    patchVariables({
      ...variables,
      [key]: { device_id: Number(selectedDeviceId), signal_name: signal.signal_name, scale: 1, offset: 0 },
    })
    setSelectedVar(key)
  }

  function onSignalDragStart(e: DragEvent, signal: Signal) {
    if (!selectedDeviceId) return
    e.dataTransfer.setData('application/json', JSON.stringify({
      device_id: Number(selectedDeviceId),
      signal_name: signal.signal_name,
    }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  function onVariableDrop(e: DragEvent, key: string) {
    e.preventDefault()
    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/json'))
      if (payload?.device_id && payload?.signal_name) {
        updateVariable(key, {
          device_id: Number(payload.device_id),
          signal_name: String(payload.signal_name),
          scale: variables[key]?.scale ?? 1,
          offset: variables[key]?.offset ?? 0,
        })
        setSelectedVar(key)
      }
    } catch {
      // Ignore invalid drag payloads from outside the editor.
    }
  }

  return (
    <>
      <FieldGroup label="Yorliq">
        <TextInput value={data.label ?? ''} onChange={v => onPatch({ label: v })} placeholder="Balans bloki" />
      </FieldGroup>
      <FieldGroup label="Formula">
        <TextArea value={data.formula ?? ''} onChange={v => onPatch({ formula: v })} />
      </FieldGroup>
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Birlik">
          <TextInput value={data.unit ?? ''} onChange={v => onPatch({ unit: v })} placeholder="MW" />
        </FieldGroup>
        <FieldGroup label="Aniqlik">
          <NumInput value={data.decimals ?? 2} onChange={v => onPatch({ decimals: v })} min={0} max={6} />
        </FieldGroup>
      </div>
      <FieldGroup label="O'zgaruvchilar">
        <div className="space-y-2">
          {variableKeys.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-4 text-center text-[11px] text-ink-300">
              Variable yo'q
            </div>
          ) : (
            variableKeys.map(key => {
              const binding = variables[key] ?? {}
              const boundDevice = devices.find(d => d.id === binding.device_id)
              const active = key === selectedVar
              return (
                <div
                  key={key}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => onVariableDrop(e, key)}
                  onClick={() => setSelectedVar(key)}
                  className={`
                    rounded-md border p-2 cursor-pointer transition-colors
                    ${active ? 'border-[var(--brand)] bg-[var(--brand)]/10' : 'border-[var(--border)] bg-[var(--bg-page)] hover:border-[var(--border-hover)]'}
                  `}
                >
                  <div className="flex items-center gap-2">
                    <input
                      key={key}
                      defaultValue={key}
                      onClick={e => e.stopPropagation()}
                      onBlur={e => renameVariable(key, e.target.value)}
                      className="h-7 w-12 rounded bg-[var(--bg-card)] border border-[var(--border)] px-2 text-[11px] font-mono text-[var(--text)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] font-medium text-[var(--text)]">
                          {binding.signal_name || 'Signal tanlanmagan'}
                        </span>
                        {binding.value_source && binding.value_source !== 'realtime' && (
                          <span className={`flex-shrink-0 text-[8px] font-bold px-1 py-0.5 rounded uppercase ${
                            binding.value_source === 'first'
                              ? 'bg-[#2979FF]/20 text-[#2979FF]'
                              : 'bg-[#00D68F]/20 text-[#00D68F]'
                          }`}>
                            {binding.value_source === 'first' ? '1-si' : 'Oxirgi'}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[9px] text-ink-300">
                        {boundDevice ? `${boundDevice.name} · CASDU ${boundDevice.iec104_common_address}` : 'Qurilma tanlanmagan'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); removeVariable(key) }}
                      className="h-7 w-7 rounded-md text-[#FF3D71] hover:bg-[#FF3D71]/10"
                      title="O'chirish"
                    >
                      <X size={13} className="mx-auto" />
                    </button>
                  </div>
                  {active && (
                    <div className="mt-2 space-y-2">
                      {/* Value source */}
                      <div>
                        <div className="text-[9px] uppercase tracking-wider font-semibold text-ink-300/60 mb-1">Manba</div>
                        <div className="flex gap-1">
                          {(['realtime', 'first', 'last'] as const).map(src => (
                            <button
                              key={src}
                              type="button"
                              onClick={e => { e.stopPropagation(); updateVariable(key, { value_source: src }) }}
                              className={`flex-1 h-7 text-[10px] rounded-md border transition-colors ${
                                (binding.value_source ?? 'realtime') === src
                                  ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                                  : 'bg-[var(--bg-page)] text-ink-300 border-[var(--border)] hover:text-[var(--text)]'
                              }`}
                            >
                              {src === 'realtime' ? 'Realtime' : src === 'first' ? 'Birinchi' : 'Oxirgi'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Time range — only for first/last */}
                      {(binding.value_source === 'first' || binding.value_source === 'last') && (
                        <div className="rounded-md border border-[var(--border)] p-2 space-y-2 bg-[var(--bg-page)]">
                          {/* Day preset */}
                          <div>
                            <div className="text-[9px] uppercase tracking-wider font-semibold text-ink-300/60 mb-1">Kun</div>
                            <div className="flex gap-1">
                              {(['today', 'yesterday', 'custom'] as const).map(p => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={e => { e.stopPropagation(); updateVariable(key, { range_preset: p }) }}
                                  className={`flex-1 h-7 text-[10px] rounded-md border transition-colors ${
                                    (binding.range_preset ?? 'today') === p
                                      ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                                      : 'bg-[var(--bg-page)] text-ink-300 border-[var(--border)] hover:text-[var(--text)]'
                                  }`}
                                >
                                  {p === 'today' ? 'Bugun' : p === 'yesterday' ? 'Kecha' : 'Maxsus'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Custom date picker */}
                          {binding.range_preset === 'custom' && (
                            <input
                              type="date"
                              value={binding.range_custom_date ?? ''}
                              onChange={e => updateVariable(key, { range_custom_date: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] rounded-md bg-[var(--bg-card)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/40"
                            />
                          )}

                          {/* Time range: from / to */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-[9px] text-ink-300/60 mb-0.5">Dan (boshlanish)</div>
                              <input
                                type="time"
                                value={binding.range_from ?? '00:00'}
                                onChange={e => updateVariable(key, { range_from: e.target.value })}
                                className="w-full h-7 px-2 text-[11px] rounded-md bg-[var(--bg-card)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/40"
                              />
                            </div>
                            <div>
                              <div className="text-[9px] text-ink-300/60 mb-0.5">Gacha (tugash)</div>
                              <input
                                type="text"
                                value={binding.range_to ?? '24:00'}
                                onChange={e => updateVariable(key, { range_to: e.target.value })}
                                placeholder="24:00"
                                className="w-full h-7 px-2 text-[11px] font-mono rounded-md bg-[var(--bg-card)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/40"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Scale / Offset */}
                      <div className="grid grid-cols-2 gap-2">
                        <NumInput label="scale" value={binding.scale ?? 1} onChange={v => updateVariable(key, { scale: v })} />
                        <NumInput label="offset" value={binding.offset ?? 0} onChange={v => updateVariable(key, { offset: v })} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
          <Button variant="outline" size="sm" icon={<Plus size={13} />} onClick={addVariable}>
            Variable
          </Button>
        </div>
      </FieldGroup>
      <div id="block-signal-source">
      <FieldGroup label="Signal manbasi">
        <input
          type="text"
          value={deviceSearch}
          onChange={e => setDeviceSearch(e.target.value)}
          placeholder="Qurilma qidirish..."
          className="w-full h-7 px-2 mb-1 text-[11px] rounded-md bg-[var(--bg-page)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/40"
        />
        <div className="max-h-[120px] overflow-y-auto rounded-md border border-[var(--border)]">
          {filteredDevices.map(d => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedDeviceId(d.id)}
              className={`
                w-full px-2 py-1.5 text-left text-[11px] border-b border-[var(--border)] last:border-0
                ${selectedDeviceId === d.id ? 'bg-[var(--brand)]/10 text-[var(--text)]' : 'text-ink-200 hover:bg-[var(--bg-page)]'}
              `}
            >
              <span className="block truncate">{d.name}</span>
              <code className="text-[9px] text-ink-300">CASDU {d.iec104_common_address}</code>
            </button>
          ))}
        </div>
        {selectedDeviceId && (
          <div className="mt-2">
            <input
              type="text"
              value={signalSearch}
              onChange={e => setSignalSearch(e.target.value)}
              placeholder="Signal qidirish..."
              className="w-full h-7 px-2 mb-1 text-[11px] rounded-md bg-[var(--bg-page)] border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]/40"
            />
            <div className="max-h-[180px] overflow-y-auto rounded-md border border-[var(--border)]">
              {signalsLoading ? (
                <div className="px-2 py-3 text-center text-[10px] text-ink-300/60">Yuklanmoqda...</div>
              ) : filteredSignals.length === 0 ? (
                <div className="px-2 py-3 text-center text-[10px] text-ink-300/60">Signal topilmadi</div>
              ) : (
                filteredSignals.map(signal => (
                  <button
                    key={signal.id}
                    type="button"
                    draggable
                    onDragStart={e => onSignalDragStart(e, signal)}
                    onClick={() => selectedVar ? bindSignal(selectedVar, signal) : addSignalAsVariable(signal)}
                    className="w-full px-2 py-1.5 text-left text-[11px] text-ink-200 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-page)]"
                    title="Click yoki variable ustiga torting"
                  >
                    <span className="block truncate font-medium text-[var(--text)]">{signal.signal_name}</span>
                    <span className="block truncate text-[9px] text-ink-300">
                      IOA {signal.register_code}{signal.unit ? ` · ${signal.unit}` : ''}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </FieldGroup>
      </div>
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
            <code className="ml-1 text-ink-300">(CASDU {selectedDevice.iec104_common_address})</code>
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
              <div className="mt-1 flex items-center gap-1.5 text-[9px] text-ink-300">
                <code>IOA {selectedSignal.register_code}</code>
                <span>·</span>
                <span>{selectedSignal.value_type}</span>
                {selectedSignal.unit && (
                  <>
                    <span>·</span>
                    <span>{selectedSignal.unit}</span>
                  </>
                )}
                <span>·</span>
                <span className={selectedSignal.active ? 'text-[#00D68F]' : selectedSignal.only_realtime ? 'text-[#FFAA00]' : ''}>
                  {selectedSignal.active ? 'active' : selectedSignal.only_realtime ? 'realtime' : 'inactive'}
                </span>
              </div>
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
                        <span className="text-[9px] text-ink-300 flex-shrink-0">IOA {s.register_code}</span>
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
    line:           'Chiziq',
    feeder:         'Feeder',
    'current-transformer': 'Trans-r toka',
    'voltage-transformer': 'TN napryaj.',
    reactor:        'Reaktor',
    legend:         'Legenda',
    'voltage-label':'Voltaj yorlig\'i',
    device:         'Qurilma',
    'signal-value': 'Signal qiymati',
    block:          'Formula bloki',
    text:           'Matn',
    junction:       'Ulanish nuqtasi',
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

import { useCallback, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type Node, type Edge,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Save, ArrowLeft, Plus, Maximize2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { substationApi } from '@/lib/api'

// ── Device Node ─────────────────────────────────
function DeviceNode({ data, selected }: { data: { label: string; type: string }; selected: boolean }) {
  const TYPE_COLORS: Record<string, string> = {
    Relay:       'bg-blue-500/10 text-blue-400 border-blue-500/30',
    Transformer: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    Switch:      'bg-green-500/10 text-green-400 border-green-500/30',
    Bus:         'bg-slate-500/10 text-slate-400 border-slate-500/30',
    Meter:       'bg-amber-500/10 text-amber-400 border-amber-500/30',
  }

  return (
    <div className={`
      bg-[var(--bg-card)] rounded-xl border-2 px-4 py-3 min-w-[160px] shadow-lg
      transition-all duration-150
      ${selected
        ? 'border-[var(--brand)] shadow-[0_0_0_3px_rgba(41,121,255,0.15)]'
        : 'border-[var(--border)] hover:border-[var(--border-hover)]'
      }
    `}>
      <div className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border inline-block mb-2 ${TYPE_COLORS[data.type] ?? TYPE_COLORS.Bus}`}>
        {data.type}
      </div>
      <div className="text-[13px] font-semibold text-[var(--text)]">{data.label}</div>
    </div>
  )
}

const nodeTypes = { device: DeviceNode }

let nodeIdCounter = 1
function newId() { return `node_${Date.now()}_${nodeIdCounter++}` }

// ── Main Page ────────────────────────────────────
export function SchemaEditorPage() {
  const { id }   = useParams<{ id: string }>()
  const subId    = Number(id)
  const navigate = useNavigate()
  const rfRef    = useRef<any>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [isDirty, setIsDirty] = useState(false)

  // Load schema
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

  // Save schema
  const saveMutation = useMutation({
    mutationFn: () => substationApi.saveSchema(subId, { nodes, edges }),
    onSuccess: () => { toast.success('Sxema saqlandi'); setIsDirty(false) },
    onError: (e: Error) => toast.error(e.message),
  })

  const onConnect = useCallback(
    (conn: Connection) => { setEdges(eds => addEdge(conn, eds)); setIsDirty(true) },
    [setEdges],
  )

  function addNode(type: string) {
    const newNode: Node = {
      id:       newId(),
      type:     'device',
      position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 200 },
      data:     { label: type, type },
    }
    setNodes(ns => [...ns, newNode])
    setIsDirty(true)
  }

  const NODE_TYPES = ['Relay', 'Transformer', 'Switch', 'Bus', 'Meter']

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Toolbar */}
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
            <span className="text-[13px] font-medium text-[var(--text)]">Sxema Muharriri</span>
            {isDirty && <span className="ml-2 text-[11px] text-[var(--warning)]">● Saqlanmagan</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add node dropdown */}
          <div className="flex items-center gap-1">
            {NODE_TYPES.map(type => (
              <Button key={type} variant="ghost" size="xs" onClick={() => addNode(type)}
                icon={<Plus size={11} />}>
                {type}
              </Button>
            ))}
          </div>

          <div className="h-4 w-px bg-[var(--border)]" />

          {/* Fit view */}
          <Button variant="ghost" size="sm" icon={<Maximize2 size={13} />}
            onClick={() => rfRef.current?.fitView({ padding: 0.1 })} />

          {/* Save */}
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={13} />}
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Saqlash
          </Button>
        </div>
      </motion.div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          ref={rfRef}
          nodes={nodes}
          edges={edges}
          onNodesChange={changes => { onNodesChange(changes); setIsDirty(true) }}
          onEdgesChange={changes => { onEdgesChange(changes); setIsDirty(true) }}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          style={{ background: 'var(--bg-page)' }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--border)"
          />
          <Controls
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
            }}
          />
          <MiniMap
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
            }}
            nodeColor="var(--brand)"
          />
        </ReactFlow>
      </div>
    </div>
  )
}

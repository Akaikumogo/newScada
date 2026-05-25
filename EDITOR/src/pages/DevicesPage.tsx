import { useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Signal, Server, FileSpreadsheet, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { deviceApi, substationApi } from '@/lib/api'
import type { Device } from '@/types'

const PAGE_SIZE = 10

const deviceSchema = z.object({
  name:                    z.string().min(1, 'Nom kiriting').max(120),
  substation_id:           z.coerce.number().positive('Podstansiya tanlang'),
  model_id:                z.coerce.number().positive('Model tanlang'),
  iec104_host:             z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'IP manzil noto\'g\'ri (masalan: 192.168.1.10)'),
  iec104_port:             z.coerce.number().int().min(1).max(65535, 'Port 1–65535 bo\'lsin'),
  iec104_common_address:   z.coerce.number().int().min(1).max(65535, 'CASDU 1–65535 bo\'lsin'),
  poll_interval_seconds:   z.coerce.number().min(0.5, 'Minimal: 0.5 soniya'),
})
type DeviceForm = z.infer<typeof deviceSchema>

const columns: Column<Device>[] = [
  { key: 'name', label: 'Qurilma nomi', render: row => (
    <div>
      <div className="text-[13px] font-medium text-[var(--text)]">{row.name}</div>
      {row.model && <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{row.model.name}</div>}
    </div>
  )},
  { key: 'iec104_host', label: 'IP : Port', render: row => (
    <code className="mono text-[12px] bg-[var(--bg-hover)] px-2 py-0.5 rounded text-[var(--text-secondary)]">
      {row.iec104_host}:{row.iec104_port}
    </code>
  )},
  { key: 'iec104_common_address', label: 'CASDU', align: 'center', render: row => <span className="mono text-[13px]">{row.iec104_common_address}</span> },
  { key: 'poll_interval_seconds', label: 'Interval', align: 'center', render: row => <span className="mono text-[13px]">{row.poll_interval_seconds}s</span> },
]

function DeviceFormComponent({ defaultValues, onSubmit, substations, models }: {
  defaultValues?: Partial<DeviceForm>
  onSubmit: (data: DeviceForm) => Promise<void>
  substations: { value: number; label: string }[]
  models: { value: number; label: string }[]
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<DeviceForm>({
    resolver: zodResolver(deviceSchema),
    defaultValues: { iec104_port: 2404, poll_interval_seconds: 1.0, ...defaultValues },
  })
  return (
    <form id="device-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input label="Qurilma nomi" required placeholder="BMRZ-153 №1" error={errors.name?.message} {...register('name')} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Podstansiya" required error={errors.substation_id?.message} options={[{ value: '', label: 'Tanlang...' }, ...substations]} {...register('substation_id')} />
        <Select label="Model" required error={errors.model_id?.message} options={[{ value: '', label: 'Tanlang...' }, ...models]} {...register('model_id')} />
      </div>
      <div className="pt-1">
        <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <div className="flex-1 h-px bg-[var(--border)]" /> IEC 104 Ulanish <div className="flex-1 h-px bg-[var(--border)]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="IP manzil" required placeholder="192.168.199.10" mono error={errors.iec104_host?.message} hint="Qurilmaning tarmoq IP manzili" {...register('iec104_host')} />
          <Input label="Port" required type="number" placeholder="2404" mono error={errors.iec104_port?.message} {...register('iec104_port')} />
          <Input label="CASDU" required type="number" placeholder="1" mono hint="Common Address (1–65535)" error={errors.iec104_common_address?.message} {...register('iec104_common_address')} />
          <Input label="So'rov intervali (sek)" required type="number" step="0.5" placeholder="2.0" mono hint="Minimal: 0.5" error={errors.poll_interval_seconds?.message} {...register('poll_interval_seconds')} />
        </div>
      </div>
    </form>
  )
}

export function DevicesPage() {
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editTarget,  setEditTarget]  = useState<Device | null>(null)
  const [deleteTarget,setDeleteTarget] = useState<Device | null>(null)
  const [selected,    setSelected]    = useState<Set<number>>(new Set())
  const [bulkDel,     setBulkDel]     = useState(false)

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['devices-all'],
    queryFn: ({ pageParam = 0 }) => deviceApi.listAll(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, _all, lastParam) =>
      lastParam + last.items.length < last.total ? lastParam + last.items.length : undefined,
    staleTime: 30_000,
  })

  const devices = useMemo(() => data?.pages.flatMap(p => p.items) ?? [], [data])
  const total = data?.pages[0]?.total ?? 0

  const { data: subsPage } = useQuery({
    queryKey: ['substations-all'],
    queryFn: () => substationApi.list({ limit: 0 }),
    staleTime: 60_000,
  })
  const substations = subsPage?.items ?? []

  const createMutation = useMutation({
    mutationFn: deviceApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['devices-all'] }); toast.success('Qurilma qo\'shildi'); setModalOpen(false) },
    onError: (e: Error) => toast.error(e.message),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => deviceApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['devices-all'] }); toast.success('Saqlandi'); setEditTarget(null) },
    onError: (e: Error) => toast.error(e.message),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deviceApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['devices-all'] }); toast.success('Qurilma o\'chirildi'); setDeleteTarget(null) },
    onError: (e: Error) => toast.error(e.message),
  })
  const bulkRemove = useMutation({
    mutationFn: deviceApi.bulkDelete,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['devices-all'] })
      toast.success(`${res.deleted} ta qurilma o'chirildi`)
      setSelected(new Set()); setBulkDel(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const deleteAll = useMutation({
    mutationFn: deviceApi.deleteAll,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['devices-all'] })
      toast.success(`Barchasini o'chirildi: ${res.deleted} ta qurilma`)
      setSelected(new Set()); setBulkDel(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadDeviceId, setUploadDeviceId] = useState<number | null>(null)
  const importMutation = useMutation({
    mutationFn: ({ deviceId, file }: { deviceId: number; file: File }) => deviceApi.importExcel(deviceId, file),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['devices-all'] })
      toast.success(`${result.device_name}: ${result.applied} ta signal qo'shildi, ${result.skipped} ta mavjud edi (faylda ${result.total_in_file} ta)`, { duration: 6000 })
    },
    onError: (e: Error) => toast.error(`Import xato: ${e.message}`),
  })

  function handleExcelUpload(deviceId: number) { setUploadDeviceId(deviceId); fileInputRef.current?.click() }
  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && uploadDeviceId) importMutation.mutate({ deviceId: uploadDeviceId, file })
    e.target.value = ''
  }

  const substationOptions = substations.map(s => ({ value: s.id, label: s.name }))
  const modelOptions = [{ value: 1, label: 'BMRZ-153' }, { value: 2, label: 'SIPROTEC-7SJ85' }]

  return (
    <div className="p-6 flex flex-col gap-6">
      <motion.div className="flex items-center justify-between" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h1 className="text-[20px] font-semibold text-[var(--text)]">Qurilmalar</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{isLoading ? '...' : `${total} ta qurilma`}</p>
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.9, x: 8 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 8 }}>
                <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setBulkDel(true)}>{selected.size} ta o'chirish</Button>
              </motion.div>
            )}
          </AnimatePresence>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>Qurilma qo'shish</Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <DataTable
          columns={columns} data={devices} isLoading={isLoading}
          onEdit={row => setEditTarget(row)} onDelete={row => setDeleteTarget(row)}
          selectable selectedIds={selected} onSelectionChange={setSelected}
          hasMore={hasNextPage} onLoadMore={fetchNextPage} isLoadingMore={isFetchingNextPage} total={total}
          rowActions={row => (
            <div className="flex gap-1">
              <Button variant="ghost" size="xs" icon={<FileSpreadsheet size={12} />}
                onClick={e => { e.stopPropagation(); handleExcelUpload(row.id) }} title="Excel dan import"
                loading={importMutation.isPending && uploadDeviceId === row.id} />
              <Button variant="ghost" size="xs" icon={<Signal size={12} />}
                onClick={e => { e.stopPropagation(); navigate(`/devices/${row.id}/signals`) }} title="Signallar" />
              <Button variant="ghost" size="xs" icon={<Server size={12} />}
                onClick={e => { e.stopPropagation(); setEditTarget(row) }} title="Tahrirlash" />
            </div>
          )}
          emptyText="Qurilmalar yo'q. Birinchi qurilmani qo'shing."
        />
      </motion.div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Yangi qurilma" size="md"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
          <Button variant="primary" form="device-form" type="submit" loading={createMutation.isPending}>Saqlash</Button></>}>
        <DeviceFormComponent substations={substationOptions} models={modelOptions} onSubmit={async d => { await createMutation.mutateAsync({ ...d, protocol: 'iec104' } as any) }} />
      </Modal>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Qurilmani tahrirlash" size="md"
        footer={<><Button variant="ghost" onClick={() => setEditTarget(null)}>Bekor qilish</Button>
          <Button variant="primary" form="device-form" type="submit" loading={updateMutation.isPending}>Saqlash</Button></>}>
        {editTarget && <DeviceFormComponent defaultValues={editTarget as any} substations={substationOptions} models={modelOptions}
          onSubmit={async d => { await updateMutation.mutateAsync({ id: editTarget.id, data: d }) }} />}
      </Modal>

      <input ref={fileInputRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFileSelected} />

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} loading={deleteMutation.isPending}
        title="Qurilmani o'chirish" variant="danger"
        message={<div className="flex flex-col gap-3"><p><strong className="text-[var(--text)]">{deleteTarget?.name}</strong> ni o'chirmoqchimisiz?</p>
          <div className="p-3 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)]/20 text-[var(--danger)] text-[12px]">⚠ Bu qurilmaning barcha signallari va tarixiy yozuvlari ham o'chib ketadi.</div></div>} />

      <ConfirmDialog open={bulkDel} onClose={() => setBulkDel(false)} variant="danger"
        title="Qurilmalarni o'chirish"
        message={<div className="flex flex-col gap-4">
          <p className="text-[13px] text-[var(--text)]">Qaysi qurilmalarni o'chirmoqchisiz?</p>
          <div className="space-y-2">
            <button
              onClick={() => bulkRemove.mutate([...selected])}
              disabled={bulkRemove.isPending || deleteAll.isPending}
              className="w-full px-3 py-2 text-left text-[13px] rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-[var(--text)]">Sahifadagilarni o'chirish</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1">{selected.size} ta qurilma (faqat yuklanganlari)</div>
            </button>
            <button
              onClick={() => deleteAll.mutate()}
              disabled={bulkRemove.isPending || deleteAll.isPending}
              className="w-full px-3 py-2 text-left text-[13px] rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)]/20 hover:bg-[var(--danger-bg)]/40 transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-[var(--danger)]">🗑 Barchasini bazadan o'chirish</div>
              <div className="text-[11px] text-[var(--danger)]/70 mt-1">{total} ta qurilma (hammasini)</div>
            </button>
          </div>
          <div className="p-3 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)]/20 text-[var(--danger)] text-[11px]">
            ⚠ Barcha signallar va tarixiy yozuvlar ham o'chib ketadi.
          </div>
        </div>} />
    </div>
  )
}

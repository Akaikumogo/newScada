import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, ArrowLeft, Zap, CheckCircle2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { modelApi } from '@/lib/api'
import type { ModelSignal } from '@/types'

const PAGE_SIZE = 10
const schema = z.object({
  register_code: z.coerce.number().int().min(0, 'IOA kiriting'),
  signal_name:   z.string().min(1).max(64).regex(/^\w+$/, 'Faqat harf, raqam va _'),
  signal_title:  z.string().max(160).optional(),
  unit:          z.string().max(24).optional(),
  value_type:    z.enum(['float', 'status']),
})
type Form = z.infer<typeof schema>

const columns: Column<ModelSignal>[] = [
  { key: 'register_code', label: 'IOA', align: 'center', width: 'w-20',
    render: row => <span className="mono text-[13px] font-medium">{row.register_code}</span> },
  { key: 'signal_name', label: 'Signal nomi',
    render: row => <code className="mono text-[12px] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded">{row.signal_name}</code> },
  { key: 'signal_title', label: 'O\'zbek nomi',
    render: row => <span className="text-[var(--text-secondary)]">{row.signal_title ?? '—'}</span> },
  { key: 'unit', label: 'Birlik', width: 'w-20', align: 'center',
    render: row => <span className="mono text-[12px]">{row.unit || '—'}</span> },
  { key: 'value_type', label: 'Tur', width: 'w-24',
    render: row => (
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
        row.value_type === 'float' ? 'bg-[var(--brand-bg)] text-[var(--brand)]' : 'bg-[var(--success-bg)] text-[var(--success)]'
      }`}>{row.value_type === 'float' ? 'O\'lchov' : 'Holat'}</span>
    )},
]

export function ModelSignalsPage() {
  const { id }      = useParams<{ id: string }>()
  const modelId     = Number(id)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<ModelSignal | null>(null)
  const [del,  setDel]  = useState<ModelSignal | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDel, setBulkDel]   = useState(false)

  const { data: modelPage } = useQuery({
    queryKey: ['model', modelId],
    queryFn:  () => modelApi.list(0, 0).then(page => page.items.find(m => m.id === modelId)),
    enabled: !!modelId,
    staleTime: 60_000,
  })

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['model-signals', modelId],
    queryFn: ({ pageParam = 0 }) => modelApi.listSignals(modelId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, _all, lastParam) =>
      lastParam + last.items.length < last.total ? lastParam + last.items.length : undefined,
    enabled: !!modelId,
    staleTime: 30_000,
  })

  const allItems = useMemo(() => data?.pages.flatMap(p => p.items) ?? [], [data])
  const total = data?.pages[0]?.total ?? 0

  const create = useMutation({
    mutationFn: (data: Form) => modelApi.createSignal(modelId, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-signals', modelId] })
      queryClient.invalidateQueries({ queryKey: ['models'] })
      toast.success('Signal qo\'shildi'); setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Form }) => modelApi.updateSignal(modelId, id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-signals', modelId] })
      toast.success('Saqlandi'); setEdit(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (sigId: number) => modelApi.deleteSignal(modelId, sigId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-signals', modelId] })
      queryClient.invalidateQueries({ queryKey: ['models'] })
      toast.success('O\'chirildi'); setDel(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const bulkRemove = useMutation({
    mutationFn: (ids: number[]) => modelApi.bulkDeleteSignals(modelId, ids),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['model-signals', modelId] })
      queryClient.invalidateQueries({ queryKey: ['models'] })
      toast.success(`${res.deleted} ta signal o'chirildi`)
      setSelected(new Set()); setBulkDel(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const deleteAll = useMutation({
    mutationFn: () => modelApi.deleteAllSignals(modelId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['model-signals', modelId] })
      queryClient.invalidateQueries({ queryKey: ['models'] })
      toast.success(`Barchasini o'chirildi: ${res.deleted} ta signal`)
      setSelected(new Set()); setBulkDel(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const applyAll = useMutation({
    mutationFn: () => modelApi.applyToAll(modelId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['devices-all'] })
      toast.success(`Qo'llandi: ${res.applied} ta signal, ${res.devices} ta qurilma` + (res.skipped ? ` (${res.skipped} ta o'tkazildi)` : ''))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function SignalForm({ defaultValues, onSubmit }: { defaultValues?: Partial<Form>; onSubmit: (d: Form) => void }) {
    const { register, handleSubmit, formState: { errors } } = useForm<Form>({
      resolver: zodResolver(schema),
      defaultValues: { value_type: 'float', unit: '', ...defaultValues },
    })
    return (
      <form id="model-signal-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="IOA (Register kodi)" required type="number" mono placeholder="1000" hint="Qurilmadan keluvchi ASDU manzili" error={errors.register_code?.message} {...register('register_code')} />
          <Input label="Signal nomi" required mono placeholder="Ia" hint="Mashinacha nom (harf, raqam, _)" error={errors.signal_name?.message} {...register('signal_name')} />
        </div>
        <Input label="O'zbek nomi" placeholder="Tok A fazasi" error={errors.signal_title?.message} {...register('signal_title')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Birlik" placeholder="A" mono {...register('unit')} />
          <Select label="Tur" required options={[{ value: 'float', label: 'Float — o\'lchov (A, kV, MW...)' }, { value: 'status', label: 'Status — holat (0/1)' }]} {...register('value_type')} />
        </div>
      </form>
    )
  }

  const footer = (onClose: () => void, isPending: boolean) => (
    <><Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
      <Button variant="primary" form="model-signal-form" type="submit" loading={isPending}>Saqlash</Button></>
  )

  return (
    <div className="p-6 flex flex-col gap-6">
      <motion.div className="flex items-center justify-between" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />} onClick={() => navigate('/models')} />
          <div>
            <h1 className="text-[20px] font-semibold text-[var(--text)]">{modelPage?.name ?? 'Model'} — Signal Kataloqi</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
              {total} ta signal · Bu signallar barcha {modelPage?.name} qurilmalariga qo'llaniladi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.9, x: 8 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 8 }}>
                <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setBulkDel(true)}>{selected.size} ta o'chirish</Button>
              </motion.div>
            )}
          </AnimatePresence>
          {total > 0 && (
            <Button variant="secondary" icon={<CheckCircle2 size={14} />} loading={applyAll.isPending} onClick={() => applyAll.mutate()}
              title={`Barcha ${modelPage?.name} qurilmalariga ${total} ta signalni qo'llash`}>
              Barcha qurilmalarga qo'lla
            </Button>
          )}
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>Signal qo'shish</Button>
        </div>
      </motion.div>

      {total === 0 && !isLoading && (
        <motion.div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="w-12 h-12 rounded-xl bg-[var(--brand-bg)] flex items-center justify-center mx-auto mb-3">
            <Zap size={20} className="text-[var(--brand)]" />
          </div>
          <p className="text-[14px] font-medium text-[var(--text)] mb-1">Katalog bo'sh</p>
          <p className="text-[13px] text-[var(--text-secondary)] max-w-sm mx-auto">
            Signal qo'shing. Keyin "Barcha qurilmalarga qo'lla" tugmasi orqali barcha {modelPage?.name} qurilmalariga bir vaqtda nusxalanadi.
          </p>
        </motion.div>
      )}

      <DataTable
        columns={columns} data={allItems} isLoading={isLoading}
        onEdit={setEdit} onDelete={setDel} emptyText=""
        selectable selectedIds={selected} onSelectionChange={setSelected}
        hasMore={hasNextPage} onLoadMore={fetchNextPage} isLoadingMore={isFetchingNextPage} total={total}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Yangi signal (katalog)" size="md" footer={footer(() => setOpen(false), create.isPending)}>
        <SignalForm onSubmit={d => create.mutate(d)} />
      </Modal>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Signalni tahrirlash" size="md" footer={footer(() => setEdit(null), update.isPending)}>
        {edit && <SignalForm defaultValues={edit as any} onSubmit={d => update.mutate({ id: edit.id, data: d })} />}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending}
        title="Signalni o'chirish" message={<p><code className="mono">{del?.signal_name}</code> (IOA: {del?.register_code}) ni katalogdan o'chirmoqchimisiz?</p>} />
      <ConfirmDialog open={bulkDel} onClose={() => setBulkDel(false)} variant="danger"
        title="Signallarni katalogdan o'chirish"
        message={<div className="flex flex-col gap-4">
          <p className="text-[13px] text-[var(--text)]">Qaysi signallarni o'chirmoqchisiz?</p>
          <div className="space-y-2">
            <button
              onClick={() => bulkRemove.mutate([...selected])}
              disabled={bulkRemove.isPending || deleteAll.isPending}
              className="w-full px-3 py-2 text-left text-[13px] rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-[var(--text)]">Sahifadagilarni o'chirish</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1">{selected.size} ta signal (faqat yuklanganlari)</div>
            </button>
            <button
              onClick={() => deleteAll.mutate()}
              disabled={bulkRemove.isPending || deleteAll.isPending}
              className="w-full px-3 py-2 text-left text-[13px] rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)]/20 hover:bg-[var(--danger-bg)]/40 transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-[var(--danger)]">🗑 Barchasini katalogdan o'chirish</div>
              <div className="text-[11px] text-[var(--danger)]/70 mt-1">{total} ta signal (hammasini)</div>
            </button>
          </div>
          <div className="p-3 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)]/20 text-[var(--danger)] text-[11px]">
            ⚠ Bu signallar faqat katalogdan o'chadi. Qurilmalardagi mavjud signallarga ta'sir qilmaydi.
          </div>
        </div>} />
    </div>
  )
}

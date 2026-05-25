import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Zap, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { modelApi } from '@/lib/api'
import type { DeviceModel } from '@/types'

const PAGE_SIZE = 10
const schema = z.object({
  name:         z.string().min(1, 'Nom kiriting'),
  manufacturer: z.string().optional(),
})
type Form = z.infer<typeof schema>

const columns: Column<DeviceModel>[] = [
  { key: 'id',   label: '#', width: 'w-12', align: 'center' },
  { key: 'name', label: 'Model nomi', render: row => <span className="font-medium">{row.name}</span> },
  { key: 'manufacturer', label: 'Ishlab chiqaruvchi', render: row => (
    <span className="text-[var(--text-secondary)]">{row.manufacturer ?? '—'}</span>
  )},
  { key: 'signal_count', label: 'Katalog', width: 'w-28', align: 'center', render: row => (
    row.signal_count > 0
      ? <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--brand-bg)] text-[var(--brand)]">
          <Zap size={10} /> {row.signal_count} signal
        </span>
      : <span className="text-[11px] text-[var(--text-tertiary)]">Bo'sh</span>
  )},
]

export function ModelsPage() {
  const queryClient = useQueryClient()
  const navigate    = useNavigate()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<DeviceModel | null>(null)
  const [del,  setDel]  = useState<DeviceModel | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDel, setBulkDel]   = useState(false)

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['models'],
    queryFn: ({ pageParam = 0 }) => modelApi.list(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, _all, lastParam) =>
      lastParam + last.items.length < last.total ? lastParam + last.items.length : undefined,
    staleTime: 30_000,
  })

  const allItems = useMemo(() => data?.pages.flatMap(p => p.items) ?? [], [data])
  const total = data?.pages[0]?.total ?? 0

  const create = useMutation({
    mutationFn: modelApi.create,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['models'] }); toast.success('Model qo\'shildi'); setOpen(false) },
    onError:    (e: Error) => toast.error(e.message),
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Form }) => modelApi.update(id, data),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['models'] }); toast.success('Saqlandi'); setEdit(null) },
    onError:    (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: modelApi.delete,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['models'] }); toast.success('O\'chirildi'); setDel(null) },
    onError:    (e: Error) => toast.error(e.message),
  })
  const bulkRemove = useMutation({
    mutationFn: modelApi.bulkDelete,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['models'] })
      toast.success(`${res.deleted} ta model o'chirildi`)
      setSelected(new Set()); setBulkDel(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const deleteAll = useMutation({
    mutationFn: modelApi.deleteAll,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['models'] })
      toast.success(`Barchasini o'chirildi: ${res.deleted} ta model`)
      setSelected(new Set()); setBulkDel(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function ModelForm({ defaultValues, onSubmit }: { defaultValues?: Form; onSubmit: (d: Form) => void }) {
    const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues })
    return (
      <form id="model-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input label="Model nomi" required placeholder="BMRZ-153" error={errors.name?.message} {...register('name')} />
        <Input label="Ishlab chiqaruvchi" placeholder="EKRA" {...register('manufacturer')} />
      </form>
    )
  }

  const footer = (onClose: () => void, isPending: boolean) => (
    <>
      <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
      <Button variant="primary" form="model-form" type="submit" loading={isPending}>Saqlash</Button>
    </>
  )

  return (
    <div className="p-6 flex flex-col gap-6">
      <motion.div className="flex items-center justify-between" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h1 className="text-[20px] font-semibold text-[var(--text)]">Model Katalogi</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{isLoading ? '...' : `${total} ta model`}</p>
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.9, x: 8 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 8 }}>
                <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setBulkDel(true)}>{selected.size} ta o'chirish</Button>
              </motion.div>
            )}
          </AnimatePresence>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>Model qo'shish</Button>
        </div>
      </motion.div>

      <DataTable
        columns={columns} data={allItems} isLoading={isLoading}
        onEdit={setEdit} onDelete={setDel} emptyText="Model katalogi bo'sh"
        selectable selectedIds={selected} onSelectionChange={setSelected}
        hasMore={hasNextPage} onLoadMore={fetchNextPage} isLoadingMore={isFetchingNextPage} total={total}
        rowActions={row => (
          <Button variant="ghost" size="xs" icon={<Zap size={12} />}
            onClick={e => { e.stopPropagation(); navigate(`/models/${row.id}/signals`) }} title="Signal katalogi" />
        )}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Yangi model" size="sm" footer={footer(() => setOpen(false), create.isPending)}>
        <ModelForm onSubmit={d => create.mutate(d as any)} />
      </Modal>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Model tahrirlash" size="sm" footer={footer(() => setEdit(null), update.isPending)}>
        {edit && <ModelForm defaultValues={{ name: edit.name, manufacturer: edit.manufacturer }} onSubmit={d => update.mutate({ id: edit.id, data: d })} />}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending}
        title="Modelni o'chirish" message={<p><strong>{del?.name}</strong> ni o'chirmoqchimisiz?</p>} />
      <ConfirmDialog open={bulkDel} onClose={() => setBulkDel(false)} variant="danger"
        title="Modellarni o'chirish"
        message={<div className="flex flex-col gap-4">
          <p className="text-[13px] text-[var(--text)]">Qaysi modellarni o'chirmoqchisiz?</p>
          <div className="space-y-2">
            <button
              onClick={() => bulkRemove.mutate([...selected])}
              disabled={bulkRemove.isPending || deleteAll.isPending}
              className="w-full px-3 py-2 text-left text-[13px] rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-[var(--text)]">Sahifadagilarni o'chirish</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1">{selected.size} ta model (faqat yuklanganlari)</div>
            </button>
            <button
              onClick={() => deleteAll.mutate()}
              disabled={bulkRemove.isPending || deleteAll.isPending}
              className="w-full px-3 py-2 text-left text-[13px] rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)]/20 hover:bg-[var(--danger-bg)]/40 transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-[var(--danger)]">🗑 Barchasini bazadan o'chirish</div>
              <div className="text-[11px] text-[var(--danger)]/70 mt-1">{total} ta model (hammasini)</div>
            </button>
          </div>
          <div className="p-3 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)]/20 text-[var(--danger)] text-[11px]">
            ⚠ Modelning signal kataloqlari ham o'chib ketadi.
          </div>
        </div>} />
    </div>
  )
}

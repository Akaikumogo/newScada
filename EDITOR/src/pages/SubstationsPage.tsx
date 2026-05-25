import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Network, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { substationApi, branchApi } from '@/lib/api'
import type { Substation } from '@/types'

const PAGE_SIZE = 10
const schema = z.object({
  name:      z.string().min(1, 'Nom kiriting').max(120),
  branch_id: z.coerce.number().positive('Filial tanlang'),
})
type Form = z.infer<typeof schema>

export function SubstationsPage() {
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const [open,  setOpen]  = useState(false)
  const [edit,  setEdit]  = useState<Substation | null>(null)
  const [del,   setDel]   = useState<Substation | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDel, setBulkDel]   = useState(false)

  const {
    data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['substations'],
    queryFn: ({ pageParam = 0 }) => substationApi.list({ skip: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last, _all, lastParam) =>
      lastParam + last.items.length < last.total ? lastParam + last.items.length : undefined,
    staleTime: 30_000,
  })

  const allItems = useMemo(() => data?.pages.flatMap(p => p.items) ?? [], [data])
  const total = data?.pages[0]?.total ?? 0

  const { data: branchesPage } = useQuery({
    queryKey: ['branches-all'],
    queryFn: () => branchApi.list(0, 0),
    staleTime: 60_000,
  })
  const branches = branchesPage?.items ?? []

  const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]))
  const branchOpts = [{ value: '', label: 'Tanlang...' }, ...branches.map(b => ({ value: b.id, label: b.name }))]

  const columns: Column<Substation>[] = [
    { key: 'id',   label: '#', width: 'w-12', align: 'center' },
    { key: 'name', label: 'Podstansiya', render: row => <span className="font-medium">{row.name}</span> },
    { key: 'branch_id', label: 'Filial', render: row => (
      <span className="text-[var(--text-secondary)]">{branchMap[row.branch_id] ?? '—'}</span>
    )},
  ]

  const create = useMutation({
    mutationFn: substationApi.create,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['substations'] }); toast.success('Qo\'shildi'); setOpen(false) },
    onError:    (e: Error) => toast.error(e.message),
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Form }) => substationApi.update(id, data),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['substations'] }); toast.success('Saqlandi'); setEdit(null) },
    onError:    (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: substationApi.delete,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['substations'] }); toast.success('O\'chirildi'); setDel(null) },
    onError:    (e: Error) => toast.error(e.message),
  })
  const bulkRemove = useMutation({
    mutationFn: substationApi.bulkDelete,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['substations'] })
      toast.success(`${res.deleted} ta podstansiya o'chirildi`)
      setSelected(new Set()); setBulkDel(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const deleteAll = useMutation({
    mutationFn: substationApi.deleteAll,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['substations'] })
      toast.success(`Barchasini o'chirildi: ${res.deleted} ta podstansiya`)
      setSelected(new Set()); setBulkDel(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function SubForm({ defaultValues, onSubmit }: { defaultValues?: Form; onSubmit: (d: Form) => void }) {
    const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues })
    return (
      <form id="sub-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input label="Nomi" required placeholder="Yunusobod PS" error={errors.name?.message} {...register('name')} />
        <Select label="Filial" required options={branchOpts} error={errors.branch_id?.message} {...register('branch_id')} />
      </form>
    )
  }

  const footer = (onClose: () => void, isPending: boolean) => (
    <>
      <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
      <Button variant="primary" form="sub-form" type="submit" loading={isPending}>Saqlash</Button>
    </>
  )

  return (
    <div className="p-6 flex flex-col gap-6">
      <motion.div className="flex items-center justify-between" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h1 className="text-[20px] font-semibold text-[var(--text)]">Podstansiyalar</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{total} ta podstansiya</p>
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.9, x: 8 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 8 }}>
                <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setBulkDel(true)}>{selected.size} ta o'chirish</Button>
              </motion.div>
            )}
          </AnimatePresence>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>Qo'shish</Button>
        </div>
      </motion.div>

      <DataTable
        columns={columns} data={allItems} isLoading={isLoading}
        onEdit={setEdit} onDelete={setDel}
        selectable selectedIds={selected} onSelectionChange={setSelected}
        hasMore={hasNextPage} onLoadMore={fetchNextPage} isLoadingMore={isFetchingNextPage} total={total}
        rowActions={row => (
          <div className="flex gap-1">
            <Button variant="ghost" size="xs" icon={<Network size={12} />} title="Sxema"
              onClick={e => { e.stopPropagation(); navigate(`/substations/${row.id}/schema`) }} />
            <Button variant="ghost" size="xs" onClick={e => { e.stopPropagation(); setEdit(row) }}>✏</Button>
          </div>
        )}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Yangi podstansiya" size="sm" footer={footer(() => setOpen(false), create.isPending)}>
        <SubForm onSubmit={d => create.mutate(d as any)} />
      </Modal>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Tahrirlash" size="sm" footer={footer(() => setEdit(null), update.isPending)}>
        {edit && <SubForm defaultValues={{ name: edit.name, branch_id: edit.branch_id }} onSubmit={d => update.mutate({ id: edit.id, data: d })} />}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending}
        title="O'chirish" message={<p><strong>{del?.name}</strong> ni o'chirmoqchimisiz?</p>} />
      <ConfirmDialog open={bulkDel} onClose={() => setBulkDel(false)} variant="danger"
        title="Podstansiyalarni o'chirish"
        message={<div className="flex flex-col gap-4">
          <p className="text-[13px] text-[var(--text)]">Qaysi podstansiyalarni o'chirmoqchisiz?</p>
          <div className="space-y-2">
            <button
              onClick={() => bulkRemove.mutate([...selected])}
              disabled={bulkRemove.isPending || deleteAll.isPending}
              className="w-full px-3 py-2 text-left text-[13px] rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-[var(--text)]">Sahifadagilarni o'chirish</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1">{selected.size} ta podstansiya (faqat yuklanganlari)</div>
            </button>
            <button
              onClick={() => deleteAll.mutate()}
              disabled={bulkRemove.isPending || deleteAll.isPending}
              className="w-full px-3 py-2 text-left text-[13px] rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)]/20 hover:bg-[var(--danger-bg)]/40 transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-[var(--danger)]">🗑 Barchasini bazadan o'chirish</div>
              <div className="text-[11px] text-[var(--danger)]/70 mt-1">{total} ta podstansiya (hammasini)</div>
            </button>
          </div>
          <div className="p-3 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)]/20 text-[var(--danger)] text-[11px]">
            ⚠ Barcha bog'langan qurilmalar va sxemalar ham o'chib ketadi.
          </div>
        </div>} />
    </div>
  )
}

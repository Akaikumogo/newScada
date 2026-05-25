import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, GitBranch, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { branchApi } from '@/lib/api'
import type { Branch } from '@/types'

const PAGE_SIZE = 10
const schema = z.object({ name: z.string().min(1, 'Nom kiriting').max(120) })
type Form    = z.infer<typeof schema>

const columns: Column<Branch>[] = [
  { key: 'id',   label: '#',    width: 'w-12', align: 'center' },
  { key: 'name', label: 'Nomi', render: row => (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-[var(--brand-bg)] flex items-center justify-center">
        <GitBranch size={13} className="text-[var(--brand)]" />
      </div>
      <span className="font-medium">{row.name}</span>
    </div>
  )},
  { key: 'created_at', label: 'Yaratilgan', render: row => (
    <span className="text-[var(--text-secondary)] text-[12px]">
      {new Date(row.created_at).toLocaleDateString('uz-UZ')}
    </span>
  )},
]

export function BranchesPage() {
  const queryClient  = useQueryClient()
  const [open,     setOpen]     = useState(false)
  const [edit,     setEdit]     = useState<Branch | null>(null)
  const [del,      setDel]      = useState<Branch | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDel,  setBulkDel]  = useState(false)

  const {
    data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['branches'],
    queryFn: ({ pageParam = 0 }) => branchApi.list(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, _all, lastParam) =>
      lastParam + last.items.length < last.total ? lastParam + last.items.length : undefined,
    staleTime: 30_000,
  })

  const allItems = useMemo(() => data?.pages.flatMap(p => p.items) ?? [], [data])
  const total = data?.pages[0]?.total ?? 0

  const create = useMutation({
    mutationFn: branchApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['branches'] }); toast.success('Filial qo\'shildi'); setOpen(false) },
    onError: (e: Error) => toast.error(e.message),
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Form }) => branchApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['branches'] }); toast.success('Saqlandi'); setEdit(null) },
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: branchApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['branches'] }); toast.success('O\'chirildi'); setDel(null) },
    onError: (e: Error) => toast.error(e.message),
  })
  const bulkRemove = useMutation({
    mutationFn: branchApi.bulkDelete,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast.success(`${res.deleted} ta filial o'chirildi`)
      setSelected(new Set()); setBulkDel(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const deleteAll = useMutation({
    mutationFn: branchApi.deleteAll,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast.success(`Barchasini o'chirildi: ${res.deleted} ta filial`)
      setSelected(new Set()); setBulkDel(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function BranchForm({ defaultValues, onSubmit }: { defaultValues?: Form; onSubmit: (d: Form) => void }) {
    const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues })
    return (
      <form id="branch-form" onSubmit={handleSubmit(onSubmit)}>
        <Input label="Filial nomi" required placeholder="Yunusobod filiali" error={errors.name?.message} {...register('name')} />
      </form>
    )
  }

  const footer = (onClose: () => void, isPending: boolean) => (
    <>
      <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
      <Button variant="primary" form="branch-form" type="submit" loading={isPending}>Saqlash</Button>
    </>
  )

  return (
    <div className="p-6 flex flex-col gap-6">
      <motion.div className="flex items-center justify-between" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h1 className="text-[20px] font-semibold text-[var(--text)]">Filiallar</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            {isLoading ? '...' : `${total} ta filial`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.9, x: 8 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 8 }}>
                <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setBulkDel(true)}>
                  {selected.size} ta o'chirish
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>Filial qo'shish</Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <DataTable
          columns={columns}
          data={allItems}
          isLoading={isLoading}
          onEdit={setEdit}
          onDelete={setDel}
          emptyText="Filiallar yo'q"
          selectable
          selectedIds={selected}
          onSelectionChange={setSelected}
          hasMore={hasNextPage}
          onLoadMore={fetchNextPage}
          isLoadingMore={isFetchingNextPage}
          total={total}
        />
      </motion.div>

      <Modal open={open} onClose={() => setOpen(false)} title="Yangi filial" size="sm" footer={footer(() => setOpen(false), create.isPending)}>
        <BranchForm onSubmit={d => create.mutate(d)} />
      </Modal>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Filialini tahrirlash" size="sm" footer={footer(() => setEdit(null), update.isPending)}>
        {edit && <BranchForm defaultValues={{ name: edit.name }} onSubmit={d => update.mutate({ id: edit.id, data: d })} />}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending}
        title="Filialni o'chirish" message={<p><strong>{del?.name}</strong> filialni o'chirmoqchimisiz? Barcha podstansiyalari ham o'chadi.</p>} />
      <ConfirmDialog open={bulkDel} onClose={() => setBulkDel(false)} variant="danger"
        title="Filiallarni o'chirish"
        message={<div className="flex flex-col gap-4">
          <p className="text-[13px] text-[var(--text)]">
            Qaysi filiallarni o'chirmoqchisiz?
          </p>
          <div className="space-y-2">
            <button
              onClick={() => bulkRemove.mutate([...selected])}
              disabled={bulkRemove.isPending || deleteAll.isPending}
              className="w-full px-3 py-2 text-left text-[13px] rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-[var(--text)]">Sahifadagilarni o'chirish</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1">{selected.size} ta filial (faqat yuklanganlari)</div>
            </button>
            <button
              onClick={() => deleteAll.mutate()}
              disabled={bulkRemove.isPending || deleteAll.isPending}
              className="w-full px-3 py-2 text-left text-[13px] rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)]/20 hover:bg-[var(--danger-bg)]/40 transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-[var(--danger)]">🗑 Barchasini bazadan o'chirish</div>
              <div className="text-[11px] text-[var(--danger)]/70 mt-1">{total} ta filial (hammasini)</div>
            </button>
          </div>
          <div className="p-3 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)]/20 text-[var(--danger)] text-[11px]">
            ⚠ Barcha bog'langan podstansiyalar va qurilmalar ham o'chib ketadi.
          </div>
        </div>} />
    </div>
  )
}

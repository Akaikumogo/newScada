import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clsx } from 'clsx'
import { Plus, ArrowLeft, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { signalApi, deviceApi } from '@/lib/api'
import type { Signal } from '@/types'

const PAGE_SIZE = 10

const schema = z.object({
  register_code: z.coerce.number().int().positive('IOA kiriting'),
  signal_name:   z.string().min(1).max(64).regex(/^\w+$/, 'Faqat harf, raqam va _ ishlatilsin'),
  signal_title:  z.string().max(160).optional(),
  unit:          z.string().max(24).optional(),
  value_type:    z.enum(['float', 'status']),
  active:        z.boolean().default(false),
  only_realtime: z.boolean().default(false),
})
type Form = z.infer<typeof schema>

/* ── Toggle switch component ──────────────────────────────────── */
function Toggle({
  checked, disabled, onChange, color = 'success',
}: {
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  color?: 'success' | 'brand'
}) {
  const trackOn = color === 'brand' ? 'bg-[var(--brand)]' : 'bg-[var(--success)]'
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150',
        checked ? trackOn : 'bg-[var(--border)]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-90',
      )}
    >
      <span className={clsx(
        'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-150',
        checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
      )} />
    </button>
  )
}

export function SignalsPage() {
  const { id } = useParams<{ id: string }>()
  const deviceId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Signal | null>(null)
  const [del, setDel] = useState<Signal | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDel, setBulkDel] = useState(false)
  const [bulkActiveOpen, setBulkActiveOpen] = useState(false)

  const { data: device } = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => deviceApi.getById(deviceId),
    enabled: !!deviceId,
  })

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['signals', deviceId],
    queryFn: ({ pageParam = 0 }) => signalApi.list(deviceId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, _all, lastParam) =>
      lastParam + last.items.length < last.total ? lastParam + last.items.length : undefined,
    enabled: !!deviceId,
    staleTime: 30_000,
  })

  const allItems = useMemo(() => data?.pages.flatMap(p => p.items) ?? [], [data])
  const total = data?.pages[0]?.total ?? 0

  /* ── Mutations ──────────────────────────────────────────────── */
  const create = useMutation({
    mutationFn: (data: Form) => signalApi.create({ ...data, device_id: deviceId } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signals', deviceId] })
      toast.success('Signal qo\'shildi')
      setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Form }) => signalApi.update(id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signals', deviceId] })
      toast.success('Saqlandi')
      setEdit(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Inline toggle (table row) — directly patches active / only_realtime
  const toggle = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<Signal> }) =>
      signalApi.update(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['signals', deviceId] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: signalApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signals', deviceId] })
      toast.success('O\'chirildi')
      setDel(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkRemove = useMutation({
    mutationFn: signalApi.bulkDelete,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['signals', deviceId] })
      toast.success(`${res.deleted} ta signal o'chirildi`)
      setSelected(new Set())
      setBulkDel(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteAll = useMutation({
    mutationFn: () => signalApi.deleteAll(deviceId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['signals', deviceId] })
      toast.success(`Barchasini o'chirildi: ${res.deleted} ta signal`)
      setSelected(new Set())
      setBulkDel(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkSetActive = useMutation({
    mutationFn: ({ ids, active }: { ids: number[]; active: boolean }) =>
      signalApi.bulkSetActive(ids, active),
    onSuccess: (res, { active }) => {
      queryClient.invalidateQueries({ queryKey: ['signals', deviceId] })
      toast.success(`${res.updated} ta signal ${active ? 'active' : 'active emas'} qilindi`)
      setSelected(new Set())
      setBulkActiveOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const setActiveAll = useMutation({
    mutationFn: (active: boolean) => signalApi.setActiveAll(deviceId, active),
    onSuccess: (res, active) => {
      queryClient.invalidateQueries({ queryKey: ['signals', deviceId] })
      toast.success(`${res.updated} ta signal ${active ? 'active' : 'active emas'} qilindi`)
      setSelected(new Set())
      setBulkActiveOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /* ── Table columns (inside component → access toggle mutation) ─ */
  const columns: Column<Signal>[] = useMemo(() => [
    {
      key: 'register_code', label: 'IOA', align: 'center', width: 'w-20',
      render: row => <span className="mono text-[13px] font-medium">{row.register_code}</span>,
    },
    {
      key: 'signal_name', label: 'Signal Name',
      render: row => (
        <code className="mono text-[12px] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded">
          {row.signal_name}
        </code>
      ),
    },
    {
      key: 'signal_title', label: 'Nomi',
      render: row => <span className="text-[var(--text-secondary)]">{row.signal_title ?? '—'}</span>,
    },
    {
      key: 'unit', label: 'Birlik', width: 'w-20', align: 'center',
      render: row => <span className="mono text-[12px]">{row.unit || '—'}</span>,
    },
    {
      key: 'value_type', label: 'Tur', width: 'w-24',
      render: row => (
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
          row.value_type === 'float'
            ? 'bg-[var(--brand-bg)] text-[var(--brand)]'
            : 'bg-[var(--success-bg)] text-[var(--success)]'
        }`}>
          {row.value_type}
        </span>
      ),
    },
    {
      key: 'active', label: 'Active', width: 'w-24', align: 'center',
      render: row => (
        <div className="flex flex-col items-center gap-0.5">
          <Toggle
            checked={row.active}
            onChange={v => toggle.mutate({
              id: row.id,
              // When activating → force only_realtime=false
              updates: v ? { active: true, only_realtime: false } : { active: false },
            })}
          />
          {row.active && (
            <span className="text-[10px] text-[var(--success)] font-medium">DB</span>
          )}
        </div>
      ),
    },
    {
      key: 'only_realtime', label: 'Only RT', width: 'w-24', align: 'center',
      render: row => (
        <div className="flex flex-col items-center gap-0.5">
          <Toggle
            checked={row.only_realtime}
            disabled={row.active}
            color="brand"
            onChange={v => toggle.mutate({ id: row.id, updates: { only_realtime: v } })}
          />
          {row.only_realtime && !row.active && (
            <span className="text-[10px] text-[var(--brand)] font-medium">RT</span>
          )}
        </div>
      ),
    },
  ], [toggle])

  /* ── Signal form ──────────────────────────────────────────────── */
  function SignalForm({
    defaultValues, onSubmit,
  }: {
    defaultValues?: Partial<Form>
    onSubmit: (d: Form) => void
  }) {
    const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<Form>({
      resolver: zodResolver(schema),
      defaultValues: { value_type: 'float', unit: '', active: false, only_realtime: false, ...defaultValues },
    })

    const isActive = watch('active')

    // When active=true, only_realtime must be false (UI enforces, backend ignores it)
    useEffect(() => {
      if (isActive) setValue('only_realtime', false)
    }, [isActive, setValue])

    return (
      <form id="signal-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="IOA (Register kodi)" required type="number" mono
            placeholder="1000" error={errors.register_code?.message}
            {...register('register_code')}
          />
          <Input
            label="Signal Name" required mono placeholder="Ia"
            hint="Mashinacha nom (harf, _)" error={errors.signal_name?.message}
            {...register('signal_name')}
          />
        </div>
        <Input
          label="Nomi (uzbekcha)" placeholder="Tok A fazasi"
          error={errors.signal_title?.message} {...register('signal_title')}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Birlik" placeholder="A" mono {...register('unit')} />
          <Select
            label="Tur" required
            options={[
              { value: 'float',  label: 'Float (o\'lchov)' },
              { value: 'status', label: 'Status (holat)' },
            ]}
            {...register('value_type')}
          />
        </div>

        {/* ── Toggle switches ──────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[var(--border)]">
          {/* Active */}
          <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
            <Controller
              control={control} name="active"
              render={({ field }) => (
                <Toggle checked={field.value} onChange={field.onChange} />
              )}
            />
            <div>
              <div className="text-[13px] font-medium text-[var(--text)]">Active</div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Ma'lumot yig'iladi va DB ga yoziladi
              </div>
            </div>
          </label>

          {/* Only Realtime — disabled when active=true */}
          <label className={clsx(
            'flex items-center gap-3 select-none p-3 rounded-lg transition-colors',
            isActive ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-[var(--bg-hover)]',
          )}>
            <Controller
              control={control} name="only_realtime"
              render={({ field }) => (
                <Toggle checked={field.value} disabled={isActive} color="brand" onChange={field.onChange} />
              )}
            />
            <div>
              <div className="text-[13px] font-medium text-[var(--text)]">Only Realtime</div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Faqat Redis/UI ga (DB saqlanmaydi)
              </div>
            </div>
          </label>
        </div>

        {/* Active holati haqida eslatma */}
        {isActive && (
          <p className="text-[11px] text-[var(--text-secondary)] bg-[var(--success-bg)] border border-[var(--success)]/20 rounded-lg px-3 py-2">
            Active rejimda Only Realtime o'chirib qo'yiladi — ma'lumot to'liq yig'iladi va tarixga yoziladi.
          </p>
        )}
      </form>
    )
  }

  const footer = (onClose: () => void, isPending: boolean) => (
    <>
      <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
      <Button variant="primary" form="signal-form" type="submit" loading={isPending}>Saqlash</Button>
    </>
  )

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="p-6 flex flex-col gap-6">
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />} onClick={() => navigate('/devices')} />
          <div>
            <h1 className="text-[20px] font-semibold text-[var(--text)]">
              {device?.name ?? 'Qurilma'} — Signallar
            </h1>
            {device && (
              <code className="text-[11px] mono text-[var(--text-secondary)]">
                {device.iec104_host}:{device.iec104_port} · CASDU {device.iec104_common_address} · {total} ta signal
              </code>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0, scale: 0.9, x: 8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 8 }}
              >
                <Button variant="secondary" size="sm" icon={<Zap size={13} />} onClick={() => setBulkActiveOpen(true)}>
                  {selected.size} ta active
                </Button>
                <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setBulkDel(true)}>
                  {selected.size} ta o'chirish
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
            Signal qo'shish
          </Button>
        </div>
      </motion.div>

      <DataTable
        columns={columns} data={allItems} isLoading={isLoading}
        onEdit={setEdit} onDelete={setDel} emptyText="Signallar yo'q"
        selectable selectedIds={selected} onSelectionChange={setSelected}
        hasMore={hasNextPage} onLoadMore={fetchNextPage} isLoadingMore={isFetchingNextPage}
        total={total}
      />

      {/* Create modal */}
      <Modal
        open={open} onClose={() => setOpen(false)}
        title="Yangi signal" size="md"
        footer={footer(() => setOpen(false), create.isPending)}
      >
        <SignalForm onSubmit={d => create.mutate(d)} />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!edit} onClose={() => setEdit(null)}
        title="Signalni tahrirlash" size="md"
        footer={footer(() => setEdit(null), update.isPending)}
      >
        {edit && <SignalForm defaultValues={edit as any} onSubmit={d => update.mutate({ id: edit.id, data: d })} />}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!del} onClose={() => setDel(null)}
        onConfirm={() => del && remove.mutate(del.id)}
        loading={remove.isPending}
        title="Signalni o'chirish"
        message={<p>IOA <code className="mono">{del?.register_code}</code> signalni o'chirmoqchimisiz?</p>}
      />

      {/* Bulk active confirm */}
      <ConfirmDialog
        open={bulkActiveOpen} onClose={() => setBulkActiveOpen(false)}
        title="Active holatini o'zgartirish"
        message={
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-[var(--text)]">Qaysi signallarni o'zgartirmoqchisiz?</p>
            <div className="space-y-2">
              <button
                onClick={() => bulkSetActive.mutate({ ids: [...selected], active: true })}
                disabled={bulkSetActive.isPending || setActiveAll.isPending}
                className="w-full px-3 py-2 text-left text-[13px] rounded-lg border border-[var(--success)]/30 bg-[var(--success-bg)]/20 hover:bg-[var(--success-bg)]/40 transition-colors disabled:opacity-50"
              >
                <div className="font-medium text-[var(--success)]">⚡ Tanlanganlarni Active qilish</div>
                <div className="text-[11px] text-[var(--success)]/70 mt-1">
                  {selected.size} ta signal — DB ga yoziladi
                </div>
              </button>
              <button
                onClick={() => bulkSetActive.mutate({ ids: [...selected], active: false })}
                disabled={bulkSetActive.isPending || setActiveAll.isPending}
                className="w-full px-3 py-2 text-left text-[13px] rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
              >
                <div className="font-medium text-[var(--text)]">○ Tanlanganlarni Active emas qilish</div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                  {selected.size} ta signal — polling to'xtatiladi
                </div>
              </button>
            </div>
            <div className="border-t border-[var(--border)] pt-3 space-y-2">
              <p className="text-[11px] text-[var(--text-secondary)]">Yoki barcha {total} ta signal uchun:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveAll.mutate(true)}
                  disabled={bulkSetActive.isPending || setActiveAll.isPending}
                  className="flex-1 px-3 py-2 text-center text-[12px] rounded-lg border border-[var(--success)]/20 bg-[var(--success-bg)]/10 hover:bg-[var(--success-bg)]/25 transition-colors disabled:opacity-50 font-medium text-[var(--success)]"
                >
                  ⚡ Barchasini Active
                </button>
                <button
                  onClick={() => setActiveAll.mutate(false)}
                  disabled={bulkSetActive.isPending || setActiveAll.isPending}
                  className="flex-1 px-3 py-2 text-center text-[12px] rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50 font-medium text-[var(--text-secondary)]"
                >
                  ○ Barchasini Active emas
                </button>
              </div>
            </div>
          </div>
        }
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={bulkDel} onClose={() => setBulkDel(false)} variant="danger"
        title="Signallarni o'chirish"
        message={
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-[var(--text)]">Qaysi signallarni o'chirmoqchisiz?</p>
            <div className="space-y-2">
              <button
                onClick={() => bulkRemove.mutate([...selected])}
                disabled={bulkRemove.isPending || deleteAll.isPending}
                className="w-full px-3 py-2 text-left text-[13px] rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
              >
                <div className="font-medium text-[var(--text)]">Sahifadagilarni o'chirish</div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                  {selected.size} ta signal (faqat yuklanganlari)
                </div>
              </button>
              <button
                onClick={() => deleteAll.mutate()}
                disabled={bulkRemove.isPending || deleteAll.isPending}
                className="w-full px-3 py-2 text-left text-[13px] rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)]/20 hover:bg-[var(--danger-bg)]/40 transition-colors disabled:opacity-50"
              >
                <div className="font-medium text-[var(--danger)]">🗑 Barchasini bazadan o'chirish</div>
                <div className="text-[11px] text-[var(--danger)]/70 mt-1">{total} ta signal (hammasini)</div>
              </button>
            </div>
            <div className="p-3 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)]/20 text-[var(--danger)] text-[11px]">
              ⚠ Signallar va ularning tarixiy yozuvlari ham o'chib ketadi.
            </div>
          </div>
        }
      />
    </div>
  )
}

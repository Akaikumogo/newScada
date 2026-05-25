import { useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Trash2, ChevronUp, ChevronDown, CheckSquare, Square, MinusSquare, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

export interface Column<T> {
  key:       keyof T | string
  label:     string
  width?:    string
  align?:    'left' | 'right' | 'center'
  render?:   (row: T) => React.ReactNode
  sortable?: boolean
}

interface DataTableProps<T extends { id: number }> {
  columns:    Column<T>[]
  data:       T[]
  isLoading?: boolean
  onEdit?:    (row: T) => void
  onDelete?:  (row: T) => void
  onRowClick?:(row: T) => void
  rowActions? :(row: T) => React.ReactNode
  emptyText?: string
  sortKey?:   string
  sortDir?:   'asc' | 'desc'
  onSort?:    (key: string) => void
  // Bulk selection
  selectable?:     boolean
  selectedIds?:    Set<number>
  onSelectionChange?: (ids: Set<number>) => void
  // Infinite scroll
  hasMore?:        boolean
  onLoadMore?:     () => void
  isLoadingMore?:  boolean
  total?:          number
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-[var(--border)]">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className={`skeleton h-4 rounded ${j === 0 ? 'w-8' : 'w-full'}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function DataTable<T extends { id: number }>({
  columns, data, isLoading, onEdit, onDelete, onRowClick,
  rowActions, emptyText = 'Ma\'lumot yo\'q', sortKey, sortDir, onSort,
  selectable, selectedIds, onSelectionChange,
  hasMore, onLoadMore, isLoadingMore, total,
}: DataTableProps<T>) {
  const hasActions = !!(onEdit || onDelete || rowActions)
  const totalCols  = columns.length + (hasActions ? 1 : 0) + (selectable ? 1 : 0)

  // Selection helpers
  const allSelected = selectable && data.length > 0 && data.every(r => selectedIds?.has(r.id))
  const someSelected = selectable && data.some(r => selectedIds?.has(r.id))

  const toggleAll = useCallback(() => {
    if (!onSelectionChange) return
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(data.map(r => r.id)))
    }
  }, [allSelected, data, onSelectionChange])

  const toggleRow = useCallback((id: number) => {
    if (!onSelectionChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }, [selectedIds, onSelectionChange])

  // Infinite scroll — intersection observer
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!hasMore || !onLoadMore) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoadingMore) {
          onLoadMore()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore, isLoadingMore])

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Head */}
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-hover)]">
              {selectable && (
                <th className="w-10 px-3 py-2.5 text-center">
                  <button
                    onClick={toggleAll}
                    className="inline-flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--brand)] transition-colors"
                  >
                    {allSelected ? (
                      <CheckSquare size={15} className="text-[var(--brand)]" />
                    ) : someSelected ? (
                      <MinusSquare size={15} className="text-[var(--brand)]" />
                    ) : (
                      <Square size={15} />
                    )}
                  </button>
                </th>
              )}
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className={clsx(
                    'px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] select-none',
                    col.align === 'right'  && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.sortable && 'cursor-pointer hover:text-[var(--text)] transition-colors',
                    col.width,
                  )}
                  onClick={() => col.sortable && onSort?.(String(col.key))}
                >
                  <div className={clsx('flex items-center gap-1', col.align === 'right' && 'justify-end')}>
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc'
                        ? <ChevronUp size={12} />
                        : <ChevronDown size={12} />
                    )}
                  </div>
                </th>
              ))}
              {hasActions && (
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-24">
                  Amallar
                </th>
              )}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {isLoading ? (
              <TableSkeleton cols={totalCols} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={totalCols}>
                  <div className="flex items-center justify-center py-16 text-[13px] text-[var(--text-secondary)]">
                    {emptyText}
                  </div>
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {data.map((row, i) => {
                  const isSelected = selectable && selectedIds?.has(row.id)
                  return (
                    <motion.tr
                      key={row.id}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ delay: Math.min(i, 10) * 0.02, duration: 0.2 }}
                      className={clsx(
                        'border-b border-[var(--border)] last:border-0 group',
                        'transition-colors duration-100',
                        isSelected
                          ? 'bg-[var(--brand-bg)]/40'
                          : onRowClick ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]/60',
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {selectable && (
                        <td className="w-10 px-3 py-2.5 text-center">
                          <button
                            onClick={e => { e.stopPropagation(); toggleRow(row.id) }}
                            className="inline-flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--brand)] transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare size={15} className="text-[var(--brand)]" />
                            ) : (
                              <Square size={15} />
                            )}
                          </button>
                        </td>
                      )}
                      {columns.map(col => (
                        <td
                          key={String(col.key)}
                          className={clsx(
                            'px-4 py-2.5 text-[13px] text-[var(--text)]',
                            col.align === 'right'  && 'text-right',
                            col.align === 'center' && 'text-center',
                          )}
                        >
                          {col.render
                            ? col.render(row)
                            : String((row as any)[col.key] ?? '—')}
                        </td>
                      ))}

                      {hasActions && (
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {rowActions ? rowActions(row) : (
                              <>
                                {onEdit && (
                                  <motion.button
                                    onClick={e => { e.stopPropagation(); onEdit(row) }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--brand)] hover:bg-[var(--brand-bg)] transition-all"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    title="Tahrirlash"
                                  >
                                    <Pencil size={13} />
                                  </motion.button>
                                )}
                                {onDelete && (
                                  <motion.button
                                    onClick={e => { e.stopPropagation(); onDelete(row) }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-all"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    title="O'chirish"
                                  >
                                    <Trash2 size={13} />
                                  </motion.button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>

      {/* Infinite scroll sentinel + footer */}
      {!isLoading && data.length > 0 && (
        <div className="px-4 py-2 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-secondary)]">
            {total != null ? `${data.length} / ${total}` : `${data.length} ta`}
          </span>
          {isLoadingMore && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
              <Loader2 size={12} className="animate-spin" />
              Yuklanmoqda...
            </div>
          )}
        </div>
      )}
      {/* Invisible trigger for IntersectionObserver */}
      {hasMore && <div ref={sentinelRef} className="h-1" />}
    </div>
  )
}

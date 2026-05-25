import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from './Button'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-[520px]',
  lg: 'max-w-[720px]',
  xl: 'max-w-[960px]',
}

interface ModalProps {
  open:       boolean
  onClose:    () => void
  title:      string
  size?:      ModalSize
  children:   React.ReactNode
  footer?:    React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, size = 'md', children, footer, className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            ref={overlayRef}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Modal box */}
          <motion.div
            className={clsx(
              'relative w-full flex flex-col',
              'bg-[var(--bg-card)] rounded-2xl overflow-hidden',
              'shadow-[var(--shadow-modal)]',
              'border border-[var(--border)]',
              'max-h-[90vh]',
              SIZE_CLASSES[size],
              className,
            )}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
              <h2 className="text-[16px] font-semibold text-[var(--text)]">{title}</h2>
              <motion.button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X size={15} />
              </motion.button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto flex-1">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-hover)]/50 flex justify-end gap-2 flex-shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ── Confirm Dialog ──────────────────────────── */
interface ConfirmProps {
  open:     boolean
  onClose:  () => void
  onConfirm?:() => void
  title:    string
  message:  React.ReactNode
  variant?: 'danger' | 'warning'
  loading?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, variant = 'danger', loading }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Bekor qilish</Button>
          {onConfirm && (
            <Button
              variant={variant === 'danger' ? 'danger' : 'secondary'}
              size="sm"
              onClick={onConfirm}
              loading={loading}
            >
              Ha, davom etish
            </Button>
          )}
        </>
      }
    >
      <div className="text-[14px] text-[var(--text-secondary)] leading-relaxed">{message}</div>
    </Modal>
  )
}

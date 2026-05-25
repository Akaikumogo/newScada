import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
type Size    = 'xs' | 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary:   'bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] border-transparent shadow-sm',
  secondary: 'bg-[var(--bg-card)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)]',
  danger:    'bg-[var(--danger)] text-white hover:opacity-90 border-transparent shadow-sm',
  ghost:     'bg-transparent text-[var(--text-secondary)] border-transparent hover:bg-[var(--bg-hover)] hover:text-[var(--text)]',
  outline:   'bg-transparent text-[var(--brand)] border-[var(--brand)]/30 hover:bg-[var(--brand-bg)] hover:border-[var(--brand)]/60',
}

const SIZE: Record<Size, string> = {
  xs: 'h-6   px-2.5 text-[11px] gap-1   rounded-md',
  sm: 'h-7.5 px-3   text-[12px] gap-1.5 rounded-lg',
  md: 'h-9   px-4   text-[13px] gap-2   rounded-lg',
  lg: 'h-11  px-5   text-[14px] gap-2   rounded-xl',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant
  size?:     Size
  loading?:  boolean
  icon?:     React.ReactNode
  iconRight?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, iconRight, children, className, disabled, ...props },
  ref
) {
  const isDisabled = disabled || loading

  return (
    <motion.button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center font-medium border transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/50 focus-visible:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      disabled={isDisabled}
      whileHover={isDisabled ? {} : { scale: 1.01 }}
      whileTap={isDisabled   ? {} : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      {...(props as any)}
    >
      {loading
        ? <Loader2 size={13} className="animate-spin flex-shrink-0" />
        : icon && <span className="flex-shrink-0">{icon}</span>
      }
      {children && <span>{children}</span>}
      {iconRight && !loading && <span className="flex-shrink-0">{iconRight}</span>}
    </motion.button>
  )
})

import { forwardRef } from 'react'
import { clsx } from 'clsx'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'suffix'> {
  label?:    string
  required?: boolean
  error?:    string
  hint?:     string
  mono?:     boolean
  prefix?:   React.ReactNode
  suffix?:   React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, required, error, hint, mono, prefix, suffix, className, ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {prefix && (
          <div className="absolute left-3 text-[var(--text-tertiary)] pointer-events-none">
            {prefix}
          </div>
        )}

        <input
          ref={ref}
          className={clsx(
            'form-input',
            mono && 'font-mono text-[13px]',
            prefix && 'pl-8',
            suffix && 'pr-8',
            error && 'error',
            className,
          )}
          {...props}
        />

        {suffix && (
          <div className="absolute right-3 text-[var(--text-tertiary)] pointer-events-none">
            {suffix}
          </div>
        )}
      </div>

      {hint && !error && (
        <p className="text-[11px] text-[var(--text-tertiary)]">{hint}</p>
      )}
      {error && (
        <p className="text-[11px] text-[var(--danger)] flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  )
})

/* ── Select ────────────────────────────────────── */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?:   string
  required?: boolean
  error?:   string
  hint?:    string
  options:  { value: string | number; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, required, error, hint, options, className, ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
        </label>
      )}

      <select
        ref={ref}
        className={clsx(
          'form-input appearance-none cursor-pointer',
          error && 'error',
          className,
        )}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {hint && !error && <p className="text-[11px] text-[var(--text-tertiary)]">{hint}</p>}
      {error && <p className="text-[11px] text-[var(--danger)]">⚠ {error}</p>}
    </div>
  )
})

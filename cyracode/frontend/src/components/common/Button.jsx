import { Loader2 } from 'lucide-react'

const variants = {
  primary:
    'bg-primary hover:bg-primary-dark active:scale-[0.98] text-white shadow-sm',
  secondary:
    'bg-white hover:bg-slate-50 active:scale-[0.98] text-ink border border-border shadow-sm',
  outline:
    'border border-primary/40 text-primary hover:bg-primary-light active:scale-[0.98] bg-transparent',
  ghost:
    'text-muted hover:text-ink hover:bg-slate-100 active:scale-[0.98] bg-transparent',
  danger:
    'bg-red-500 hover:bg-red-600 active:scale-[0.98] text-white shadow-sm',
}

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  type = 'button',
  size = 'md',
  className = '',
  ...props
}) {
  const isDisabled = disabled || loading

  const sizes = {
    sm: 'py-1.5 px-3 text-sm',
    md: 'py-2.5 px-5 text-sm',
    lg: 'py-3 px-6 text-base',
  }

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`btn ${sizes[size]} ${variants[variant]} font-medium
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}

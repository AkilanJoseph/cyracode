import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function Input({
  label,
  error,
  helperText,
  type = 'text',
  className = '',
  rightIcon,
  id,
  ...props
}) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (show ? 'text' : 'password') : type
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
  const errorId = inputId ? `${inputId}-error` : undefined
  const helperId = inputId ? `${inputId}-helper` : undefined
  const describedBy = error ? errorId : helperText ? helperId : undefined

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type={inputType}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={`w-full px-3.5 py-2.5 text-sm border rounded-xl outline-none
            transition-all duration-150 text-ink placeholder-slate-400
            focus:ring-2 focus:ring-primary/20 focus:border-primary
            ${props.disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}
            ${error
              ? 'border-red-400 focus:ring-red-100 focus:border-red-400'
              : 'border-border hover:border-slate-300'
            }
            ${isPassword || rightIcon ? 'pr-10' : ''}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            tabIndex={-1}
          >
            {show ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
          </button>
        )}
        {!isPassword && rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={helperId} className="mt-1.5 text-xs text-muted">{helperText}</p>
      )}
    </div>
  )
}

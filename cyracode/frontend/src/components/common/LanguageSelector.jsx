import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { SUPPORTED_LANGUAGES, applyDirection } from '../../i18n/index'

export default function LanguageSelector({ className = '' }) {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const current = i18n.language?.split('-')[0] || 'en'

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleSelect = (lang) => {
    i18n.changeLanguage(lang)
    applyDirection(lang)
    localStorage.setItem('cyracode_lang', lang)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`} data-testid="language-menu">
      <button
        type="button"
        data-testid="language-button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('language.select')}
        title={t('language.label')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-muted hover:text-ink hover:bg-surface transition-colors cursor-pointer"
      >
        <Globe className="w-4 h-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          data-testid="language-menu-panel"
          role="menu"
          aria-label={t('language.select')}
          className="absolute right-0 top-11 w-44 rounded-2xl border border-border bg-white shadow-modal py-1.5 z-30 max-h-72 overflow-y-auto"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={current === l.code}
              onClick={() => handleSelect(l.code)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                current === l.code ? 'text-primary bg-primary-light/60 font-medium' : 'text-ink hover:bg-surface'
              }`}
            >
              <span>{l.label}</span>
              {current === l.code && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

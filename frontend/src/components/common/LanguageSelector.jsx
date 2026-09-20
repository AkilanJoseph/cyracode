import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { SUPPORTED_LANGUAGES, applyDirection } from '../../i18n/index'

export default function LanguageSelector({ className = '' }) {
  const { i18n, t } = useTranslation()

  const handleChange = (e) => {
    const lang = e.target.value
    i18n.changeLanguage(lang)
    applyDirection(lang)
    localStorage.setItem('cyracode_lang', lang)
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Globe className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
      <select
        value={i18n.language?.split('-')[0] || 'en'}
        onChange={handleChange}
        className="text-xs text-muted bg-transparent outline-none cursor-pointer hover:text-ink transition-colors appearance-none pr-1"
        aria-label={t('language.select')}
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  )
}

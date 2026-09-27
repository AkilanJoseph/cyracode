import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

// The locale files separate the tagline phrases with different comma
// characters: ASCII (",") for most, Arabic (U+060C), fullwidth (U+FF0C) and
// the Japanese ideographic comma (U+3001).
const COMMA = /([,،，、])[ ]*/g

/**
 * Splits a translated tagline into its phrases, keeping the separator that
 * followed each one so each locale can keep its own comma convention.
 *
 * @returns {{ parts: string[], seps: string[] }} `seps[i]` follows `parts[i]`.
 */
export function splitTagline(value) {
  const parts = []
  const seps = []
  if (typeof value !== 'string') return { parts, seps }

  value.split(COMMA).forEach((token, i) => {
    if (i % 2 === 1) seps.push(token)
    else if (token.trim()) parts.push(token.trim())
  })
  return { parts, seps }
}

/**
 * Renders the brand tagline as discrete comma-separated phrases.
 *
 * Each phrase is an inline-block so it never breaks across two lines, while
 * the phrases themselves wrap onto the next line on narrow viewports. Locales
 * that only translate part of the tagline simply render fewer phrases.
 */
export default function Tagline({ className = '' }) {
  const { t } = useTranslation()
  const raw = t('nav.tagline')
  const { parts, seps } = splitTagline(raw)

  if (parts.length < 2) {
    return <span className={className}>{raw}</span>
  }

  return (
    <span className={className}>
      {parts.map((part, i) => (
        <Fragment key={part}>
          <span className="inline-block">
            {part}
            {i < seps.length ? seps[i] : ''}
          </span>
          {/* Explicit space: JSX strips whitespace-only text between elements. */}
          {i < seps.length ? ' ' : ''}
        </Fragment>
      ))}
    </span>
  )
}

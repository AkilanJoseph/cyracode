import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

// The locale files separate the tagline phrases with different comma
// characters: ASCII (",") for most, Arabic (U+060C), fullwidth (U+FF0C) and
// the Japanese ideographic comma (U+3001). They also differ in whether a
// space follows: "a, b" but "a、b" and "a，b". Both are captured from the
// source so the rendering matches how the translation was actually written.
const COMMA = /([^,،，、]*)([,،，、])([ ]?)/g

/**
 * Splits a translated tagline into its phrases, keeping the separator that
 * followed each one.
 *
 * @returns {{ parts: string[], seps: {char: string, space: string}[] }}
 *   `seps[i]` is the punctuation following `parts[i]`, and is one shorter
 *   than `parts`.
 */
export function splitTagline(value) {
  const parts = []
  const seps = []
  if (typeof value !== 'string') return { parts, seps }

  // matchAll() clones the regex, so the module-level pattern is never mutated
  // and repeated calls cannot leak `lastIndex` into each other.
  const matches = [...value.matchAll(COMMA)]
  for (const match of matches) {
    const phrase = match[1].trim()
    if (phrase) {
      parts.push(phrase)
      seps.push({ char: match[2], space: match[3] })
    }
  }

  const last = matches[matches.length - 1]
  const tail = (last ? value.slice(last.index + last[0].length) : value).trim()
  if (tail) parts.push(tail)

  return { parts, seps }
}

/**
 * Renders the brand tagline as discrete comma-separated phrases.
 *
 * `layout="inline"` keeps the phrases flowing on one line, used by the scrolling
 * dashboard ticker. `layout="stacked"` puts each phrase on its own line, used
 * wherever the tagline sits under the brand in a narrow column, so the phrases
 * never share a line at some viewport widths and each have their own at others.
 *
 * Locales that only translate part of the tagline simply render fewer phrases.
 */
export default function Tagline({ className = '', layout = 'inline' }) {
  const { t } = useTranslation()
  const raw = t('nav.tagline')
  const { parts, seps } = splitTagline(raw)

  if (parts.length < 2) {
    return <span className={className}>{raw}</span>
  }

  if (layout === 'stacked') {
    return (
      <span className={className}>
        {parts.map((part, i) => (
          // Each phrase its own line, keeping the punctuation the translation
          // used so the wording still reads as written.
          <span key={part} className="block">
            {part}
            {seps[i] ? seps[i].char : ''}
          </span>
        ))}
      </span>
    )
  }

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const sep = seps[i]
        return (
          <Fragment key={part}>
            <span className="inline-block">
              {part}
              {sep ? sep.char : ''}
            </span>
            {/* Only the spacing the translation itself used, so "a、b" does not
                gain a stray space while "a, b" keeps one. */}
            {sep ? sep.space : ''}
          </Fragment>
        )
      })}
    </span>
  )
}

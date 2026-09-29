import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeDiff, LOCALES_DIR, REFERENCE_LOCALE } from './i18n-parity.mjs'

const en = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, REFERENCE_LOCALE), 'utf8')).translation

function get(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

function escapeCell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

/** Interpolation tokens like {{name}} or {count} that must survive translation. */
function placeholders(s) {
  return [...String(s).matchAll(/\{\{?\s*([\w.]+)\s*\}?\}/g)].map((m) => m[1])
}

// Namespaces that need a wording decision rather than a literal gloss, so the
// reviewer spends their attention where it matters.
const NOTES = {
  register:
    'Customer-facing. Tone should match the rest of the register flow, which uses short imperative labels. Keep any units/abbreviations as-is.',
  dashboard: 'Count/plural strings are already keyed per variant — translate each row, do not merge them.',
  confirmation: 'Shown after a successful purchase. Keep it warm but brief.',
  forgot: 'Error and status copy. Keep register formal; the rest of the app is informal.',
  errors: 'Validation messages. Prefer what the user should do next over what went wrong.',
  landing: 'Marketing copy on the public page. Longest strings in the set — check they fit the layout.',
  common: 'Shared chrome, appears in the header/footer of every page.',
  nav: 'Navigation labels, often width-constrained in the header.',
  reset: 'Password reset.',
}

const diffs = computeDiff()
const HERE = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(HERE, '../../i18n/worksheets')
fs.mkdirSync(outDir, { recursive: true })

const LABEL = {
  ar: 'Arabic', de: 'German', es: 'Spanish', fr: 'French', hi: 'Hindi',
  ja: 'Japanese', pt: 'Portuguese', ru: 'Russian', ta: 'Tamil', zh: 'Chinese',
}

let total = 0
for (const { locale, missing } of diffs) {
  if (!missing.length) continue
  total += missing.length

  const byNs = {}
  for (const key of missing) {
    const ns = key.split('.')[0]
    ;(byNs[ns] ||= []).push(key)
  }

  const lines = [
    `# ${locale}.json — translation worksheet`,
    '',
    `Language: **${LABEL[locale] ?? locale}** · Missing keys: **${missing.length}**`,
    '',
    'Fill in the `Translation` column and hand the file back. Do not edit the `Key` or',
    '`English source` columns. Leave a row blank to skip it; blanks fall back to English',
    'at runtime, so skipping is safe and non-blocking.',
    '',
    '## Rules',
    '',
    '- **Keep every `{{placeholder}}` exactly as written.** These are substituted at runtime;',
    '  renaming or dropping one shows the user a raw placeholder.',
    '- Do not translate text that is a product name, code, or unit (`CyraCode`, `API`, `UPI`, `km`).',
    '- Preserve the trailing `?` / `!` / `:` style of the English source where the language uses them.',
    '- Do not add HTML tags or line breaks unless the English source has them.',
    '- One variant per row: if the English source is keyed per plural or per variant,',
    '  translate each row separately rather than reusing a single translation.',
    '',
  ]

  for (const [ns, keys] of Object.entries(byNs)) {
    lines.push(`## \`${ns}\``, '')
    if (NOTES[ns]) lines.push(`> ${NOTES[ns]}`, '')
    lines.push('| Key | English source | Placeholders | Translation |')
    lines.push('|---|---|---|---|')
    for (const key of keys) {
      const src = get(en, key) ?? ''
      const ph = placeholders(src)
      lines.push(
        `| \`${key}\` | ${escapeCell(src)} | ${ph.length ? ph.map((p) => `\`{{${p}}}\``).join(' ') : '—'} | |`
      )
    }
    lines.push('')
  }

  fs.writeFileSync(path.join(outDir, `${locale}.md`), lines.join('\n'), 'utf8')
  console.log(`${locale.padEnd(4)} ${String(missing.length).padStart(3)} keys -> worksheets/${locale}.md`)
}

console.log(`\n${total} rows across ${diffs.filter((d) => d.missing.length).length} worksheets in cyracode/i18n/worksheets/`)

/**
 * Apply a filled-in translation worksheet back into a locale file.
 *
 *   node scripts/apply-i18n-worksheet.mjs ar i18n/worksheets/ar.md
 *   node scripts/apply-i18n-worksheet.mjs ar i18n/worksheets/ar.md --dry-run
 *
 * Blank Translation cells are skipped, so a partially finished worksheet is
 * safe to apply. Every translation is checked to carry the same interpolation
 * placeholders as the English source; a mismatch is rejected rather than
 * written, because a dropped `{{code}}` would render literally in the UI.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCALES_DIR, REFERENCE_LOCALE } from './i18n-parity.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const [, , localeArg, sheetArg, ...flags] = process.argv

if (!localeArg || !sheetArg) {
  console.error('usage: node scripts/apply-i18n-worksheet.mjs <locale> <worksheet.md> [--dry-run]')
  process.exit(1)
}

const dryRun = flags.includes('--dry-run')
const locale = localeArg
const sheetPath = path.resolve(process.cwd(), sheetArg)
const localePath = path.join(LOCALES_DIR, `${locale}.json`)

if (!fs.existsSync(sheetPath)) {
  console.error(`No worksheet at ${sheetPath}`)
  process.exit(1)
}
if (!fs.existsSync(localePath)) {
  console.error(`No locale file at ${localePath}. Is "${locale}" a supported language?`)
  process.exit(1)
}

const en = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, REFERENCE_LOCALE), 'utf8')).translation
const original = fs.readFileSync(localePath, 'utf8')
const before = JSON.parse(original).translation

const get = (o, dotted) => dotted.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), o)
const placeholders = (s) =>
  [...String(s).matchAll(/\{\{?\s*([\w.]+)\s*\}?\}/g)].map((m) => m[1]).sort()

/** Split a markdown table row into trimmed cells, honouring escaped pipes. */
function cells(line) {
  return line
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'))
}

// Parse the worksheet table rows: | `key` | english | placeholders | translation |
const rows = []
let inTable = false
for (const line of fs.readFileSync(sheetPath, 'utf8').split(/\r?\n/)) {
  if (/^\|\s*Key\s*\|/.test(line)) {
    inTable = true
    continue
  }
  if (!inTable) continue
  if (!line.startsWith('|')) {
    inTable = false
    continue
  }
  if (/^\|\s*-{2,}/.test(line)) continue

  const [keyCell, , , translationCell = ''] = cells(line)
  const key = keyCell.replace(/^`|`$/g, '')
  if (!key || !key.includes('.')) continue
  rows.push({ key, translation: translationCell })
}

const applied = []
const skipped = []
const problems = []

for (const { key, translation } of rows) {
  if (!translation) {
    skipped.push(key)
    continue
  }

  const source = get(en, key)
  if (source === undefined) {
    problems.push(`${key}: not in en.json, so this key should not be translated`)
    continue
  }

  const want = placeholders(source)
  const got = placeholders(translation)
  if (want.join(',') !== got.join(',')) {
    problems.push(
      `${key}: placeholder mismatch\n` +
        `      en.json has: ${want.map((p) => `{{${p}}}`).join(' ') || '(none)'}\n` +
        `      worksheet:  ${got.map((p) => `{{${p}}}`).join(' ') || '(none)'}`
    )
    continue
  }

  applied.push({ key, translation })
}

console.log(`${locale}: ${applied.length} to apply, ${skipped.length} blank, ${problems.length} rejected\n`)
if (problems.length) {
  console.log('Rejected (nothing written):')
  for (const p of problems) console.log(`  - ${p}`)
  console.log('')
}

if (!applied.length) {
  console.log('Nothing to apply.')
  process.exit(problems.length ? 1 : 0)
}

// Surgical line edits so CRLF and the hand-formatting in these files survive.
const eol = original.includes('\r\n') ? '\r\n' : '\n'
const lines = original.split(eol)

function setKey(key, value) {
  const [ns, leaf] = [key.slice(0, key.indexOf('.')), key.slice(key.indexOf('.') + 1)]
  const start = lines.findIndex((l) => new RegExp(`^\\s*"${ns}"\\s*:\\s*\\{\\s*$`).test(l))
  if (start === -1) return `no "${ns}" block`
  const end = lines.findIndex((l, i) => i > start && /^\s*\}/.test(l))
  if (end === -1) return `unterminated "${ns}" block`

  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(/^(\s*)"([^"]+)"\s*:/)
    if (m && m[2] === leaf) {
      const hadComma = /,\s*$/.test(lines[i])
      lines[i] = `${m[1]}"${leaf}": ${JSON.stringify(value)}${hadComma ? ',' : ''}`
      return null
    }
  }

  // Key absent: insert as the first property, with a comma since others follow.
  const indent = lines[start].match(/^\s*/)[0] + '  '
  lines.splice(start + 1, 0, `${indent}"${leaf}": ${JSON.stringify(value)},`)
  return null
}

const writeErrors = []
for (const { key, translation } of applied) {
  const err = setKey(key, translation)
  if (err) writeErrors.push(`${key}: ${err}`)
}

if (writeErrors.length) {
  console.log('Could not place (nothing written):')
  for (const e of writeErrors) console.log(`  - ${e}`)
  process.exit(1)
}

const out = lines.join(eol)

// Verify: still valid, and the parsed result matches what we intended.
let after
try {
  after = JSON.parse(out).translation
} catch (e) {
  console.error(`Refusing to write, the result is not valid JSON: ${e.message}`)
  process.exit(1)
}
const wrong = applied.filter(({ key, translation }) => get(after, key) !== translation)
if (wrong.length) {
  console.error('Refusing to write, these did not land as intended:')
  for (const { key } of wrong) console.error(`  - ${key}`)
  process.exit(1)
}

// And that nothing else moved.
const beforeStripped = JSON.parse(JSON.stringify(before))
const afterStripped = JSON.parse(JSON.stringify(after))
for (const { key } of applied) {
  const [ns, leaf] = [key.slice(0, key.indexOf('.')), key.slice(key.indexOf('.') + 1)]
  delete beforeStripped[ns][leaf]
  delete afterStripped[ns][leaf]
}
if (JSON.stringify(beforeStripped) !== JSON.stringify(afterStripped)) {
  console.error('Refusing to write, unrelated keys changed.')
  process.exit(1)
}

for (const { key, translation } of applied) console.log(`  ${key} = ${JSON.stringify(translation)}`)

if (dryRun) {
  console.log('\n--dry-run: no file written.')
} else {
  fs.writeFileSync(localePath, out, 'utf8')
  console.log(`\nWrote ${applied.length} key(s) to ${path.relative(process.cwd(), localePath)}`)
  console.log('Next: npm run i18n:parity   (and npm run i18n:parity:write to re-record the baseline)')
}

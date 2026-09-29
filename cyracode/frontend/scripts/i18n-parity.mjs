/**
 * Locale key-parity report and baseline manager.
 *
 * `en.json` is the source of truth for the key set. The other locales are
 * allowed to lag behind it, but only in ways already recorded in the baseline,
 * so new copy cannot silently ship untranslated in the other 10 languages.
 *
 *   node scripts/i18n-parity.mjs           print the outstanding gap
 *   node scripts/i18n-parity.mjs --write   re-record the baseline (review first)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export const LOCALES_DIR = path.resolve(HERE, '../src/i18n/locales')
export const BASELINE_PATH = path.resolve(
  HERE,
  '../src/__tests__/i18n/locale-parity-baseline.json'
)
export const REFERENCE_LOCALE = 'en.json'

/**
 * Namespaces exempt from parity checking.
 *
 * `admin` is an internal staff console: every /admin/* route is role-gated to
 * `role === 'admin'`, and the admin chrome never renders the language selector.
 * Requiring 2,540 admin strings in ten languages would be noise. Remove this
 * entry if the admin portal is ever meant to be localised.
 */
export const EXEMPT_NAMESPACES = ['admin']

/** Keys under an exempt namespace are ignored by the parity ratchet. */
export function isExempt(key) {
  const ns = key.split('.')[0]
  return EXEMPT_NAMESPACES.includes(ns)
}

/** Flatten a nested translation object to dotted key paths. */
export function flatten(obj, prefix = '') {
  const out = []
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) out.push(...flatten(value, next))
    else out.push(next)
  }
  return out
}

export function localeFiles() {
  return fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json')).sort()
}

function keysFor(file) {
  const raw = fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8')
  return flatten(JSON.parse(raw).translation)
}

/**
 * For every non-reference locale, the keys it is missing relative to the
 * reference and the keys it carries that the reference no longer defines.
 * Exempt namespaces are filtered out.
 */
export function computeDiff() {
  const reference = new Set(keysFor(REFERENCE_LOCALE).filter((k) => !isExempt(k)))
  return localeFiles()
    .filter((f) => f !== REFERENCE_LOCALE)
    .map((file) => {
      const keys = keysFor(file).filter((k) => !isExempt(k))
      const present = new Set(keys)
      return {
        locale: file.replace('.json', ''),
        missing: [...reference].filter((k) => !present.has(k)).sort(),
        extra: keys.filter((k) => !reference.has(k)).sort(),
      }
    })
}

export function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return {}
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
}

export function writeBaseline() {
  const baseline = {}
  for (const { locale, missing, extra } of computeDiff()) {
    baseline[locale] = { missing, extra }
  }
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
  return baseline
}

/** Missing keys grouped by top-level namespace, for scoping translation work. */
export function groupByNamespace(keys) {
  const groups = {}
  for (const key of keys) {
    const ns = key.split('.')[0]
    groups[ns] = (groups[ns] || 0) + 1
  }
  return Object.entries(groups).sort((a, b) => b[1] - a[1])
}

// Only run the CLI when invoked directly, not when imported by the test.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const diffs = computeDiff()
  const totalMissing = diffs.reduce((n, d) => n + d.missing.length, 0)
  const totalExtra = diffs.reduce((n, d) => n + d.extra.length, 0)

  console.log(
    `Outstanding translation debt: ${totalMissing} missing, ${totalExtra} dead keys ` +
      `across ${diffs.length} locales\n`
  )

  for (const { locale, missing, extra } of diffs) {
    console.log(`${locale}  missing ${missing.length}, dead ${extra.length}`)
    if (missing.length) {
      for (const [ns, count] of groupByNamespace(missing)) {
        console.log(`    ${ns.padEnd(14)} ${count}`)
      }
    }
    if (extra.length) console.log(`    dead keys:      ${extra.join(', ')}`)
    console.log('')
  }

  if (process.argv.includes('--write')) {
    writeBaseline()
    console.log(`Baseline written to ${path.relative(process.cwd(), BASELINE_PATH)}`)
  } else if (totalMissing || totalExtra) {
    console.log('Run with --write to re-record the baseline after translating.')
  }
}

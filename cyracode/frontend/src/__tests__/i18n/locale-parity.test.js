import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import baseline from './locale-parity-baseline.json'
import { computeDiff, readBaseline, groupByNamespace } from '../../../scripts/i18n-parity.mjs'

// cyracode/i18n/worksheets, from cyracode/frontend/src/__tests__/i18n
const WORKSHEETS_DIR = path.resolve(__dirname, '../../../../i18n/worksheets')


/**
 * Ratchet, not a wall.
 *
 * The locales are known to lag behind en.json, so this asserts the gap has not
 * *grown* past the recorded baseline. New copy that ships untranslated fails the
 * suite; translating existing debt shrinks the baseline and keeps it passing.
 */
describe('locale key parity', () => {
  const diffs = computeDiff()

  it('has a baseline entry for every locale', () => {
    expect(diffs.map((d) => d.locale).sort()).toEqual(Object.keys(baseline).sort())
  })

  it.each(diffs)('$locale does not fall further behind en.json', ({ locale, missing, extra }) => {
    const allowed = new Set(baseline[locale]?.missing ?? [])

    const newlyMissing = missing.filter((key) => !allowed.has(key))
    expect(
      newlyMissing,
      `${locale} is missing ${newlyMissing.length} key(s) that were not in the baseline. ` +
        `Translate them, or run "node scripts/i18n-parity.mjs" to see the full report.\n` +
        (newlyMissing.length ? `  ${newlyMissing.join('\n  ')}` : '')
    ).toEqual([])
  })

  it.each(diffs)('$locale carries no keys that en.json has dropped', ({ locale, extra }) => {
    expect(
      extra,
      `${locale} defines ${extra.length} key(s) that en.json no longer has, so nothing can ` +
        `translate them. Remove them, or re-add them to en.json if they are still needed.\n` +
        (extra.length ? `  ${extra.join('\n  ')}` : '')
    ).toEqual([])
  })

  it('records the outstanding debt so it is visible, not hidden', () => {
    const owed = diffs.reduce((n, d) => n + d.missing.length, 0)
    // Not an assertion about the debt itself: this pins the reporting to the
    // baseline file, so a regenerated baseline cannot silently drop a locale.
    expect(baseline).toEqual(readBaseline())
    expect(owed).toBeGreaterThanOrEqual(0)

    if (owed) {
      const worst = [...diffs].sort((a, b) => b.missing.length - a.missing.length)[0]
      console.log(
        `i18n debt: ${owed} untranslated key(s). Worst: ${worst.locale} ` +
          `(${worst.missing.length}), by namespace: ` +
          groupByNamespace(worst.missing)
            .map(([ns, n]) => `${ns}=${n}`)
            .join(' ')
      )
    }
  })

  // The worksheets are handed to external native speakers, so a stale one wastes
  // a reviewer's time. Regenerate with: npm run i18n:parity:worksheets
  it.each(diffs)('$locale has a worksheet covering exactly its missing keys', ({ locale, missing }) => {
    const file = path.join(WORKSHEETS_DIR, `${locale}.md`)
    expect(
      fs.existsSync(file),
      `Missing ${path.relative(process.cwd(), file)}. Run npm run i18n:parity:worksheets.`
    ).toBe(true)

    const sheet = fs.readFileSync(file, 'utf8')
    const listed = [...sheet.matchAll(/^\| `([\w.]+)` \|/gm)].map((m) => m[1])
    expect(
      [...listed].sort(),
      `Worksheet for ${locale} is out of date. Run npm run i18n:parity:worksheets.`
    ).toEqual([...missing].sort())
  })
})

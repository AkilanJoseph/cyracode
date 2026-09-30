import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Guards against mojibake: UTF-8 bytes decoded as cp1252/latin1. It has bitten
// this codebase more than once -- PricingPage.jsx carried three corrupted
// literals at once ("\u221E", "\u2014" and a "\u2192" in a comment) that all
// still looked like plausible code in review.
//
// Signature: a lead byte character from the UTF-8 continuation range followed by
// a character that only occurs in the cp1252 remapping. Legitimate accented
// Latin text cannot produce this, because real accents sit at U+00E0+ (above
// the U+0080-U+00BF window) and are always followed by ordinary letters.
const LEAD = '\\u00C2\\u00C3\\u00E2\\u00E3\\u00F0'
const FOLLOW =
  '\\u0080-\\u00BF\\u00A0\\u02C6\\u02DC\\u2013\\u2014\\u2018\\u2019\\u201A\\u201C' +
  '\\u201D\\u201E\\u2020\\u2021\\u2022\\u2026\\u2030\\u2039\\u203A\\u20AC\\u2122'
const MOJIBAKE = new RegExp(`[${LEAD}][${FOLLOW}]`)
const REPLACEMENT_CHAR = String.fromCharCode(0xfffd)

const SRC_DIR = path.resolve(__dirname, '../..')

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, out)
    else if (/\.(js|jsx|json)$/.test(entry.name)) out.push(full)
  }
  return out
}

const FILES = sourceFiles(SRC_DIR)

describe('source encoding', () => {
  it('scans a non-trivial number of files', () => {
    expect(FILES.length).toBeGreaterThan(50)
  })

  it('has no UTF-8-decoded-as-cp1252 sequences', () => {
    const offenders = []
    for (const file of FILES) {
      fs.readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (MOJIBAKE.test(line)) {
            offenders.push(`${path.relative(SRC_DIR, file)}:${i + 1}`)
          }
        })
    }
    expect(
      offenders,
      `Mojibake found (re-encode the file as UTF-8):\n  ${offenders.join('\n  ')}`
    ).toEqual([])
  })

  it('has no U+FFFD replacement characters from earlier lossy edits', () => {
    const offenders = []
    for (const file of FILES) {
      fs.readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (line.includes(REPLACEMENT_CHAR)) {
            offenders.push(`${path.relative(SRC_DIR, file)}:${i + 1}`)
          }
        })
    }
    expect(
      offenders,
      `Replacement characters found -- the original text is unrecoverable without a native speaker:\n  ${offenders.join('\n  ')}`
    ).toEqual([])
  })

  // Proves the guard still detects the shapes it is meant to catch. Built from
  // code points so this file does not trip its own scan.
  it.each([
    ['UTF-8 infinity read as cp1252', '\u00e2\u02c6\u017e'],
    ['UTF-8 em dash read as cp1252', '\u00e2\u20ac\u201d'],
    ['UTF-8 arrow read as cp1252', '\u00e2\u2020\u2019'],
    ['UTF-8 e-acute read as latin1', '\u00c3\u00a9'],
  ])('flags %s', (_label, bad) => {
    expect(MOJIBAKE.test(bad)).toBe(true)
  })

  it.each([
    ['Brazilian Portuguese', 'Localiza\u00e7\u00e3o de precis\u00e3o'],
    ['French', 'Nom de b\u00e2timent'],
    ['Japanese', '\u5e38\u3088\u304f\u3042\u308b\u8cea\u554f'],
    ['Tamil', '\u0b95\u0bc1\u0bb0\u0bc1\u0baa\u0bcd\u0baa\u0bc8'],
    ['Arabic', '\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629'],
    ['Hindi', '\u0905\u0915\u094d\u0938\u093f \u092a\u0942\u093b\u0947 \u091c\u093e\u0924\u0947 \u091c\u093e\u092f\u0947 \u0938\u0935\u093e\u0932'],
  ])('does not flag %s', (_label, good) => {
    expect(MOJIBAKE.test(good)).toBe(false)
  })
})

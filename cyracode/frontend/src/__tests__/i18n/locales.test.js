import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { splitTagline } from '../../components/common/Tagline'

const LOCALES_DIR = path.resolve(__dirname, '../../i18n/locales')
const LOCALES = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json')).sort()

function load(locale) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, locale), 'utf8')).translation
}

describe('locale files', () => {
  it('ships all eleven locales', () => {
    expect(LOCALES).toHaveLength(11)
    expect(LOCALES).toContain('en.json')
  })

  it.each(LOCALES)('%s is valid JSON with a translation root', (locale) => {
    const data = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, locale), 'utf8'))
    expect(typeof data.translation).toBe('object')
    expect(Object.keys(data.translation).length).toBeGreaterThan(0)
  })

  // Every namespace has to sit *inside* `translation`, which is what i18next
  // reads (defaultNS). A namespace parked as a sibling of `translation` is
  // still valid JSON and is identical across all locales, so the parity
  // ratchet passes while every t() call for it renders its raw key.
  it.each(LOCALES)('%s keeps every namespace inside the translation root', (locale) => {
    const data = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, locale), 'utf8'))
    expect(Object.keys(data), `${locale} has namespaces outside "translation"`).toEqual([
      'translation',
    ])
  })

  // The FAQ page builds its category headings from `faq.categories.<id>`, so a
  // missing nested key would render the raw dotted path on screen.
  it.each(LOCALES)('%s translates the FAQ page chrome', (locale) => {
    const { faq } = load(locale)
    expect(typeof faq?.title, `${locale} is missing faq.title`).toBe('string')
    expect(typeof faq?.subtitle, `${locale} is missing faq.subtitle`).toBe('string')
    expect(faq.title).not.toContain('faq.')
    expect(faq.subtitle).not.toContain('{{')

    for (const id of [
      'general',
      'registration',
      'location',
      'manage',
      'account',
      'pricing',
      'payments',
      'billing',
    ]) {
      const heading = faq.categories?.[id]
      expect(typeof heading, `${locale} is missing faq.categories.${id}`).toBe('string')
      expect(heading.length, `${locale} has an empty faq.categories.${id}`).toBeGreaterThan(0)
    }
  })

  // The tagline is rendered as discrete comma-separated phrases, so a locale
  // that drops one silently loses a phrase on screen. Guard the count.
  it.each(LOCALES)('%s translates all three tagline phrases', (locale) => {
    const { parts } = splitTagline(load(locale).nav.tagline)
    expect(parts).toHaveLength(3)
  })

  it.each(LOCALES)('%s has the footer strings the component needs', (locale) => {
    const { footer } = load(locale)
    const required = [
      'product',
      'account',
      'legal',
      'support',
      'queries',
      'contact_us',
      'search',
      'dashboard',
      'manage',
      'orders',
      'privacy',
      'rights_reserved',
      'follow_us',
      'social_x',
      'social_facebook',
      'social_instagram',
      'social_linkedin',
      'social_youtube',
    ]
    required.forEach((key) => {
      expect(typeof footer[key], `${locale} is missing footer.${key}`).toBe('string')
      expect(footer[key].length, `${locale} has an empty footer.${key}`).toBeGreaterThan(0)
    })

    // The address is rendered from SUPPORT_EMAIL as a mailto link, so keeping it
    // out of the copy stops the two from drifting apart.
    expect(footer.queries, `${locale} bakes the address into footer.queries`).not.toContain('@')
    expect(footer.queries, `${locale} has a leftover placeholder`).not.toContain('{{')
  })

  it('resolves every i18n key the app registers', () => {
    const index = fs.readFileSync(path.resolve(__dirname, '../../i18n/index.js'), 'utf8')
    const imported = [...index.matchAll(/locales\/([a-z]{2})\.json/g)].map((m) => m[1]).sort()
    // Guards against a locale file existing that i18next never loads.
    expect(imported).toEqual(LOCALES.map((f) => f.replace('.json', '')))
  })
})

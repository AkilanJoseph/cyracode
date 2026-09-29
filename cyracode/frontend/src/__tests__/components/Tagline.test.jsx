import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Tagline, { splitTagline } from '../../components/common/Tagline'
import i18n from '../../i18n'

describe('splitTagline', () => {
  it('splits the English tagline into three phrases', () => {
    const { parts, seps } = splitTagline('Prime Location, Precious Address, Pride Name')
    expect(parts).toEqual(['Prime Location', 'Precious Address', 'Pride Name'])
    expect(seps).toEqual([
      { char: ',', space: ' ' },
      { char: ',', space: ' ' },
    ])
  })

  it('keeps the locale comma for locales that use their own', () => {
    expect(splitTagline('大切な住所、誇れる名前').seps).toEqual([{ char: '、', space: '' }])
    expect(splitTagline('珍贵地址，自豪之名').seps).toEqual([{ char: '，', space: '' }])
    expect(splitTagline('عنوان ثمين، اسم يفتخر به').seps).toEqual([{ char: '،', space: ' ' }])
  })

  it('records the spacing the translation itself used', () => {
    // Mirrors the source rather than hardcoding a space per locale: a
    // translator who writes "A、 B" gets the space back, one who writes
    // "A、B" does not.
    expect(splitTagline('A, B').seps[0].space).toBe(' ')
    expect(splitTagline('A、B').seps[0].space).toBe('')
    expect(splitTagline('A，B').seps[0].space).toBe('')
    expect(splitTagline('A、 B').seps[0].space).toBe(' ')
  })

  it('tolerates missing or extra whitespace', () => {
    expect(splitTagline('A,B ,  C').parts).toEqual(['A', 'B', 'C'])
  })

  it('handles a single phrase with no separator', () => {
    expect(splitTagline('Just One').parts).toEqual(['Just One'])
    expect(splitTagline('Just One').seps).toEqual([])
  })

  it('handles non-string input without throwing', () => {
    expect(splitTagline(undefined)).toEqual({ parts: [], seps: [] })
  })
})

describe('Tagline', () => {
  // i18n is a shared singleton, so pin the language per test and restore it
  // afterwards rather than letting one test's locale leak into the next file.
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders each phrase as a discrete element', () => {
    const { container } = render(<Tagline />)
    const items = container.querySelectorAll('.inline-block')
    expect(items).toHaveLength(3)
    expect(Array.from(items).map((el) => el.textContent)).toEqual([
      'Prime Location,',
      'Precious Address,',
      'Pride Name',
    ])
  })

  it('separates the phrases with a space so words do not run together', () => {
    const { container } = render(<Tagline />)
    expect(container.textContent).toBe('Prime Location, Precious Address, Pride Name')
  })

  it('does not add a space to locales that do not use one', async () => {
    // Japanese and Chinese do not put a space after the comma. A hardcoded
    // space would render "大切な住所、 誇れる名前" and read as a typo.
    await i18n.changeLanguage('ja')
    const japanese = render(<Tagline />)
    expect(japanese.container.textContent).toBe('優良立地点、大切な住所、誇れる名前')

    await i18n.changeLanguage('zh')
    const chinese = render(<Tagline />)
    expect(chinese.container.textContent).toBe('黄金地段，珍贵地址，自豪之名')
  })

  it('keeps the space for locales that do use one', async () => {
    await i18n.changeLanguage('ar')
    const arabic = render(<Tagline />)
    expect(arabic.container.textContent).toBe('موقع مميز، عنوان ثمين، اسم يفتخر به')
  })

  it('reads as a single sentence to assistive tech', () => {
    const { container } = render(<Tagline />)
    // The phrases are split for wrapping, but no individual label is exposed,
    // so the whole tagline is still announced as one string.
    expect(container.textContent).toBe('Prime Location, Precious Address, Pride Name')
    expect(container.querySelectorAll('[aria-label]')).toHaveLength(0)
  })

  it('forwards the className for layout', () => {
    const { container } = render(<Tagline className="mt-3 text-sm text-muted" />)
    expect(container.firstChild.className).toContain('text-sm')
  })

  describe('layout="stacked"', () => {
    it('puts each phrase on its own line', () => {
      const { container } = render(<Tagline layout="stacked" />)
      const lines = container.querySelectorAll('.block')
      expect(lines).toHaveLength(3)
      expect(Array.from(lines).map((el) => el.textContent)).toEqual([
        'Prime Location,',
        'Precious Address,',
        'Pride Name',
      ])
    })

    it('does not join the lines with the space the inline layout uses', () => {
      // The phrases are on separate lines, so a space between them would be a
      // stray leading space at the start of lines two and three.
      const { container } = render(<Tagline layout="stacked" />)
      expect(container.textContent).toBe('Prime Location,Precious Address,Pride Name')
    })

    it('keeps each locale punctuation and adds no separator space', async () => {
      // Japanese and Chinese use their own comma and put no space after it, so
      // each phrase must stay self-contained on its line.
      await i18n.changeLanguage('ja')
      const japanese = render(<Tagline layout="stacked" />)
      expect(japanese.container.querySelectorAll('.block')).toHaveLength(3)
      expect(japanese.container.textContent).toBe('優良立地点、大切な住所、誇れる名前')

      await i18n.changeLanguage('ar')
      const arabic = render(<Tagline layout="stacked" />)
      expect(arabic.container.querySelectorAll('.block')).toHaveLength(3)
      // Arabic writes a space after its comma inline, but stacked there is no
      // separator to carry one.
      expect(arabic.container.textContent).toBe('موقع مميز،عنوان ثمين،اسم يفتخر به')
    })

    it('defaults to the inline layout when no layout is given', () => {
      const { container } = render(<Tagline />)
      expect(container.querySelectorAll('.block')).toHaveLength(0)
      expect(container.querySelectorAll('.inline-block')).toHaveLength(3)
    })
  })
})

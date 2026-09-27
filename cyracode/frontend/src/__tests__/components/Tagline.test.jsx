import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Tagline, { splitTagline } from '../../components/common/Tagline'

describe('splitTagline', () => {
  it('splits the English tagline into three phrases', () => {
    const { parts, seps } = splitTagline('Prime Location, Precious Address, Pride Name')
    expect(parts).toEqual(['Prime Location', 'Precious Address', 'Pride Name'])
    expect(seps).toEqual([',', ','])
  })

  it('keeps the locale comma for locales that use their own', () => {
    expect(splitTagline('大切な住所、誇れる名前').seps).toEqual(['、'])
    expect(splitTagline('珍贵地址，自豪之名').seps).toEqual(['，'])
    expect(splitTagline('عنوان ثمين، اسم يفتخر به').seps).toEqual(['،'])
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
})

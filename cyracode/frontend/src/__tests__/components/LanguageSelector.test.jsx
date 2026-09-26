import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageSelector from '../../components/common/LanguageSelector'
import i18n, { applyDirection } from '../../i18n'

afterEach(async () => {
  await i18n.changeLanguage('en')
  applyDirection('en')
})

describe('LanguageSelector', () => {
  it('shows only the globe icon, not the language name, by default', () => {
    render(<LanguageSelector />)
    expect(screen.getByTestId('language-button')).toBeInTheDocument()
    expect(screen.queryByTestId('language-menu-panel')).not.toBeInTheDocument()
    expect(screen.queryByText('English')).not.toBeInTheDocument()
  })

  it('exposes a "Languages" hover tooltip', () => {
    render(<LanguageSelector />)
    expect(screen.getByTestId('language-button')).toHaveAttribute('title', 'Languages')
  })

  it('opens the language list on click', async () => {
    const user = userEvent.setup()
    render(<LanguageSelector />)
    await user.click(screen.getByTestId('language-button'))
    const panel = screen.getByTestId('language-menu-panel')
    expect(panel).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: /English/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: /Español/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: /日本語/ })).toBeInTheDocument()
  })

  it('selects a language, updates i18n and closes the menu', async () => {
    const user = userEvent.setup()
    render(<LanguageSelector />)
    await user.click(screen.getByTestId('language-button'))
    await user.click(screen.getByRole('menuitemradio', { name: /Français/ }))
    expect(i18n.language).toBe('fr')
    expect(localStorage.getItem('cyracode_lang')).toBe('fr')
    expect(screen.queryByTestId('language-menu-panel')).not.toBeInTheDocument()
  })

  it('closes the menu on outside click and Escape', async () => {
    const user = userEvent.setup()
    render(<LanguageSelector />)
    await user.click(screen.getByTestId('language-button'))
    expect(screen.getByTestId('language-menu-panel')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('language-menu-panel')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('language-button'))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('language-menu-panel')).not.toBeInTheDocument()
  })
})

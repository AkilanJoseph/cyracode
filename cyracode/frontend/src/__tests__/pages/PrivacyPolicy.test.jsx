import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import { ContactWidgetProvider } from '../../context/ContactWidgetContext'
import PrivacyPolicy from '../../pages/PrivacyPolicy'
import { MARKETING_MAX_WIDTH } from '../../lib/layout'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/privacy']}>
      <ContactWidgetProvider>
        <AuthProvider>
          <PrivacyPolicy />
        </AuthProvider>
      </ContactWidgetProvider>
    </MemoryRouter>
  )
}

// The privacy policy is a public legal page reached from the footer. It used to
// pass `showBack`, which rendered a back arrow with a /dashboard fallback — so a
// signed-out visitor clicking it was sent to the dashboard and bounced to the
// landing page. The arrow is gone; the brand logo stays.
describe('PrivacyPolicy header', () => {
  it('renders no back arrow', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('keeps the brand logo', () => {
    const { container } = renderPage()
    // The footer renders a brand link too, so scope to the header bar.
    const header = container.querySelector('nav')
    const logo = within(header).getByRole('link', { name: 'CyraCode' })
    expect(logo).toBeInTheDocument()
    // Signed-out visitors go back to the landing page, never /dashboard.
    expect(logo.getAttribute('href')).toBe('/')
  })

  // Arriving here from the footer left no way back to Pricing: this page was the
  // only public marketing page not rendering the marketing nav.
  it('keeps the Pricing link in the header', () => {
    const { container } = renderPage()
    const header = container.querySelector('nav')
    const pricing = within(header).getByRole('link', { name: 'Pricing' })
    expect(pricing.getAttribute('href')).toBe('/pricing')
    // The footer also links to Pricing, so confirm we read the header's copy.
    expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Pricing' })).toBeInTheDocument()
  })

  it('does not mark Pricing as the current page', () => {
    const { container } = renderPage()
    const header = container.querySelector('nav')
    // Reachable, but not presented as active while reading the policy.
    expect(within(header).getByRole('link', { name: 'Pricing' }).className).not.toMatch(/bg-primary-light/)
  })
})

describe('PrivacyPolicy frame', () => {
  it('uses the shared marketing width on the header', () => {
    renderPage()
    expect(document.querySelector(`nav .${MARKETING_MAX_WIDTH}`)).toBeInTheDocument()
  })

  it('uses the shared marketing width on the content and footer', () => {
    renderPage()
    const main = document.querySelector('main#main-content')
    expect(main).toHaveClass(MARKETING_MAX_WIDTH)
    expect(screen.getByRole('contentinfo').firstElementChild).toHaveClass(MARKETING_MAX_WIDTH)
  })

  // The skip link rendered by the app shell targets #main-content, so the
  // policy's <main> needs that id to be reachable by keyboard.
  it('exposes the skip-link target', () => {
    renderPage()
    expect(document.querySelector('main#main-content')).toBeInTheDocument()
  })

  it('keeps the policy text in a readable column', () => {
    renderPage()
    const column = document.querySelector('main#main-content > div')
    expect(column).toHaveClass('max-w-3xl', 'mx-auto')
  })
})

describe('PrivacyPolicy content', () => {
  it('states there is no self-service erasure control', () => {
    renderPage()
    expect(
      screen.getByText(/no self-service control for this, so email us/i)
    ).toBeInTheDocument()
    // The old copy pointed at a Settings > Delete Account path that does not exist.
    expect(screen.queryByText(/Settings/i)).not.toBeInTheDocument()
  })

  it('does not promise a fixed anonymisation window', () => {
    renderPage()
    expect(screen.queryByText(/anonymis/i)).not.toBeInTheDocument()
  })
})

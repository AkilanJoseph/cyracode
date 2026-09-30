import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from '../../App'
import { AuthProvider } from '../../context/AuthContext'
import { ContactWidgetProvider } from '../../context/ContactWidgetContext'
import { mockUser } from '../mocks/handlers'

function loginAs(email) {
  localStorage.setItem('cyracode_token', 'mock-token')
  localStorage.setItem('cyracode_user', JSON.stringify({ ...mockUser, email, first_name: 'Test' }))
}

function renderDashboard(email) {
  loginAs(email)
  return render(
    <MemoryRouter>
      <ContactWidgetProvider>
        <AuthProvider>
          <Dashboard />
        </AuthProvider>
      </ContactWidgetProvider>
    </MemoryRouter>
  )
}

describe('Dashboard subscription summary', () => {
  it('shows the active plan when the user has a paid order', async () => {
    renderDashboard('test@example.com')

    expect(await screen.findByText('Your plan')).toBeInTheDocument()
    expect(screen.getByText('Growth')).toBeInTheDocument()
    expect(screen.getByText(/renews on/i)).toBeInTheDocument()
    expect(screen.getByText('Paid by credit card')).toBeInTheDocument()

    // Scoped to the subscription card; the page footer also links to /orders.
    // No email in the query: /orders reads the signed-in account instead.
    const card = screen.getByText('Your plan').closest('section')
    const ordersLink = within(card).getByRole('link', { name: /orders & invoices/i })
    expect(ordersLink.getAttribute('href')).toBe('/orders')
    expect(within(card).getByRole('link', { name: 'Upgrade' })).toBeInTheDocument()
  })

  it('shows a plan prompt when the user has no orders', async () => {
    renderDashboard('nobody@example.com')

    expect(await screen.findByText('No active plan')).toBeInTheDocument()
    expect(screen.getByText('Pick a plan to get instant access to the CyraCode API.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Choose a plan' }).getAttribute('href')).toBe('/pricing')

    const card = screen.getByText('No active plan').closest('section')
    expect(within(card).queryByRole('link', { name: /orders & invoices/i })).not.toBeInTheDocument()
  })

  it('still renders the workspace actions for the logged-in user', async () => {
    renderDashboard('test@example.com')

    expect(await screen.findByText('Your workspace')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /get started/i })).toHaveLength(3)
  })

  it('renders the site footer below the workspace', async () => {
    renderDashboard('test@example.com')

    const footer = screen.getByRole('contentinfo')
    // Anchored on a Product link: the Account column (which used to hold the
    // Dashboard link) is hidden in the footer right now.
    expect(within(footer).getByRole('link', { name: 'Pricing' })).toBeInTheDocument()
    expect(footer.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('shows the brand slogan as a rolling ticker at the top of the page', async () => {
    renderDashboard('test@example.com')

    // Rendered above the welcome heading, inside a marquee track with the
    // primary accent styling used elsewhere in the app.
    const track = document.getElementById('main-content').firstElementChild
    expect(track.className).toContain('marquee-track')
    expect(track.className).toContain('overflow-hidden')

    const ticker = track.firstElementChild
    expect(ticker.className).toContain('animate-marquee')

    // The slogan is rendered as discrete comma-separated phrases, so match the
    // two track copies by their concatenated text instead of a single element.
    const copies = Array.from(ticker.children).filter(
      (el) => el.textContent.includes('Prime Location, Precious Address, Pride Name')
    )
    expect(copies).toHaveLength(2)
    // The duplicate is only there to make the loop seamless; hide it from AT.
    expect(copies[1]).toHaveAttribute('aria-hidden', 'true')
    expect(copies[0].className).toContain('text-primary')
    // Scales its padding, gap and type size with the breakpoint, and the
    // single-cycle duration is matched in index.css per breakpoint.
    expect(copies[0].className).toContain('px-4')
    expect(copies[0].className).toContain('sm:px-6')
    expect(copies[0].className).toContain('text-sm')
    expect(copies[0].className).toContain('sm:text-base')
    expect(copies[0].className).toContain('whitespace-nowrap')

    expect(track.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from '../../App'
import { AuthProvider } from '../../context/AuthContext'
import { mockUser } from '../mocks/handlers'

function loginAs(email) {
  localStorage.setItem('cyracode_token', 'mock-token')
  localStorage.setItem('cyracode_user', JSON.stringify({ ...mockUser, email, first_name: 'Test' }))
}

function renderDashboard(email) {
  loginAs(email)
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
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

    const ordersLink = screen.getByRole('link', { name: /orders & invoices/i })
    expect(ordersLink.getAttribute('href')).toBe('/orders?email=test%40example.com')
    expect(screen.getByRole('link', { name: 'Upgrade' })).toBeInTheDocument()
  })

  it('shows a plan prompt when the user has no orders', async () => {
    renderDashboard('nobody@example.com')

    expect(await screen.findByText('No active plan')).toBeInTheDocument()
    expect(screen.getByText('Pick a plan to get instant access to the CyraCode API.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Choose a plan' }).getAttribute('href')).toBe('/pricing')
    expect(screen.queryByRole('link', { name: /orders & invoices/i })).not.toBeInTheDocument()
  })

  it('still renders the workspace actions for the logged-in user', async () => {
    renderDashboard('test@example.com')

    expect(await screen.findByText('Your workspace')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /get started/i })).toHaveLength(3)
  })

  it('shows the brand slogan as a rolling ticker at the top of the page', async () => {
    renderDashboard('test@example.com')

    // Rendered above the welcome heading, inside a marquee track with the
    // primary accent styling used elsewhere in the app.
    const track = document.getElementById('main-content').firstElementChild
    expect(track.className).toContain('marquee-track')
    expect(track.className).toContain('overflow-hidden')

    const copies = within(track).getAllByText('Prime Location, Precious Address, Pride Name')
    expect(copies).toHaveLength(2)
    // The duplicate is only there to make the loop seamless; hide it from AT.
    expect(copies[1]).toHaveAttribute('aria-hidden', 'true')

    const ticker = track.firstElementChild
    expect(ticker.className).toContain('animate-marquee')
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

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import { ContactWidgetProvider } from '../../context/ContactWidgetContext'
import OrdersPage from '../../pages/OrdersPage'
import { APP_MAX_WIDTH } from '../../lib/layout'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('react-hot-toast', () => ({
  default: toastMock,
  Toaster: () => null,
}))

// The page reads the signed-in account from localStorage via AuthProvider.
function signIn(email) {
  localStorage.setItem('cyracode_token', 'test-token')
  localStorage.setItem('cyracode_user', JSON.stringify({ email, name: 'Test User', role: 'user' }))
}

function renderPage({ email = 'test@example.com', entry = '/orders' } = {}) {
  const user = userEvent.setup()
  if (email) signIn(email)
  const utils = render(
    <MemoryRouter initialEntries={[entry]}>
      <ContactWidgetProvider>
        <AuthProvider>
          <OrdersPage />
        </AuthProvider>
      </ContactWidgetProvider>
    </MemoryRouter>
  )
  return { user, ...utils }
}

describe('OrdersPage', () => {
  // The header sat at max-w-6xl while the content and footer below it were
  // max-w-3xl, so the bar overhung the page by a quarter of the viewport.
  it('shares one frame across the header, content and footer', () => {
    renderPage()

    const header = document.querySelector('nav .max-w-3xl')
    expect(header, 'header is not on the app width').toBeInTheDocument()
    expect(document.querySelector('main#main-content')).toHaveClass('max-w-3xl')
    expect(screen.getByRole('contentinfo').firstElementChild).toHaveClass('max-w-3xl')
    // The drifting width came from a hand-written literal; tie it to the constant
    // the Dashboard uses so the two frames cannot diverge again.
    expect(APP_MAX_WIDTH).toBe('max-w-3xl')
  })

  it('loads orders for the signed-in account on mount', async () => {
    renderPage()

    expect(await screen.findByText('Active subscription')).toBeInTheDocument()
    expect(within(screen.getByTestId('active-subscription')).getByText('Growth')).toBeInTheDocument()
    expect(screen.getByText('Invoices')).toBeInTheDocument()

    const rows = screen.getAllByTestId('order-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText(/CYRA-TEST01/)).toBeInTheDocument()
    expect(within(rows[0]).getByText(/Annual/)).toBeInTheDocument()
    expect(within(rows[1]).getByText(/CYRA-TEST02/)).toBeInTheDocument()
  })

  // The page used to accept a typed email, so anyone who knew an address could
  // read another customer's orders and invoices. The lookup is now scoped to
  // the signed-in account and there is no way to point it elsewhere.
  it('offers no way to look up orders by another email', async () => {
    renderPage()

    expect(await screen.findByText('Active subscription')).toBeInTheDocument()
    expect(screen.queryByLabelText('Order email')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('you@company.com')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /view orders/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  // /orders?email=... used to prefill the (attacker-supplied) lookup field.
  // The query string is now ignored entirely.
  it('ignores an email supplied in the query string', async () => {
    renderPage({ entry: '/orders?email=nobody%40example.com' })

    // Still the signed-in account's two orders, not the empty result that the
    // query string address would previously have produced.
    expect(await screen.findByText('Active subscription')).toBeInTheDocument()
    expect(screen.getAllByTestId('order-row')).toHaveLength(2)
    expect(screen.queryByText('No orders found')).not.toBeInTheDocument()
  })

  it('shows an empty state for an account with no orders', async () => {
    renderPage({ email: 'nobody@example.com' })

    expect(await screen.findByText('No orders found')).toBeInTheDocument()
    const cta = screen.getByRole('link', { name: /browse plans/i })
    expect(cta.getAttribute('href')).toBe('/pricing')
  })

  // The end-to-end guard: another account's orders exist in the store, but a
  // signed-in user must never see them.
  it('does not show orders belonging to a different account', async () => {
    renderPage({ email: 'attacker@example.com' })

    expect(await screen.findByText('No orders found')).toBeInTheDocument()
    expect(screen.queryByText(/CYRA-TEST01/)).not.toBeInTheDocument()
    expect(screen.queryByText(/CYRA-TEST02/)).not.toBeInTheDocument()
    expect(screen.queryByText('Active subscription')).not.toBeInTheDocument()
  })

  it('toggles auto-renew on a paid order', async () => {
    const { user } = renderPage()

    const checkbox = (await screen.findAllByRole('checkbox'))[0]
    expect(checkbox).toBeChecked()
    await user.click(checkbox)

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Auto-renew turned off'))
    await waitFor(() => expect(checkbox).not.toBeChecked())
  })

  it('cancels a paid subscription and removes it from active state', async () => {
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Subscription cancelled'))
    expect(screen.queryByText('Active subscription')).not.toBeInTheDocument()
    const row = screen.getAllByTestId('order-row')[0]
    expect(within(row).getByText('cancelled')).toBeInTheDocument()
    expect(within(row).queryByRole('checkbox')).not.toBeInTheDocument()
  })
})

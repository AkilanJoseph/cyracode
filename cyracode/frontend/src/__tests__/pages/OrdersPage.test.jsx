import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import OrdersPage from '../../pages/OrdersPage'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('react-hot-toast', () => ({
  default: toastMock,
  Toaster: () => null,
}))

function renderPage() {
  const user = userEvent.setup()
  const utils = render(
    <MemoryRouter initialEntries={['/orders']}>
      <AuthProvider>
        <OrdersPage />
      </AuthProvider>
    </MemoryRouter>
  )
  return { user, ...utils }
}

async function lookupOrders(user, email = 'test@example.com') {
  await user.type(screen.getByLabelText('Order email'), email)
  await user.click(screen.getByRole('button', { name: /view orders/i }))
}

describe('OrdersPage', () => {
  it('looks up orders by email and shows the active subscription', async () => {
    const { user } = renderPage()
    await lookupOrders(user)

    expect(await screen.findByText('Active subscription')).toBeInTheDocument()
    expect(within(screen.getByTestId('active-subscription')).getByText('Growth')).toBeInTheDocument()
    expect(screen.getByText('Invoices')).toBeInTheDocument()

    const rows = screen.getAllByTestId('order-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText(/CYRA-TEST01/)).toBeInTheDocument()
    expect(within(rows[0]).getByText(/Annual/)).toBeInTheDocument()
    expect(within(rows[1]).getByText(/CYRA-TEST02/)).toBeInTheDocument()
  })

  it('shows an empty state for an email with no orders', async () => {
    const { user } = renderPage()
    await lookupOrders(user, 'nobody@example.com')

    expect(await screen.findByText('No orders found')).toBeInTheDocument()
    const cta = screen.getByRole('link', { name: /browse plans/i })
    expect(cta.getAttribute('href')).toBe('/pricing')
  })

  it('validates the email before looking up', async () => {
    const { user } = renderPage()
    await lookupOrders(user, 'not-an-email')

    expect(await screen.findByText('Please enter a valid email address')).toBeInTheDocument()
    expect(screen.queryByText('Invoices')).not.toBeInTheDocument()
  })

  it('toggles auto-renew on a paid order', async () => {
    const { user } = renderPage()
    await lookupOrders(user)

    const checkbox = (await screen.findAllByRole('checkbox'))[0]
    expect(checkbox).toBeChecked()
    await user.click(checkbox)

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Auto-renew turned off'))
    await waitFor(() => expect(checkbox).not.toBeChecked())
  })

  it('cancels a paid subscription and removes it from active state', async () => {
    const { user } = renderPage()
    await lookupOrders(user)

    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Subscription cancelled'))
    expect(screen.queryByText('Active subscription')).not.toBeInTheDocument()
    const row = screen.getAllByTestId('order-row')[0]
    expect(within(row).getByText('cancelled')).toBeInTheDocument()
    expect(within(row).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('prefills the email from the URL query', async () => {
    render(
      <MemoryRouter initialEntries={['/orders?email=buyer%40example.com']}>
        <AuthProvider>
          <OrdersPage />
        </AuthProvider>
      </MemoryRouter>
    )
    const user = userEvent.setup()
    expect(screen.getByLabelText('Order email')).toHaveValue('buyer@example.com')
    await user.click(screen.getByRole('button', { name: /view orders/i }))
    expect(await screen.findByText('No orders found')).toBeInTheDocument()
  })
})
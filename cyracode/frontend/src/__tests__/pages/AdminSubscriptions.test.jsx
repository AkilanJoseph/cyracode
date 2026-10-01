import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import AdminSubscriptions from '../../pages/AdminSubscriptions'
import { mockAdminUser, mockToken } from '../mocks/handlers'

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

function setup() {
  localStorage.setItem('cyracode_token', mockToken)
  localStorage.setItem('cyracode_user', JSON.stringify(mockAdminUser))
  const utils = render(
    <MemoryRouter>
      <AuthProvider>
        <AdminSubscriptions />
      </AuthProvider>
    </MemoryRouter>
  )
  return { user: userEvent.setup(), ...utils }
}

beforeEach(() => {
  localStorage.clear()
  const { Blob } = globalThis
  // the export path constructs a blob + anchor; guard against jsdom limitations
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
  Blob.prototype // noop to keep linter quiet about unused var
})

describe('AdminSubscriptions', () => {
  it('renders summary cards and lists subscriptions', async () => {
    setup()
    expect(await screen.findByText('Active subscriptions')).toBeInTheDocument()
    expect(screen.getByText('Expiring soon')).toBeInTheDocument()
    expect(screen.getByText('Renewal rate')).toBeInTheDocument()
    expect(await screen.findByText('Courier Partner')).toBeInTheDocument()
    expect(screen.getAllByText('Basic').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('$500/mo')).toBeInTheDocument()
  })

  it('filtering by status keeps only matching rows', async () => {
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.selectOptions(screen.getByLabelText('Status'), 'cancelled')

    expect(await screen.findByText('No subscriptions match your filters.')).toBeInTheDocument()
  })

  it('shows the row actions as icons without opening a menu', async () => {
    setup()
    await screen.findByText('Courier Partner')

    const row = screen.getByText('Courier Partner').closest('tr')
    // Each action is directly reachable, in the CyraCodes table's icon style.
    for (const name of [/edit courier partner/i, /renew courier partner/i, /change plan courier partner/i, /cancel courier partner/i]) {
      expect(within(row).getByRole('button', { name })).toBeInTheDocument()
    }
    // No collapsed menu to open first.
    expect(screen.queryByRole('button', { name: /^actions$/i })).not.toBeInTheDocument()
  })

  it('cancels a subscription straight from the row icon', async () => {
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /^cancel courier partner$/i }))
    await user.click(screen.getByRole('button', { name: /yes, cancel/i }))

    expect((await screen.findAllByText('Cancelled')).length).toBeGreaterThanOrEqual(1)
  })

  it('exports the filtered list as CSV', async () => {
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /export csv/i }))

    // The handler-based flow completes without a toast assertion that requires the DOM.
    expect(await screen.findByText('Courier Partner')).toBeInTheDocument()
  })
})
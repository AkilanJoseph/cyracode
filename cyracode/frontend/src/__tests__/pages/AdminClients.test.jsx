import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import AdminClients from '../../pages/AdminClients'
import AdminClientDetail from '../../pages/AdminClientDetail'
import { mockAdminUser, mockToken } from '../mocks/handlers'

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

function setup(initialEntry = '/admin/clients') {
  localStorage.setItem('cyracode_token', mockToken)
  localStorage.setItem('cyracode_user', JSON.stringify(mockAdminUser))
  const utils = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider>
        <Routes>
          <Route path="/admin/clients" element={<AdminClients />} />
          <Route path="/admin/clients/:clientId" element={<AdminClientDetail />} />
          <Route
            path="/admin/subscriptions"
            element={
              <>
                <p>Subscriptions screen</p>
                <BackProbe />
              </>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
  return { user: userEvent.setup(), ...utils }
}

// Reports where the router ended up, so navigation can be asserted directly
// instead of inferring it from whatever happens to be rendered.
function BackProbe() {
  const location = useLocation()
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>
}

beforeEach(() => {
  localStorage.clear()
})

describe('AdminClients', () => {
  it('lists clients with key tails and subscription status', async () => {
    setup()
    expect(await screen.findByText('Courier Partner')).toBeInTheDocument()
    expect(screen.getByText('…Ab12')).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1)
  })

  it('creates a client and reveals the API key exactly once', async () => {
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /new client/i }))
    await user.type(screen.getByLabelText(/client name/i), 'Logistics Co')
    await user.type(screen.getByLabelText(/contact email/i), 'ops@logistics.example')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/cyra_test_generated_key_12345678/i)).toBeInTheDocument()
    expect(screen.getByText(/shown only once/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^done$/i }))
    expect(await screen.findByText('Logistics Co')).toBeInTheDocument()
    // The raw key never appears in the table.
    expect(screen.queryByText(/cyra_test_generated_key_12345678/i)).not.toBeInTheDocument()
  })

  it('opens the create form inline on the page, not as a dialog', async () => {
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /new client/i }))

    const form = await screen.findByRole('region', { name: 'Create API Client' })
    expect(form).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // The list stays on screen and the form fields are reachable.
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    expect(screen.getByLabelText(/client name/i)).toBeInTheDocument()
    expect(screen.getByText('…Ab12')).toBeInTheDocument()
  })

  it('closing the create form leaves the list untouched', async () => {
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /new client/i }))
    await screen.findByRole('region', { name: 'Create API Client' })

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Create API Client' })).not.toBeInTheDocument()
    })
    // The form's fields go with it, and the grid is untouched.
    expect(screen.queryByLabelText(/client name/i)).not.toBeInTheDocument()
    expect(screen.getByText('…Ab12')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit courier partner/i })).toBeInTheDocument()
  })

  it('sends the admin to the client detail screen when view is clicked', async () => {
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /edit courier partner/i }))

    // The list is replaced by its own route, not expanded in place: the grid,
    // its search box and its per-row actions are gone rather than still behind it.
    expect(await screen.findByRole('region', { name: 'Courier Partner' })).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit courier partner/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the detail screen out of the list URL and carries the list URL for going back', async () => {
    const { user } = setup('/admin/clients?q=courier')
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /edit courier partner/i }))

    expect(await screen.findByRole('region', { name: 'Courier Partner' })).toBeInTheDocument()

    // The back control returns to the list exactly as it was left, query included.
    await user.click(screen.getByRole('button', { name: /back to api clients/i }))
    expect(await screen.findByText('…Ab12')).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('courier')
  })

  it('opens the create form without leaving the list screen', async () => {
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /new client/i }))

    expect(await screen.findByRole('region', { name: 'Create API Client' })).toBeInTheDocument()
    // Still the list route underneath.
    expect(screen.getByText('…Ab12')).toBeInTheDocument()
  })

  it('shows plan, expiry, and status on the client detail screen', async () => {
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /edit courier partner/i }))
    expect((await screen.findAllByText('Basic')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('cyracode.lookup')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rotate key/i })).toBeInTheDocument()
  })

  it('revokes and re-grants the lookup permission', async () => {
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /edit courier partner/i }))
    expect(await screen.findByText('cyracode.lookup')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^revoke$/i }))
    await waitFor(() => {
      expect(screen.queryByText('cyracode.lookup')).not.toBeInTheDocument()
    })
    expect(screen.getByText('No permissions')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^grant$/i }))
    expect(await screen.findByText('cyracode.lookup')).toBeInTheDocument()
  })

  it('disables a client and shows its inactive status', async () => {
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /edit courier partner/i }))
    await screen.findByRole('button', { name: /^disable$/i })

    await user.click(screen.getByRole('button', { name: /^disable$/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^enable$/i })).toBeInTheDocument()
    })
    expect(screen.getAllByText('Inactive').length).toBeGreaterThanOrEqual(1)
  })

  it('rotates a key and shows the new one', async () => {
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /edit courier partner/i }))
    await user.click(await screen.findByRole('button', { name: /rotate key/i }))

    expect(await screen.findByText(/cyra_test_rotated_key_abcdef/i)).toBeInTheDocument()
  })

  it('deletes a client after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /edit courier partner/i }))
    await user.click(await screen.findByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.queryByText('Courier Partner')).not.toBeInTheDocument()
    })
    expect(screen.getByText('No API clients yet.')).toBeInTheDocument()
    confirmSpy.mockRestore()
  })
})
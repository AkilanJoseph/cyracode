import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import AdminClients from '../../pages/AdminClients'
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
        <AdminClients />
      </AuthProvider>
    </MemoryRouter>
  )
  return { user: userEvent.setup(), ...utils }
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

  it('shows plan, expiry, and status inside the client detail modal', async () => {
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /view courier partner/i }))
    expect((await screen.findAllByText('Basic')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('cyracode.lookup')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rotate key/i })).toBeInTheDocument()
  })

  it('revokes and re-grants the lookup permission', async () => {
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /view courier partner/i }))
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

    await user.click(screen.getByRole('button', { name: /view courier partner/i }))
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

    await user.click(screen.getByRole('button', { name: /view courier partner/i }))
    await user.click(await screen.findByRole('button', { name: /rotate key/i }))

    expect(await screen.findByText(/cyra_test_rotated_key_abcdef/i)).toBeInTheDocument()
  })

  it('deletes a client after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user } = setup()
    await screen.findByText('Courier Partner')

    await user.click(screen.getByRole('button', { name: /view courier partner/i }))
    await user.click(await screen.findByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.queryByText('Courier Partner')).not.toBeInTheDocument()
    })
    expect(screen.getByText('No API clients yet.')).toBeInTheDocument()
    confirmSpy.mockRestore()
  })
})
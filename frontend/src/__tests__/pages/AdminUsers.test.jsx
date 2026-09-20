import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import AdminUsers from '../../pages/AdminUsers'
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
        <AdminUsers />
      </AuthProvider>
    </MemoryRouter>
  )
  return { user: userEvent.setup(), ...utils }
}

beforeEach(() => {
  localStorage.clear()
})

describe('AdminUsers', () => {
  it('lists users with their roles', async () => {
    setup()
    expect(await screen.findByText('admin@example.com')).toBeInTheDocument()
    expect(screen.getByText('client@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Client').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/(you)/)).toBeInTheDocument()
  })

  it('offers all three user types in the role dropdown', async () => {
    setup()
    await screen.findByText('admin@example.com')
    const select = screen.getAllByRole('combobox', { name: /change role/i })[0]
    expect(within(select).getByRole('option', { name: 'User' })).toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'Client' })).toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'Admin' })).toBeInTheDocument()
  })

  it('changes a client user to Admin from the role dropdown', async () => {
    const { user } = setup()
    await screen.findByText('client@example.com')

    const clientRow = screen.getByText('client@example.com').closest('tr')
    const select = within(clientRow).getByRole('combobox', { name: /change role for client@example.com/i })
    await user.selectOptions(select, 'admin')

    await waitFor(() => {
      const refreshed = within(screen.getByText('client@example.com').closest('tr')).getByRole('combobox', {
        name: /change role for client@example.com/i,
      })
      expect(refreshed.value).toBe('admin')
    })
  })

  it('searches users by email', async () => {
    const { user } = setup()
    await screen.findByText('client@example.com')

    await user.type(screen.getByRole('searchbox', { name: /search by name or email/i }), 'client@')

    await waitFor(() => {
      expect(screen.queryByText('admin@example.com')).not.toBeInTheDocument()
    })
    expect(screen.getByText('client@example.com')).toBeInTheDocument()
  })
})
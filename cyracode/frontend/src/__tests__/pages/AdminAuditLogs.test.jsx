import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import AdminAuditLogs from '../../pages/AdminAuditLogs'
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
        <AdminAuditLogs />
      </AuthProvider>
    </MemoryRouter>
  )
  return { user: userEvent.setup(), ...utils }
}

beforeEach(() => {
  localStorage.clear()
})

describe('AdminAuditLogs', () => {
  it('renders audit entries with actions and admin email', async () => {
    setup()
    expect(await screen.findByText('admin_login')).toBeInTheDocument()
    expect(screen.getByText('cyracode_create:TestHome')).toBeInTheDocument()
    expect(screen.getAllByText('admin@example.com').length).toBeGreaterThanOrEqual(2)
  })

  it('filters entries by action', async () => {
    const { user } = setup()
    await screen.findByText('admin_login')

    await user.type(screen.getByLabelText(/filter action/i), 'cyracode_create:TestHome')

    await waitFor(() => {
      expect(screen.queryByText('admin_login')).not.toBeInTheDocument()
    })
    expect(screen.getByText('cyracode_create:TestHome')).toBeInTheDocument()
  })
})
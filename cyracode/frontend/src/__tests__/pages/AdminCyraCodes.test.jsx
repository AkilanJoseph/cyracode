import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import AdminCyraCodes from '../../pages/AdminCyraCodes'
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
        <AdminCyraCodes />
      </AuthProvider>
    </MemoryRouter>
  )
  return { user: userEvent.setup(), ...utils }
}

beforeEach(() => {
  localStorage.clear()
})

describe('AdminCyraCodes', () => {
  it('lists CyraCodes with their status badges', async () => {
    setup()
    expect(await screen.findByText('TestHome')).toBeInTheDocument()
    expect(screen.getByText('MyOffice')).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0)
  })

  it('filters the list by search query', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    const searchBox = screen.getByRole('searchbox', { name: /search by name, address, city, or country/i })
    await user.type(searchBox, 'Office')

    await waitFor(() => {
      expect(screen.queryByText('TestHome')).not.toBeInTheDocument()
    })
    expect(screen.getByText('MyOffice')).toBeInTheDocument()
  })

  it('filters by active status', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.selectOptions(screen.getByRole('combobox', { name: /filter by status/i }), 'false')

    await waitFor(() => {
      expect(screen.queryByText('TestHome')).not.toBeInTheDocument()
    })
    expect(screen.getByText('MyOffice')).toBeInTheDocument()
  })

  it('creates a new CyraCode via the add modal', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /add cyracode/i }))

    await user.type(screen.getByLabelText(/cyracode name/i), 'AdminHome')
    await user.type(screen.getByLabelText(/^latitude$/i), '12.9716')
    await user.type(screen.getByLabelText(/^longitude$/i), '77.5946')
    await user.type(screen.getByLabelText(/^country$/i), 'India')
    await user.type(screen.getByLabelText(/^country code$/i), 'IN')
    await user.type(screen.getByLabelText(/street address/i), 'Brigade Road')
    await user.type(screen.getByLabelText(/^postal code$/i), '560001')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText('AdminHome')).toBeInTheDocument()
  })

  it('shows a details modal when viewing a code', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /view TestHome/i }))
    expect(await screen.findByText('CyraCode Details')).toBeInTheDocument()
    // Owner email appears in the table rows and in the details modal.
    expect(screen.getAllByText(/test@example.com/i).length).toBeGreaterThanOrEqual(2)
  })

  it('soft-deletes a code and flips its status to inactive', async () => {
    const { user } = setup()
    await screen.findByText('TestHome')

    await user.click(screen.getByRole('button', { name: /delete TestHome/i }))
    await user.click(screen.getByRole('button', { name: /yes, remove/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /delete TestHome/i })).not.toBeInTheDocument()
    })
    // Deleted codes can be restored.
    expect(screen.getByRole('button', { name: /restore TestHome/i })).toBeInTheDocument()
    expect(screen.getAllByText('Inactive').length).toBeGreaterThanOrEqual(2)
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import AdminDashboard from '../../pages/AdminDashboard'
import { mockAdminUser, mockToken } from '../mocks/handlers'

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

function setup() {
  localStorage.setItem('cyracode_token', mockToken)
  localStorage.setItem('cyracode_user', JSON.stringify(mockAdminUser))
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AdminDashboard />
      </AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('AdminDashboard', () => {
  it('renders the portal heading and admin navigation', () => {
    setup()
    expect(screen.getByText('Admin Portal')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /cyracodes/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /api clients/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /subscriptions/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /audit log/i })).toBeInTheDocument()
  })

  it('includes a client search box for quick access', () => {
    setup()
    expect(screen.getByPlaceholderText('Search clients…')).toBeInTheDocument()
  })

  it('shows KPIs and charts loaded from the backend', async () => {
    setup()
    expect(await screen.findByText('Total clients')).toBeInTheDocument()
    expect(screen.getByText('Monthly recurring revenue')).toBeInTheDocument()
    expect(screen.getAllByText('$500').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Revenue trend')).toBeInTheDocument()
    expect(screen.getByText('Subscriptions by plan')).toBeInTheDocument()
    expect(screen.getByText('Recent transactions')).toBeInTheDocument()
    expect(screen.getByText('Courier Partner')).toBeInTheDocument()
    expect(screen.getByText('Paid')).toBeInTheDocument()
  })

  it('shows the signed-in admin email', async () => {
    setup()
    expect(await screen.findByText(/admin@example.com/i)).toBeInTheDocument()
  })

  it('navigates to the API clients screen when the total clients number is clicked', async () => {
    localStorage.setItem('cyracode_token', mockToken)
    localStorage.setItem('cyracode_user', JSON.stringify(mockAdminUser))
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider>
          <Routes>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/clients" element={<div>Clients screen</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )

    const total = await screen.findByTestId('kpi-total-clients')
    expect(total).toHaveTextContent('1')
    await user.click(total)
    expect(await screen.findByText('Clients screen')).toBeInTheDocument()
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import AdminClientDetail from '../../pages/AdminClientDetail'
import { mockAdminUser, mockToken } from '../mocks/handlers'

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>
}

function setup({ entry = '/admin/clients/client-1', state } = {}) {
  localStorage.setItem('cyracode_token', mockToken)
  localStorage.setItem('cyracode_user', JSON.stringify(mockAdminUser))
  const utils = render(
    <MemoryRouter initialEntries={[{ pathname: entry, state }]}>
      <AuthProvider>
        <Routes>
          <Route path="/admin/clients" element={<><p>Clients screen</p><LocationProbe /></>} />
          <Route path="/admin/subscriptions" element={<><p>Subscriptions screen</p><LocationProbe /></>} />
          <Route path="/admin/clients/:clientId" element={<><AdminClientDetail /><LocationProbe /></>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
  return { user: userEvent.setup(), ...utils }
}

beforeEach(() => {
  localStorage.clear()
})

describe('AdminClientDetail', () => {
  it('shows the client named in the route', async () => {
    setup()
    expect(await screen.findByRole('region', { name: 'Courier Partner' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/clients/client-1')
    expect(screen.getByText('cyracode.lookup')).toBeInTheDocument()
  })

  it('is reachable by deep link without coming from a list', async () => {
    setup()
    await screen.findByRole('region', { name: 'Courier Partner' })

    // No `from` state, so back falls back to the clients list.
    await userEvent.setup().click(screen.getByRole('button', { name: /back to api clients/i }))

    expect(await screen.findByText('Clients screen')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/clients')
  })

  it('returns to the clients list with its search and filters intact', async () => {
    const { user } = setup({
      entry: '/admin/clients/client-1',
      state: { from: '/admin/clients?q=courier&status=active' },
    })
    await screen.findByRole('region', { name: 'Courier Partner' })

    await user.click(screen.getByRole('button', { name: /back to api clients/i }))

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/admin/clients?q=courier&status=active')
    })
    expect(screen.getByText('Clients screen')).toBeInTheDocument()
  })

  it('returns to the subscriptions list when that is where it was opened from', async () => {
    const { user } = setup({
      entry: '/admin/clients/client-1',
      state: { from: '/admin/subscriptions' },
    })
    await screen.findByRole('region', { name: 'Courier Partner' })

    // The label names the origin screen, so the destination is never a surprise.
    const back = screen.getByRole('button', { name: /back to subscriptions/i })
    expect(back).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /back to api clients/i })).not.toBeInTheDocument()

    await user.click(back)

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/admin/subscriptions')
    })
    expect(screen.getByText('Subscriptions screen')).toBeInTheDocument()
  })

  it('reports a missing client instead of rendering an empty detail', async () => {
    setup({ entry: '/admin/clients/does-not-exist' })

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Courier Partner' })).not.toBeInTheDocument()

    // Still offers a way back.
    await userEvent.setup().click(screen.getByRole('link', { name: /back to api clients/i }))
    await waitFor(() => {
      expect(screen.getByText('Clients screen')).toBeInTheDocument()
    })
  })

  it('goes back after deleting the client', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user } = setup({ state: { from: '/admin/subscriptions' } })
    await screen.findByRole('region', { name: 'Courier Partner' })

    await user.click(await screen.findByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.getByText('Subscriptions screen')).toBeInTheDocument()
    })
    confirmSpy.mockRestore()
  })
})

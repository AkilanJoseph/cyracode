import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import { AdminRoute } from '../../App'
import { mockAdminUser, mockUser, mockToken } from '../mocks/handlers'

function Harness({ token, user, initialPath = '/admin' }) {
  if (token) localStorage.setItem('cyracode_token', token)
  if (user) localStorage.setItem('cyracode_user', JSON.stringify(user))

  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<div>landing-page</div>} />
          <Route path="/dashboard" element={<div>client-dashboard</div>} />
          <Route path="/admin" element={<AdminRoute><div>admin-home</div></AdminRoute>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('AdminRoute — role guard', () => {
  it('sends unauthenticated users to the landing page', async () => {
    render(<Harness />)
    expect(await screen.findByText('landing-page')).toBeInTheDocument()
    expect(screen.queryByText('admin-home')).not.toBeInTheDocument()
  })

  it('sends authenticated non-admin users to the client dashboard', async () => {
    render(<Harness token={mockToken} user={mockUser} />)
    expect(await screen.findByText('client-dashboard')).toBeInTheDocument()
    expect(screen.queryByText('admin-home')).not.toBeInTheDocument()
  })

  it('lets authenticated admins through to the admin portal', async () => {
    render(<Harness token={mockToken} user={mockAdminUser} />)
    expect(await screen.findByText('admin-home')).toBeInTheDocument()
  })
})
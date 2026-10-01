import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import { ProtectedRoute } from '../../App'
import { mockUser, mockToken } from '../mocks/handlers'

// /orders shows a customer's subscriptions and invoices. It used to be a public
// route that looked orders up from an email typed into the page, so anyone who
// knew an address could read another customer's billing history.
function Harness({ token, user, initialPath = '/orders' }) {
  if (token) localStorage.setItem('cyracode_token', token)
  if (user) localStorage.setItem('cyracode_user', JSON.stringify(user))

  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<div>landing-page</div>} />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <div>orders-page</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('ProtectedRoute on /orders', () => {
  it('sends signed-out visitors to the landing page', async () => {
    render(<Harness />)
    expect(await screen.findByText('landing-page')).toBeInTheDocument()
    expect(screen.queryByText('orders-page')).not.toBeInTheDocument()
  })

  it('does not honour a query-string email when signed out', async () => {
    render(<Harness initialPath="/orders?email=victim%40example.com" />)
    expect(await screen.findByText('landing-page')).toBeInTheDocument()
    expect(screen.queryByText('orders-page')).not.toBeInTheDocument()
  })

  it('lets a signed-in customer through', async () => {
    render(<Harness token={mockToken} user={mockUser} />)
    expect(await screen.findByText('orders-page')).toBeInTheDocument()
  })
})

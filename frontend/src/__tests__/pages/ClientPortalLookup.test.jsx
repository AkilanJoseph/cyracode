import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import { Dashboard } from '../../App'
import { mockUser, mockToken } from '../mocks/handlers'

function setup() {
  localStorage.setItem('cyracode_token', mockToken)
  localStorage.setItem('cyracode_user', JSON.stringify(mockUser))
  render(
    <MemoryRouter>
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('User Dashboard — role-scoped content', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the standard User registration actions', () => {
    setup()
    expect(screen.getByRole('link', { name: /register with custom name/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /auto-generate my code/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /manage cyracodes/i })).toBeInTheDocument()
  })

  it('does not show the Client API Lookup tool to regular Users', () => {
    setup()
    expect(screen.queryByRole('heading', { name: /client api lookup/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument()
  })

  it('does not show the Admin-only Search Addresses action', () => {
    setup()
    expect(screen.queryByText('Search Addresses')).not.toBeInTheDocument()
  })
})
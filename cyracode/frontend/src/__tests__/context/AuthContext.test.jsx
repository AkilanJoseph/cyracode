import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../../context/AuthContext'

function TestConsumer() {
  const { user, token, isAuthenticated, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="token">{token || 'none'}</span>
      <span data-testid="email">{user?.email || 'none'}</span>
      <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
      <button onClick={() => login('tok-123', { email: 'a@b.com', first_name: 'A' })}>
        Login
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => localStorage.clear())

  it('provides null token and user by default', () => {
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    expect(screen.getByTestId('token')).toHaveTextContent('none')
    expect(screen.getByTestId('email')).toHaveTextContent('none')
    expect(screen.getByTestId('auth')).toHaveTextContent('no')
  })

  it('login sets token, user and isAuthenticated', async () => {
    const user = userEvent.setup()
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await user.click(screen.getByText('Login'))
    expect(screen.getByTestId('token')).toHaveTextContent('tok-123')
    expect(screen.getByTestId('email')).toHaveTextContent('a@b.com')
    expect(screen.getByTestId('auth')).toHaveTextContent('yes')
  })

  it('login persists token to localStorage', async () => {
    const user = userEvent.setup()
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await user.click(screen.getByText('Login'))
    expect(localStorage.getItem('cyracode_token')).toBe('tok-123')
    const stored = JSON.parse(localStorage.getItem('cyracode_user'))
    expect(stored.email).toBe('a@b.com')
  })

  it('logout clears token and user', async () => {
    const user = userEvent.setup()
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await user.click(screen.getByText('Login'))
    await user.click(screen.getByText('Logout'))
    expect(screen.getByTestId('token')).toHaveTextContent('none')
    expect(screen.getByTestId('auth')).toHaveTextContent('no')
  })

  it('logout removes items from localStorage', async () => {
    const user = userEvent.setup()
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await user.click(screen.getByText('Login'))
    await user.click(screen.getByText('Logout'))
    expect(localStorage.getItem('cyracode_token')).toBeNull()
    expect(localStorage.getItem('cyracode_user')).toBeNull()
  })

  it('reads token and user from localStorage on mount', () => {
    localStorage.setItem('cyracode_token', 'stored-tok')
    localStorage.setItem('cyracode_user', JSON.stringify({ email: 'stored@b.com' }))
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    expect(screen.getByTestId('token')).toHaveTextContent('stored-tok')
    expect(screen.getByTestId('email')).toHaveTextContent('stored@b.com')
    expect(screen.getByTestId('auth')).toHaveTextContent('yes')
  })

  it('gracefully handles corrupted localStorage user', () => {
    localStorage.setItem('cyracode_token', 'tok')
    localStorage.setItem('cyracode_user', 'invalid-json{{{')
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    expect(screen.getByTestId('email')).toHaveTextContent('none')
  })

  it('throws when useAuth used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow()
    spy.mockRestore()
  })
})

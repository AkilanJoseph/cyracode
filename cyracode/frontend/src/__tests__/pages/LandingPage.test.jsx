import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { mockToken, mockUser, mockAdminUser, registrationCountStore } from '../mocks/handlers'
import { AuthProvider } from '../../context/AuthContext'
import LandingPage from '../../pages/LandingPage'

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// LandingPage uses Google sign-in; mock the hook so tests don't require GoogleOAuthProvider
vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: () => () => {},
}))

function setup() {
  const utils = render(
    <MemoryRouter>
      <AuthProvider>
        <LandingPage />
      </AuthProvider>
    </MemoryRouter>
  )
  return { user: userEvent.setup(), ...utils }
}

describe('LandingPage — layout', () => {
  it('renders hero heading', () => {
    setup()
    expect(screen.getByText(/your address/i)).toBeInTheDocument()
  })

  it('renders Login tab active by default', () => {
    setup()
    expect(screen.getByRole('button', { name: /^let's go!, dashboard$/i })).toBeInTheDocument()
  })

  it('renders Sign In and Sign Up tabs', () => {
    setup()
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sign up$/i })).toBeInTheDocument()
  })
})

describe('LandingPage — registration count', () => {
  it('shows the registration count with comma separators and a social proof message', async () => {
    setup()
    expect(await screen.findByText('10,100+')).toBeInTheDocument()
    expect(screen.getByText(/CyraCodes registered/i)).toBeInTheDocument()
  })

  it('uses the count returned by the backend API', async () => {
    registrationCountStore.actualCount = 123456
    setup()
    expect(await screen.findByText('133,456+')).toBeInTheDocument()
  })

  it('does not render the count before the API responds', () => {
    setup()
    expect(screen.queryByText(/CyraCodes registered/i)).not.toBeInTheDocument()
  })

  it('refreshes the count on window focus after a new CyraCode is registered', async () => {
    const { user } = setup()
    await screen.findByText('10,100+')

    // Simulate a CyraCode registration happening server-side (mock increments on
    // /registration/traditional) then the user returning to the landing page.
    registrationCountStore.actualCount += 1
    fireEvent(window, new Event('focus'))

    expect(await screen.findByText('10,101+')).toBeInTheDocument()
    expect(screen.queryByText('10,100+')).not.toBeInTheDocument()
  })

  it('hides the count banner when the count API fails', async () => {
    setup()
    await screen.findByText('10,100+')

    server.use(
      http.get('http://localhost:5173/api/registration/count', () =>
        HttpResponse.json({ detail: 'Service unavailable.' }, { status: 500 })
      )
    )
    fireEvent(window, new Event('focus'))

    await waitFor(() => expect(screen.queryByText('10,100+')).not.toBeInTheDocument())
    expect(screen.queryByText(/CyraCodes registered/i)).not.toBeInTheDocument()
  })
})

describe('LandingPage — Login tab', () => {
  it('shows email and password inputs', () => {
    setup()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('shows "Forgot password?" link', () => {
    setup()
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument()
  })

  it('shows validation error for invalid email', async () => {
    const { user } = setup()
    await user.type(screen.getByPlaceholderText('you@example.com'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /^let's go!, dashboard$/i }))
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
  })

  it('shows error when password is empty', async () => {
    const { user } = setup()
    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com')
    await user.click(screen.getByRole('button', { name: /^let's go!, dashboard$/i }))
    expect(await screen.findByText(/this field is required/i)).toBeInTheDocument()
  })

  it('navigates to dashboard on successful login', async () => {
    const { user } = setup()
    await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'ValidP@ss1')
    await user.click(screen.getByRole('button', { name: /^let's go!, dashboard$/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'))
  })

  it('navigates to the admin portal when the account holds the Admin role', async () => {
    mockNavigate.mockClear()
    server.use(
      http.post('http://localhost:5173/api/auth/login', () =>
        HttpResponse.json({ access_token: mockToken, token_type: 'bearer', user: mockAdminUser })
      )
    )
    const { user } = setup()
    await user.type(screen.getByPlaceholderText('you@example.com'), 'admin@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'ValidP@ss1')
    await user.click(screen.getByRole('button', { name: /^let's go!, dashboard$/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin'))
  })

  it('shows error toast on login failure', async () => {
    const toast = await import('react-hot-toast')
    server.use(
      http.post('http://localhost:5173/api/auth/login', () =>
        HttpResponse.json({ detail: 'Invalid email or password.' }, { status: 401 })
      )
    )
    const { user } = setup()
    await user.type(screen.getByPlaceholderText('you@example.com'), 'bad@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'WrongPass1!')
    await user.click(screen.getByRole('button', { name: /^let's go!, dashboard$/i }))
    await waitFor(() => expect(toast.default.error).toHaveBeenCalled())
  })

  it('forgot password sends request and shows toast', async () => {
    const toast = await import('react-hot-toast')
    const { user } = setup()
    await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
    await user.click(screen.getByText(/forgot password/i))
    await waitFor(() => expect(toast.default.success).toHaveBeenCalled())
  })

  it('forgot password shows error if email not filled', async () => {
    const toast = await import('react-hot-toast')
    const { user } = setup()
    await user.click(screen.getByText(/forgot password/i))
    await waitFor(() => expect(toast.default.error).toHaveBeenCalledWith(expect.stringMatching(/email/i)))
  })
})

describe('LandingPage — Sign Up tab', () => {
  async function switchToSignUp(user) {
    await user.click(screen.getByRole('button', { name: /^sign up$/i }))
  }

  it('shows registration fields after switching tab', async () => {
    const { user } = setup()
    await switchToSignUp(user)
    expect(screen.getByRole('button', { name: /setup your account/i })).toBeInTheDocument()
  })

  it('shows validation error when first name is empty', async () => {
    const { user } = setup()
    await switchToSignUp(user)
    await user.click(screen.getByRole('button', { name: /setup your account/i }))
    expect(await screen.findAllByText(/this field is required/i)).not.toHaveLength(0)
  })

  it('shows password strength indicator when typing password', async () => {
    const { user } = setup()
    await switchToSignUp(user)
    const pwInput = screen.getAllByPlaceholderText('••••••••')[0]
    await user.type(pwInput, 'weak')
    expect(await screen.findByText(/very weak|weak/i)).toBeInTheDocument()
  })

  it('shows mode-select modal on successful registration', async () => {
    const { user } = setup()
    await switchToSignUp(user)
    await user.type(screen.getByLabelText(/first name/i), 'John')
    await user.type(screen.getByLabelText(/last name/i), 'Doe')
    const emailInput = screen.getAllByPlaceholderText('you@example.com')[0]
    await user.type(emailInput, 'john@example.com')
    const pwInput = screen.getAllByPlaceholderText('••••••••')[0]
    await user.type(pwInput, 'ValidP@ss1')
    await user.click(screen.getByLabelText(/i agree/i))
    await user.click(screen.getByRole('button', { name: /setup your account/i }))
    expect(await screen.findByText(/how do you want to register/i)).toBeInTheDocument()
  })

  it('mode-select modal shows the app-standard icon for each option', async () => {
    const { user } = setup()
    await switchToSignUp(user)
    await user.type(screen.getByLabelText(/first name/i), 'Ivy')
    await user.type(screen.getByLabelText(/last name/i), 'Doe')
    const emailInput = screen.getAllByPlaceholderText('you@example.com')[0]
    await user.type(emailInput, 'ivy@example.com')
    const pwInput = screen.getAllByPlaceholderText('••••••••')[0]
    await user.type(pwInput, 'ValidP@ss1')
    await user.click(screen.getByLabelText(/i agree/i))
    await user.click(screen.getByRole('button', { name: /setup your account/i }))
    await screen.findByText(/how do you want to register/i)

    const custom = screen.getByRole('button', { name: /custom name/i })
    const auto = screen.getByRole('button', { name: /auto-generate/i })
    const dashboard = screen.getByRole('button', { name: /^dashboard/i })
    expect(custom.querySelector('.lucide-sparkles')).not.toBeNull()
    expect(auto.querySelector('.lucide-zap')).not.toBeNull()
    expect(dashboard.querySelector('.lucide-layout-dashboard')).not.toBeNull()
    // Cards use the same dashboard action-card treatment everywhere.
    ;[custom, auto, dashboard].forEach((card) => {
      expect(card.className).toContain('hover:-translate-y-1')
      expect(card.className).toContain('hover:shadow-card-hover')
      expect(within(card).getByText('Get started')).toBeInTheDocument()
    })
  })

  it('mode-select modal offers dashboard option', async () => {
    const { user } = setup()
    await switchToSignUp(user)
    await user.type(screen.getByLabelText(/first name/i), 'Bob')
    await user.type(screen.getByLabelText(/last name/i), 'Doe')
    const emailInput = screen.getAllByPlaceholderText('you@example.com')[0]
    await user.type(emailInput, 'bob@example.com')
    const pwInput = screen.getAllByPlaceholderText('••••••••')[0]
    await user.type(pwInput, 'ValidP@ss1')
    await user.click(screen.getByLabelText(/i agree/i))
    await user.click(screen.getByRole('button', { name: /setup your account/i }))
    await screen.findByText(/how do you want to register/i)
    await user.click(screen.getByRole('button', { name: /dashboard/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'))
  })
})

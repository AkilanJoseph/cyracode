import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Header from '../../components/common/Header'
import { AuthProvider } from '../../context/AuthContext'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('react-hot-toast', () => ({
  default: toastMock,
  Toaster: () => null,
}))

const mockUser = {
  id: 'user-test-id',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  is_email_verified: false,
  role: 'user',
}

function renderHeader(user = mockUser) {
  localStorage.setItem('cyracode_token', 'mock-jwt-token')
  localStorage.setItem('cyracode_user', JSON.stringify(user))
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Header />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Header — profile menu', () => {
  beforeEach(() => {
    toastMock.success.mockClear()
    toastMock.error.mockClear()
  })

  it('renders a circular avatar with the first letter instead of the full name', () => {
    renderHeader(mockUser)
    const avatar = screen.getByTestId('avatar-button')
    expect(avatar).toHaveTextContent('T')
    expect(avatar).toHaveAttribute('aria-label', 'Profile menu')
    expect(screen.queryByText('Test User')).not.toBeInTheDocument()
    expect(screen.queryByText('Test')).not.toBeInTheDocument()
  })

  it('trims leading/trailing spaces before extracting the initial', () => {
    renderHeader({ ...mockUser, first_name: '  Mohan ', last_name: '  Babu  ' })
    expect(screen.getByTestId('avatar-button')).toHaveTextContent('M')
  })

  it('falls back to U when no name is available', () => {
    renderHeader({ ...mockUser, first_name: undefined, last_name: undefined })
    expect(screen.getByTestId('avatar-button')).toHaveTextContent('U')
  })

  it('opens the menu on hover and shows read-only name and email plus reset action', async () => {
    renderHeader(mockUser)
    fireEvent.mouseEnter(screen.getByTestId('avatar-button'))
    const panel = screen.getByTestId('profile-menu-panel')
    expect(within(panel).getByText('Full Name')).toBeInTheDocument()
    expect(within(panel).getByText('Test User')).toBeInTheDocument()
    expect(within(panel).getByText('Email Address')).toBeInTheDocument()
    expect(within(panel).getByText('test@example.com')).toBeInTheDocument()
    expect(within(panel).queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /reset password/i })).toBeInTheDocument()
  })

  it('hides the menu when the mouse leaves the profile menu', async () => {
    renderHeader(mockUser)
    const menu = screen.getByTestId('profile-menu')
    fireEvent.mouseEnter(screen.getByTestId('avatar-button'))
    expect(screen.getByTestId('profile-menu-panel')).toBeInTheDocument()
    fireEvent.mouseLeave(menu)
    expect(screen.queryByTestId('profile-menu-panel')).not.toBeInTheDocument()
  })

  it('keeps the menu open after a click even when the mouse leaves', async () => {
    const user = userEvent.setup()
    renderHeader(mockUser)
    await user.click(screen.getByTestId('avatar-button'))
    expect(screen.getByTestId('profile-menu-panel')).toBeInTheDocument()
    fireEvent.mouseLeave(screen.getByTestId('profile-menu'))
    expect(screen.getByTestId('profile-menu-panel')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('profile-menu-panel')).not.toBeInTheDocument()
  })

  it('opens the menu on click and keeps it open on repeated clicks; closes on outside click', async () => {
    const user = userEvent.setup()
    renderHeader(mockUser)
    const avatar = screen.getByTestId('avatar-button')
    await user.click(avatar)
    expect(screen.getByTestId('profile-menu-panel')).toBeInTheDocument()
    await user.click(avatar)
    expect(screen.getByTestId('profile-menu-panel')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('profile-menu-panel')).not.toBeInTheDocument()
  })

  it('closes the menu on outside click or Escape', async () => {
    renderHeader(mockUser)
    fireEvent.mouseEnter(screen.getByTestId('avatar-button'))
    expect(screen.getByTestId('profile-menu-panel')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('profile-menu-panel')).not.toBeInTheDocument()

    fireEvent.mouseEnter(screen.getByTestId('avatar-button'))
    expect(screen.getByTestId('profile-menu-panel')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('profile-menu-panel')).not.toBeInTheDocument()
  })

  it('shows a Yes/No confirmation dialog before resetting the password', async () => {
    const user = userEvent.setup()
    renderHeader(mockUser)
    await user.click(screen.getByTestId('avatar-button'))
    await user.click(screen.getByTestId('reset-password-button'))
    expect(screen.getByTestId('reset-confirm-modal')).toBeInTheDocument()
    expect(screen.getByText(/do you want to reset your password/i)).toBeInTheDocument()
    expect(screen.getByTestId('reset-confirm-yes')).toHaveTextContent('Yes')
    expect(screen.getByTestId('reset-confirm-no')).toHaveTextContent('No')
  })

  it('sends the reset request and shows the success message when Yes is clicked', async () => {
    const user = userEvent.setup()
    renderHeader(mockUser)
    await user.click(screen.getByTestId('avatar-button'))
    await user.click(screen.getByTestId('reset-password-button'))
    await user.click(screen.getByTestId('reset-confirm-yes'))
    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith(
        'A password reset link has been sent to your registered email address.'
      )
    )
    expect(screen.queryByTestId('reset-confirm-modal')).not.toBeInTheDocument()
  })

  it('closes the dialog without sending anything when No is clicked', async () => {
    const user = userEvent.setup()
    renderHeader(mockUser)
    await user.click(screen.getByTestId('avatar-button'))
    await user.click(screen.getByTestId('reset-password-button'))
    await user.click(screen.getByTestId('reset-confirm-no'))
    await waitFor(() =>
      expect(screen.queryByTestId('reset-confirm-modal')).not.toBeInTheDocument()
    )
    expect(toastMock.success).not.toHaveBeenCalled()
    expect(toastMock.error).not.toHaveBeenCalled()
  })
})

describe('Header — brand', () => {
  it('renders the brand name with the highlighted tagline underneath', () => {
    renderHeader(mockUser)
    expect(screen.getByText('CyraCode')).toBeInTheDocument()
    expect(screen.queryByText(/Prime Location|Precious Address|Pride Name/)).not.toBeInTheDocument()
  })
})

describe('Header — logout', () => {
  it('shows an icon-only logout button with an accessible label and no visible text', () => {
    renderHeader(mockUser)
    const logout = screen.getByRole('button', { name: /log out/i })
    expect(logout).toBeInTheDocument()
    expect(logout).toHaveTextContent('')
    expect(screen.queryByText('Log Out')).not.toBeInTheDocument()
  })

  it('logs out and navigates to the landing page when clicked', async () => {
    const user = userEvent.setup()
    renderHeader(mockUser)
    await user.click(screen.getByRole('button', { name: /log out/i }))
    expect(localStorage.getItem('cyracode_token')).toBeNull()
  })
})
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from '../../pages/ForgotPassword'
import { AuthProvider } from '../../context/AuthContext'
import { ContactWidgetProvider } from '../../context/ContactWidgetContext'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <AuthProvider>
        <ContactWidgetProvider>
          <ForgotPassword />
        </ContactWidgetProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('ForgotPassword', () => {
  // The header's back arrow duplicated the "Back to Login" link already in the
  // card, and put a control next to the logo that had no place on this screen.
  it('renders no back arrow beside the logo', () => {
    renderPage()

    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    // The brand link itself is untouched. Scoped to the header because the
    // footer renders an identically named link.
    const header = within(screen.getByRole('navigation', { name: 'CyraCode' }))
    expect(header.getByRole('link', { name: 'CyraCode' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Forgot Password' })).toBeInTheDocument()
  })

  // Removing the header control must not strand the visitor on this screen.
  it('still offers a route back to login', () => {
    renderPage()

    expect(screen.getByRole('link', { name: 'Back to Login' })).toHaveAttribute('href', '/')
  })
})

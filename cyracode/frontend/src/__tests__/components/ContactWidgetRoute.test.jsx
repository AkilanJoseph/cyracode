import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ContactWidgetRoute from '../../components/common/ContactWidgetRoute'
import Footer from '../../components/common/Footer'
import { AuthProvider } from '../../context/AuthContext'
import { ContactWidgetProvider } from '../../context/ContactWidgetContext'

function renderAt(path, ui) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <ContactWidgetProvider>{ui}</ContactWidgetProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('ContactWidgetRoute', () => {
  it('shows the launcher on a public route', () => {
    renderAt('/', <ContactWidgetRoute />)
    expect(screen.getByTestId('contact-launcher')).toBeInTheDocument()
  })

  it('hides the widget on the admin dashboard', () => {
    renderAt('/admin', <ContactWidgetRoute />)
    expect(screen.queryByTestId('contact-launcher')).not.toBeInTheDocument()
  })

  it('hides the widget on nested admin routes', () => {
    renderAt('/admin/clients', <ContactWidgetRoute />)
    expect(screen.queryByTestId('contact-launcher')).not.toBeInTheDocument()
  })

  it('does not confuse a public path that merely starts with the string "admin"', () => {
    // Guard is on path segments, so /administrators-style paths must stay public.
    renderAt('/admins-and-support', <ContactWidgetRoute />)
    expect(screen.getByTestId('contact-launcher')).toBeInTheDocument()
  })

  it('is opened by the footer Support button', async () => {
    const user = userEvent.setup()
    renderAt(
      '/',
      <>
        <ContactWidgetRoute />
        <Footer />
      </>
    )

    expect(screen.queryByTestId('contact-widget')).not.toBeInTheDocument()

    // Scoped to the footer: the floating launcher is also named "Contact us"
    // (the launcher hides its label with display:none, so its accessible name
    // comes from aria-label), and both controls open the same panel.
    const footerButton = within(
      document.querySelector('footer')
    ).getByRole('button', { name: 'Contact us' })
    await user.click(footerButton)

    expect(screen.getByTestId('contact-widget')).toBeInTheDocument()
    expect(screen.getByTestId('contact-launcher')).toHaveAttribute('aria-expanded', 'true')
  })
})

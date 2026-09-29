import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Footer from '../../components/common/Footer'
import { AuthProvider } from '../../context/AuthContext'
import { ContactWidgetProvider } from '../../context/ContactWidgetContext'

const mockUser = {
  id: 'user-test-id',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  is_email_verified: false,
  role: 'user',
}

function renderFooter(props = {}) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ContactWidgetProvider>
          <Footer {...props} />
        </ContactWidgetProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Footer', () => {
  it('shows the brand and the slogan', () => {
    renderFooter()

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByText('CyraCode')).toBeInTheDocument()
    // Each tagline phrase is its own line under the logo, so assert on the
    // block elements rather than a single space-joined text match.
    const lines = footer.querySelectorAll('.block')
    expect(Array.from(lines).map((el) => el.textContent)).toEqual([
      'Prime Location,',
      'Precious Address,',
      'Pride Name',
    ])
  })

  it('groups the links under Product, Account, Legal and Support', () => {
    renderFooter()

    const product = screen.getByRole('navigation', { name: 'Product' })
    expect(within(product).getByRole('link', { name: 'Pricing' }).getAttribute('href')).toBe('/pricing')
    expect(within(product).getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe('/docs')
    expect(within(product).getByRole('link', { name: 'Blog' }).getAttribute('href')).toBe('/blog')

    const account = screen.getByRole('navigation', { name: 'Account' })
    expect(within(account).getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe('/dashboard')
    expect(within(account).getByRole('link', { name: 'Manage CyraCodes' }).getAttribute('href')).toBe('/manage-cyracodes')
    expect(within(account).getByRole('link', { name: 'Orders & Invoices' }).getAttribute('href')).toBe('/orders')

    const legal = screen.getByRole('navigation', { name: 'Legal' })
    expect(within(legal).getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe('/privacy')

    // Support sits after Legal. It opens the Contact-us widget rather than a
    // mailto, so it must be a button, not a link.
    const support = screen.getByRole('navigation', { name: 'Support' })
    expect(within(support).getByRole('button', { name: 'Contact us' })).toBeInTheDocument()
    expect(within(support).queryByRole('link')).not.toBeInTheDocument()
  })

  it('lists Search a CyraCode under Account, directly below Manage CyraCodes', () => {
    renderFooter()

    // It used to live in the Product column. It is an account action, so it
    // must not be offered twice.
    const product = screen.getByRole('navigation', { name: 'Product' })
    expect(within(product).queryByRole('link', { name: 'Search a CyraCode' })).not.toBeInTheDocument()

    const account = screen.getByRole('navigation', { name: 'Account' })
    const search = within(account).getByRole('link', { name: 'Search a CyraCode' })
    expect(search.getAttribute('href')).toBe('/search')

    // Assert the full order, since the position below Manage CyraCodes is the
    // requirement and membership alone would not catch a move back to the top.
    expect(within(account).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/dashboard',
      '/manage-cyracodes',
      '/search',
      '/orders',
    ])
  })

  it('nests Support inside the Legal column as a row below it', () => {
    renderFooter()

    const legal = screen.getByRole('navigation', { name: 'Legal' })
    const support = screen.getByRole('navigation', { name: 'Support' })

    // Same grid column, i.e. Support is a row inside Legal's div, not a 4th column.
    expect(support.parentElement).toBe(legal.parentElement)
    expect(support.parentElement.tagName).toBe('DIV')

    // Rendered after Legal in document order.
    const headings = within(screen.getByRole('contentinfo'))
      .getAllByRole('navigation')
      .map((nav) => nav.getAttribute('aria-label'))
    expect(headings).toEqual(['Product', 'Account', 'Legal', 'Support', 'Follow us'])
  })

  it('keeps the full footer to four grid columns', () => {
    renderFooter()

    const grid = screen.getByRole('contentinfo').querySelector('.grid')
    // Brand + Product + Account + Legal. Support lives inside Legal, so it
    // must not add a fifth child and push the layout onto a second row.
    expect(grid.children).toHaveLength(4)
  })

  it('renders the copyright line with the current year', () => {
    renderFooter()

    const year = new Date().getFullYear()
    expect(screen.getByText(new RegExp(`©\\s*${year}\\s*CyraCode\\.\\s*All rights reserved\\.`))).toBeInTheDocument()
  })

  it('points the brand at the dashboard for a signed-in user', () => {
    localStorage.setItem('cyracode_token', 'mock-jwt-token')
    localStorage.setItem('cyracode_user', JSON.stringify(mockUser))
    renderFooter()

    const brand = screen.getByRole('link', { name: 'CyraCode' })
    expect(brand.getAttribute('href')).toBe('/dashboard')
  })

  it('applies the maxWidth prop to the inner container', () => {
    const { container } = renderFooter({ maxWidth: 'max-w-7xl' })

    const footer = screen.getByRole('contentinfo')
    const inner = footer.firstElementChild
    expect(inner.className).toContain('max-w-7xl')
    expect(container).toBeTruthy()
  })

  it('offers the social links on the full footer', () => {
    renderFooter()

    const socials = within(screen.getByRole('contentinfo')).getByRole('navigation', { name: 'Follow us' })
    const links = within(socials).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://x.com/cyracode',
      'https://facebook.com/cyracode',
      'https://instagram.com/cyracode',
      'https://linkedin.com/company/cyracode',
      'https://youtube.com/@cyracode',
    ])
    // Every link is labelled for assistive tech, not icon-only.
    expect(links.map((a) => a.getAttribute('aria-label'))).toEqual([
      'X',
      'Facebook',
      'Instagram',
      'LinkedIn',
      'YouTube',
    ])
    links.forEach((a) => {
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    })
  })
})

describe('Footer — minimal variant', () => {
  it('shows only the brand, slogan, social links and copyright', () => {
    renderFooter({ variant: 'minimal', maxWidth: 'max-w-5xl' })

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByText('CyraCode')).toBeInTheDocument()
    // The admin footer keeps the slogan on one line, unlike the client footer's
    // stacked layout.
    expect(footer.querySelectorAll('.block')).toHaveLength(0)
    expect(footer.textContent).toContain('Prime Location, Precious Address, Pride Name')

    const year = new Date().getFullYear()
    expect(within(footer).getByText(new RegExp(`©\\s*${year}\\s*CyraCode\\.\\s*All rights reserved\\.`))).toBeInTheDocument()

    // The social row is kept, the link columns are not.
    expect(within(footer).getByRole('navigation', { name: 'Follow us' })).toBeInTheDocument()
    expect(within(footer).queryByRole('navigation', { name: 'Product' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('navigation', { name: 'Account' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('navigation', { name: 'Legal' })).not.toBeInTheDocument()
    // Support is public/user only, so it must not leak into the admin footer.
    expect(within(footer).queryByRole('navigation', { name: 'Support' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('button', { name: 'Contact us' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('link', { name: 'Pricing' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('link', { name: 'Privacy Policy' })).not.toBeInTheDocument()
  })

  it('applies the maxWidth prop', () => {
    renderFooter({ variant: 'minimal', maxWidth: 'max-w-5xl' })

    expect(screen.getByRole('contentinfo').firstElementChild.className).toContain('max-w-5xl')
  })
})

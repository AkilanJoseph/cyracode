import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Footer from '../../components/common/Footer'
import { AuthProvider } from '../../context/AuthContext'

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
        <Footer {...props} />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Footer', () => {
  it('shows the brand and the slogan', () => {
    renderFooter()

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByText('CyraCode')).toBeInTheDocument()
    // The tagline is rendered as discrete comma-separated phrases, so assert on
    // the concatenated text rather than a single-element text match.
    expect(footer.textContent).toContain('Prime Location, Precious Address, Pride Name')
  })

  it('groups the links under Product, Account, Legal and Support', () => {
    renderFooter()

    const product = screen.getByRole('navigation', { name: 'Product' })
    expect(within(product).getByRole('link', { name: 'Search a CyraCode' }).getAttribute('href')).toBe('/search')
    expect(within(product).getByRole('link', { name: 'Pricing' }).getAttribute('href')).toBe('/pricing')
    expect(within(product).getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe('/docs')
    expect(within(product).getByRole('link', { name: 'Blog' }).getAttribute('href')).toBe('/blog')

    const account = screen.getByRole('navigation', { name: 'Account' })
    expect(within(account).getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe('/dashboard')
    expect(within(account).getByRole('link', { name: 'Manage CyraCodes' }).getAttribute('href')).toBe('/manage-cyracodes')
    expect(within(account).getByRole('link', { name: 'Orders & Invoices' }).getAttribute('href')).toBe('/orders')

    const legal = screen.getByRole('navigation', { name: 'Legal' })
    expect(within(legal).getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe('/privacy')

    // Support sits after Legal and exposes the address as a mailto link.
    const support = screen.getByRole('navigation', { name: 'Support' })
    const mail = within(support).getByRole('link', { name: 'support@cyracode.com' })
    expect(mail.getAttribute('href')).toBe('mailto:support@cyracode.com')
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
    expect(within(footer).queryByRole('link', { name: 'support@cyracode.com' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('link', { name: 'Pricing' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('link', { name: 'Privacy Policy' })).not.toBeInTheDocument()
  })

  it('applies the maxWidth prop', () => {
    renderFooter({ variant: 'minimal', maxWidth: 'max-w-5xl' })

    expect(screen.getByRole('contentinfo').firstElementChild.className).toContain('max-w-5xl')
  })
})

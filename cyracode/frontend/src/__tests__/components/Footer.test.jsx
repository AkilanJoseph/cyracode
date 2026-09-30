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

  it('groups the links under Product and Legal', () => {
    renderFooter()

    // Docs and Blog moved to the Support column, so Product is Pricing only.
    const product = screen.getByRole('navigation', { name: 'Product' })
    expect(within(product).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/pricing'])

    const legal = screen.getByRole('navigation', { name: 'Legal' })
    expect(within(legal).getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe('/privacy')
  })

  it('lists the Support links in order with Contact us last', () => {
    renderFooter()

    const support = screen.getByRole('navigation', { name: 'Support' })

    // Full order is the requirement, so assert the whole list rather than
    // membership: Blog, Docs, FAQs, then Contact us.
    const hrefs = within(support)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['/blog', '/docs', '/faqs'])

    // Contact us opens the Contact-us widget rather than a mailto, so it must
    // be a button, and it must come after the reference links.
    const contact = within(support).getByRole('button', { name: 'Contact us' })
    const labels = [...support.querySelectorAll('a, button')].map(
      (el) => el.textContent
    )
    expect(labels[labels.length - 1]).toBe(contact.textContent)
    expect(within(support).queryByRole('link', { name: 'Contact us' })).not.toBeInTheDocument()
  })

  it('hides the Sitemap link for now but leaves the route working', () => {
    renderFooter()

    const footer = screen.getByRole('contentinfo')
    // Hidden from the footer entirely, not just visually downgraded.
    expect(footer.querySelector('a[href="/sitemap"]')).toBeNull()
    expect(
      within(screen.getByRole('navigation', { name: 'Support' })).queryByRole('link', { name: 'Sitemap' })
    ).not.toBeInTheDocument()

    // Its siblings must be unaffected.
    const support = screen.getByRole('navigation', { name: 'Support' })
    expect(within(support).getByRole('link', { name: 'FAQs' })).toBeInTheDocument()
    expect(within(support).getByRole('button', { name: 'Contact us' })).toBeInTheDocument()
  })

  it('renders Support as its own column rather than inside Legal', () => {
    renderFooter()

    const product = screen.getByRole('navigation', { name: 'Product' })
    const legal = screen.getByRole('navigation', { name: 'Legal' })
    const support = screen.getByRole('navigation', { name: 'Support' })

    // A sibling column: each group owns its own grid cell.
    expect(support.parentElement).not.toBe(legal.parentElement)
    expect(support.parentElement).not.toBe(product.parentElement)
    expect(legal.parentElement).not.toBe(product.parentElement)

    const headings = within(screen.getByRole('contentinfo'))
      .getAllByRole('navigation')
      .map((nav) => nav.getAttribute('aria-label'))
    expect(headings).toEqual(['Product', 'Legal', 'Support', 'Follow us'])
  })

  it('lists Docs and Blog only under Support, never under Product', () => {
    renderFooter()

    const footer = screen.getByRole('contentinfo')
    // Same target reachable from two columns would duplicate it for visitors
    // and screen readers.
    for (const href of ['/docs', '/blog']) {
      expect(footer.querySelectorAll(`a[href="${href}"]`)).toHaveLength(1)
    }
  })

  it('hides the Sales and Account columns for now', () => {
    renderFooter()

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).queryByRole('navigation', { name: 'Sales' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('navigation', { name: 'Account' })).not.toBeInTheDocument()

    // Their links must disappear entirely rather than being left orphaned in
    // another column. Dashboard and Search are reachable from the app itself.
    for (const href of ['/orders', '/dashboard', '/manage-cyracodes', '/search']) {
      expect(footer.querySelector(`a[href="${href}"]`)).toBeNull()
    }
  })

  it('lays the remaining columns out on one row with the brand spanning two tracks', () => {
    renderFooter()

    const grid = screen.getByRole('contentinfo').querySelector('.grid')
    // Brand + Product + Legal + Support. The hidden Sales and Account groups are
    // skipped, so nothing spills onto a second row.
    expect(grid.children).toHaveLength(4)

    // Brand takes two of five tracks and each menu group one, which is exactly
    // 2 + 3 = 5. A stale column count would orphan the last group.
    expect(grid.className).toContain('lg:grid-cols-5')
    expect(grid.firstElementChild.className).toContain('lg:col-span-2')

    // Responsive at every breakpoint: stacked on phones, one even row of menu
    // groups from sm up.
    expect(grid.className).toContain('grid-cols-1')
    expect(grid.className).toContain('sm:grid-cols-3')
    expect(grid.firstElementChild.className).toContain('sm:col-span-3')
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
    expect(within(footer).queryByRole('navigation', { name: 'Sales' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('navigation', { name: 'Account' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('navigation', { name: 'Legal' })).not.toBeInTheDocument()
    // Support is public/user only, so it must not leak into the admin footer.
    expect(within(footer).queryByRole('navigation', { name: 'Support' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('button', { name: 'Contact us' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('link', { name: 'Pricing' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('link', { name: 'Privacy Policy' })).not.toBeInTheDocument()
  })

  it('shows the support email for queries as a mailto link on its own line', () => {
    renderFooter()

    const footer = screen.getByRole('contentinfo')
    const lead = within(footer).getByText('For any queries, write us an email at:')
    expect(lead).toBeInTheDocument()
    // The address sits below the sentence rather than being wrapped into it.
    expect(lead.querySelector('a')).toBeNull()

    // Clicking the address hands off to the visitor's mail client.
    const mail = within(footer).getByRole('link', { name: 'support@cyracode.com' })
    expect(mail.getAttribute('href')).toBe('mailto:support@cyracode.com')
    expect(mail.className).toContain('whitespace-nowrap')
  })

  it('keeps the queries email out of the admin footer', () => {
    renderFooter({ variant: 'minimal' })

    // The admin module has no enquiry path, so the address must not be there.
    expect(screen.getByRole('contentinfo').textContent).not.toContain('support@cyracode.com')
  })

  it('applies the maxWidth prop', () => {
    renderFooter({ variant: 'minimal', maxWidth: 'max-w-5xl' })

    expect(screen.getByRole('contentinfo').firstElementChild.className).toContain('max-w-5xl')
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import { ContactWidgetProvider } from '../../context/ContactWidgetContext'
import FAQPage from '../../pages/FAQPage'
import { FAQ_CATEGORIES } from '../../lib/faqs'
import en from '../../i18n/locales/en.json'

// Locale files nest their namespaces under `translation`, which is what i18next
// reads via defaultNS.
const EN_FAQ = en.translation.faq

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/faqs']}>
      <ContactWidgetProvider>
        <AuthProvider>
          <FAQPage />
        </AuthProvider>
      </ContactWidgetProvider>
    </MemoryRouter>
  )
}

describe('FAQPage', () => {
  it('renders the FAQ page heading instead of the coming-soon placeholder', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Frequently Asked Questions' })
    ).toBeInTheDocument()
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })

  it('renders all eight categories in the documented order', () => {
    renderPage()
    // The page also has an h2 on the closing contact block, so only the first
    // eight level-2 headings are the categories.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings.slice(0, 8)).toEqual([
      'General',
      'Registration',
      'Location and Address',
      'Manage CyraCodes',
      'Account and Security',
      'Plans and Pricing',
      'Payments',
      'Subscription and Billing',
    ])
  })

  it('starts with every question collapsed and no answer reachable', () => {
    renderPage()
    // Scoped to <main> so the header/footer buttons, which carry no
    // aria-expanded, are not counted as collapsed questions.
    const buttons = within(screen.getByRole('main')).getAllByRole('button', { expanded: false })
    expect(buttons.length).toBe(FAQ_CATEGORIES.reduce((n, c) => n + c.items.length, 0))

    // Answer panels are unmounted while closed, so nothing is exposed to a
    // screen reader or findable by search until the question is opened. The
    // only landmarks left are the eight category sections, which are `region`s
    // too because they carry an aria-labelledby heading.
    expect(screen.getAllByRole('region')).toHaveLength(FAQ_CATEGORIES.length)
    expect(screen.queryByRole('region', { name: 'What is CyraCode?' })).not.toBeInTheDocument()
  })

  it('expands an answer when its question is clicked', () => {
    renderPage()
    const button = screen.getByRole('button', { name: 'What is CyraCode?' })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    const panel = screen.getByRole('region', { name: 'What is CyraCode?' })
    expect(panel).toHaveAttribute('id', button.getAttribute('aria-controls'))
    expect(panel).toHaveTextContent(/shareable digital address/i)
  })

  it('collapses the answer again on a second click', () => {
    renderPage()
    const button = screen.getByRole('button', { name: 'What is CyraCode?' })

    fireEvent.click(button)
    fireEvent.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'What is CyraCode?' })).not.toBeInTheDocument()
  })

  it('keeps each answer independent so several can be open at once', () => {
    renderPage()
    const first = screen.getByRole('button', { name: 'What is CyraCode?' })
    const second = screen.getByRole('button', { name: 'How do I get started?' })

    fireEvent.click(first)
    fireEvent.click(second)

    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(second).toHaveAttribute('aria-expanded', 'true')
    // Eight category sections plus the two newly opened answer panels.
    expect(screen.getAllByRole('region')).toHaveLength(FAQ_CATEGORIES.length + 2)
  })

  it('links the category jump list to each section heading', () => {
    renderPage()
    for (const category of FAQ_CATEGORIES) {
      const link = screen.getByRole('link', { name: EN_FAQ.categories[category.id] })
      expect(link.getAttribute('href')).toBe(`#faq-${category.id}`)
      expect(document.getElementById(`faq-${category.id}`)).toBeInTheDocument()
    }
  })
})

describe('FAQ content', () => {
  it('covers every category with a translated heading and at least one question', () => {
    expect(FAQ_CATEGORIES).toHaveLength(8)
    for (const category of FAQ_CATEGORIES) {
      // Guards against adding a category without its heading key, which would
      // render the raw `faq.categories.<id>` string on the page.
      expect(EN_FAQ.categories[category.id], `missing heading for ${category.id}`).toBeTruthy()
      expect(category.items.length).toBeGreaterThan(0)
    }
  })

  it('uses unique ids and non-empty questions and answers throughout', () => {
    const ids = FAQ_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)

    const questions = FAQ_CATEGORIES.flatMap((c) => c.items.map((i) => i.q))
    expect(new Set(questions).size).toBe(questions.length)
    expect(questions.length).toBeGreaterThanOrEqual(40)

    for (const category of FAQ_CATEGORIES) {
      for (const item of category.items) {
        expect(item.q.trim(), 'blank question').not.toBe('')
        expect(item.a.trim(), `blank answer for "${item.q}"`).not.toBe('')
      }
    }
  })

  it('never asks the reader for something the product does not implement', () => {
    const answers = FAQ_CATEGORIES.flatMap((c) => c.items.map((i) => i.a)).join(' ')
    // There is no SMS/OTP step at registration.
    expect(answers).not.toMatch(/\bOTP\b|one-time pass/i)
    expect(answers).not.toMatch(/enter (the |your )?(verification|security|otp) code/i)
    // Coordinates are read-only and always follow the map pin.
    expect(answers).not.toMatch(/type (your )?(latitude|longitude)/i)
    // Addresses are typed, not reverse-geocoded from the pin.
    expect(answers).not.toMatch(/filled? in automatically (from|using) (your )?(map|pin)/i)
  })
})

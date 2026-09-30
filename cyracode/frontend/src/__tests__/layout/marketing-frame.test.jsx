import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import { ContactWidgetProvider } from '../../context/ContactWidgetContext'
import FAQPage from '../../pages/FAQPage'
import PricingPage from '../../pages/PricingPage'
import PaymentPage from '../../pages/PaymentPage'
import PrivacyPolicy from '../../pages/PrivacyPolicy'
import { ComingSoonPage } from '../../App'
import { MARKETING_MAX_WIDTH, MARKETING_PADDING_Y, MARKETING_HERO_TITLE_CLASS } from '../../lib/layout'

// Header and Footer both apply the passed width to a single inner container:
//   <div className={`${maxWidth} mx-auto px-4 h-14 ...`}>   (header nav)
//   <footer>...<div className={`${maxWidth} mx-auto ...`}> (footer)
const headerBar = () => document.querySelector(`nav .${MARKETING_MAX_WIDTH}`)
const footerInner = () => screen.getByRole('contentinfo').firstElementChild
const mainFrame = () => document.querySelector('main#main-content')

function renderMarketingPage(ui, entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ContactWidgetProvider>
        <AuthProvider>{ui}</AuthProvider>
      </ContactWidgetProvider>
    </MemoryRouter>
  )
}

const pages = [
  ['FAQ', <FAQPage key="faq" />, '/faqs'],
  ['Pricing', <PricingPage key="pricing" />, '/pricing?plan=growth&billing=monthly'],
  ['Payment', <PaymentPage key="payment" />, '/payment?plan=growth&billing=monthly'],
  ['Privacy', <PrivacyPolicy key="privacy" />, '/privacy'],
]

// These pages each hand-wrote their own width, which is how they drifted apart:
// the FAQ shell was max-w-4xl while its own header was max-w-6xl, pricing ran
// at max-w-7xl (wider than the landing hero it links from), and the payment
// confirmation and missing-plan views dropped to max-w-2xl / max-w-xl. Header,
// content and footer have to share one frame so the pages read as one site.
describe('marketing page frame', () => {
  it.each(pages)('%s matches the landing hero width', (_name, ui, entry) => {
    const { unmount } = renderMarketingPage(ui, entry)

    expect(headerBar()).toHaveClass(MARKETING_MAX_WIDTH)
    expect(mainFrame()).toHaveClass(MARKETING_MAX_WIDTH, 'px-4', MARKETING_PADDING_Y)
    expect(footerInner()).toHaveClass(MARKETING_MAX_WIDTH)
    // h-14 is the header bar height; the content frame must not inherit it.
    expect(headerBar().className).toContain('h-14')

    unmount()
  })
})

describe('payment page branches', () => {
  it('keeps the frame when no plan is selected', () => {
    renderMarketingPage(<PaymentPage />, '/payment')

    expect(headerBar()).toHaveClass(MARKETING_MAX_WIDTH)
    expect(mainFrame()).toHaveClass(MARKETING_MAX_WIDTH, MARKETING_PADDING_Y)
    expect(footerInner()).toHaveClass(MARKETING_MAX_WIDTH)
  })

  // The success screen is only reachable by completing a payment, so its frame
  // is asserted in PaymentPage.test.jsx where that flow already runs.
})

describe('FAQ readability', () => {
  it('keeps long answers in a centred column, not the full frame', () => {
    renderMarketingPage(<FAQPage />, '/faqs')

    // The frame matches the hero, but a 1000px-wide paragraph is unreadable.
    const sections = document.querySelectorAll('main#main-content section[aria-labelledby]')
    expect(sections.length).toBeGreaterThan(0)
    sections.forEach((section) => {
      expect(section).toHaveClass('max-w-3xl', 'mx-auto')
    })
  })
})

// /docs, /blog and /sitemap all render ComingSoonPage. It already used the
// marketing nav, but its <main> and footer were left at max-w-3xl, so the
// placeholder rendered narrower than the hero the nav links from.
describe('coming soon placeholder frame', () => {
  it.each([
    ['Docs', 'Docs'],
    ['Blog', 'Blog'],
    ['Sitemap', 'Sitemap'],
  ])('%s uses the shared marketing frame', (_label, title) => {
    renderMarketingPage(<ComingSoonPage title={title} />)

    expect(headerBar()).toHaveClass(MARKETING_MAX_WIDTH)
    expect(mainFrame()).toHaveClass(MARKETING_MAX_WIDTH, 'px-4', MARKETING_PADDING_Y)
    expect(footerInner()).toHaveClass(MARKETING_MAX_WIDTH)
  })

  it('keeps the marketing nav, so the placeholder links are reachable', () => {
    renderMarketingPage(<ComingSoonPage title="Docs" />)
    // The footer also links to /pricing, so scope to the header bar.
    expect(headerBar().className).toContain('h-14')
    expect(within(headerBar()).getByRole('link', { name: 'Pricing' })).toBeInTheDocument()
  })

  it('stays centred for the coming-soon message', () => {
    renderMarketingPage(<ComingSoonPage title="Docs" />)
    expect(mainFrame()).toHaveClass('text-center')
  })

  // The frame matched but the headline did not: the hero renders at text-6xl
  // while the placeholder rendered at text-3xl, so the same frame held
  // headlines two steps apart. Both now read one shared constant.
  it('uses the landing hero headline scale', () => {
    renderMarketingPage(<ComingSoonPage title="Docs" />)

    const heading = mainFrame().querySelector('h1')
    expect(heading).toHaveTextContent('Docs')
    MARKETING_HERO_TITLE_CLASS.split(' ').forEach((token) => {
      expect(heading.classList.contains(token)).toBe(true)
    })
    expect(heading.className).toBe(MARKETING_HERO_TITLE_CLASS)
  })

  it('no longer renders the small text-3xl heading', () => {
    renderMarketingPage(<ComingSoonPage title="Blog" />)
    const heading = mainFrame().querySelector('h1')
    expect(heading.className).not.toContain('text-3xl')
  })
})

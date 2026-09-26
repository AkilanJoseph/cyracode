import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import PricingPage from '../../pages/PricingPage'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/pricing']}>
      <AuthProvider>
        <PricingPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('PricingPage', () => {
  it('renders all five plans from the public catalog', async () => {
    renderPage()
    const growthCard = within(await screen.findByTestId('plan-growth'))
    expect(growthCard.getByText('Growth')).toBeInTheDocument()
    for (const name of ['Sandbox', 'Developer', 'Scale', 'Enterprise']) {
      expect(within(screen.getByTestId(`plan-${name.toLowerCase()}`)).getByText(name)).toBeInTheDocument()
    }
  })

  it('marks Growth as the Most called plan and links to checkout', async () => {
    renderPage()
    const card = within(await screen.findByTestId('plan-growth'))
    expect(card.getByText('Most called')).toBeInTheDocument()
    const cta = card.getByRole('link', { name: /get started/i })
    expect(cta.getAttribute('href')).toBe('/payment?plan=growth&billing=monthly')
  })

  it('sends Enterprise buyers to sales and Sandbox to free signup', async () => {
    renderPage()
    const enterprise = within(await screen.findByTestId('plan-enterprise'))
    expect(enterprise.getByRole('link', { name: /contact sales/i }).getAttribute('href')).toBe(
      'mailto:sales@cyracode.com'
    )
    const sandbox = within(await screen.findByTestId('plan-sandbox'))
    expect(sandbox.getByRole('link', { name: /start free/i }).getAttribute('href')).toBe(
      '/register/auto-generate'
    )
  })

  it('shows monthly pricing by default and annual totals after toggling', async () => {
    renderPage()
    const growth = within(await screen.findByTestId('plan-growth'))
    expect(growth.getByText('$99')).toBeInTheDocument()
    expect(growth.getByText('billed monthly')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Annual' }))
    expect(await screen.findByText('$79')).toBeInTheDocument()
    expect(screen.getByText('billed $948/year')).toBeInTheDocument()
    expect(screen.getByText('Save 20%')).toBeInTheDocument()
  })

  it('recommends a plan from the volume slider', async () => {
    renderPage()
    const box = within(await screen.findByTestId('recommendation-box'))
    expect(box.getByText('Growth')).toBeInTheDocument()

    fireEvent.change(document.getElementById('volume-slider'), { target: { value: '15' } })
    expect(await screen.findByTestId('recommendation-box')).toBeInTheDocument()
    expect(box.getByText('Enterprise')).toBeInTheDocument()

    fireEvent.change(document.getElementById('volume-slider'), { target: { value: '0.3' } })
    expect(box.getByText('Developer')).toBeInTheDocument()
  })

  it('renders the comparison table with all plans', async () => {
    renderPage()
    expect(await screen.findByText('Compare plans')).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByText('Feature')).toBeInTheDocument()
    expect(within(table).getAllByRole('columnheader')).toHaveLength(6)
    expect(screen.getByText('Secure checkout. Instant activation. Cancel anytime.')).toBeInTheDocument()
  })

  it('reads the billing frequency from the URL query', async () => {
    render(
      <MemoryRouter initialEntries={['/pricing?billing=annual']}>
        <AuthProvider>
          <PricingPage />
        </AuthProvider>
      </MemoryRouter>
    )
    expect(await screen.findByText('billed $948/year')).toBeInTheDocument()
  })
})
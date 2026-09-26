import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import PaymentPage from '../../pages/PaymentPage'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('react-hot-toast', () => ({
  default: toastMock,
  Toaster: () => null,
}))

function renderPage(plan = 'growth', billing = 'monthly') {
  const user = userEvent.setup()
  const utils = render(
    <MemoryRouter initialEntries={[`/payment?plan=${plan}&billing=${billing}`]}>
      <AuthProvider>
        <PaymentPage />
      </AuthProvider>
    </MemoryRouter>
  )
  return { user, ...utils }
}

async function fillInvoice(user) {
  await user.type(screen.getAllByLabelText('Company Name or Name')[0], 'Acme Ltd')
  await user.type(screen.getAllByLabelText('Address 1')[0], '12 MG Road')
  await user.type(screen.getAllByLabelText('City')[0], 'Delhi')
  await user.type(screen.getAllByLabelText('State')[0], 'Delhi')
  await user.type(screen.getAllByLabelText('Postal / ZIP Code')[0], '110001')
  await user.selectOptions(screen.getAllByLabelText('Country')[0], 'IN')
}

async function sameAsInvoice(user) {
  await user.click(screen.getByRole('checkbox', { name: /billing address is the same as the invoice address/i }))
}

describe('PaymentPage', () => {
  it('shows the order summary for the selected plan', async () => {
    renderPage('growth', 'monthly')
    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeInTheDocument()
    expect(screen.getByText('Growth')).toBeInTheDocument()
    expect(screen.getByText('$99')).toBeInTheDocument()
    expect(screen.getByText('$18')).toBeInTheDocument()
    expect(screen.getByText('$117')).toBeInTheDocument()
  })

  it('charges the annual price when billing=annual', async () => {
    renderPage('growth', 'annual')
    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeInTheDocument()
    expect(screen.getByText('$948')).toBeInTheDocument()
    expect(screen.getByText('$171')).toBeInTheDocument()
    expect(screen.getByText('$1,119')).toBeInTheDocument()
  })

  it('redirects to pricing when no valid plan is selected', async () => {
    renderPage('nope', 'monthly')
    expect(await screen.findByText('Please choose a plan before checking out.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /continue/i }).getAttribute('href')).toBe('/pricing')
  })

  it('switches between payment methods', async () => {
    const { user } = renderPage('growth', 'monthly')
    await user.click(await screen.findByRole('tab', { name: /net banking/i }))
    expect(screen.getByLabelText('Select your bank')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'UPI' }))
    expect(screen.getByLabelText('UPI ID')).toBeInTheDocument()
    expect(screen.getByLabelText('Mobile number')).toBeInTheDocument()
  })

  it('validates required card fields before submitting', async () => {
    const { user } = renderPage('growth', 'monthly')
    await user.click(await screen.findByRole('button', { name: /pay with card/i }))
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith('Please fix the highlighted fields.')
    })
    expect(screen.getAllByText('This field is required').length).toBeGreaterThanOrEqual(4)
  })

  it('shows a decline reason for an insufficient-funds card', async () => {
    const { user } = renderPage('growth', 'monthly')
    await user.type(await screen.findByLabelText('Email'), 'buyer@example.com')
    await fillInvoice(user)
    await sameAsInvoice(user)
    await user.type(screen.getByLabelText('Cardholder name'), 'Jane Doe')
    await user.type(screen.getByLabelText('Card number'), '4000000000000002')
    await user.type(screen.getByLabelText('Expiry'), '12/30')
    await user.type(screen.getByLabelText('CVV'), '123')
    await user.click(screen.getByRole('button', { name: /pay with card/i }))
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith('Card declined — insufficient funds.')
    })
  })

  it('locks the payment form after three failed attempts', async () => {
    const { user } = renderPage('growth', 'monthly')
    await user.type(await screen.findByLabelText('Email'), 'buyer@example.com')
    await fillInvoice(user)
    await sameAsInvoice(user)
    await user.type(screen.getByLabelText('Cardholder name'), 'Jane Doe')
    await user.type(screen.getByLabelText('Card number'), '4000000000000002')
    await user.type(screen.getByLabelText('Expiry'), '12/30')
    await user.type(screen.getByLabelText('CVV'), '123')
    const pay = screen.getByRole('button', { name: /pay with card/i })
    for (let i = 0; i < 3; i += 1) {
      await user.click(pay)
      await waitFor(() => {
        expect(toastMock.error).toHaveBeenCalledWith('Card declined — insufficient funds.')
      })
    }
    expect(
      await screen.findByText(/too many failed attempts\. payments are temporarily locked/i)
    ).toBeInTheDocument()
    expect(pay).toBeDisabled()
  })

  it('completes a UPI payment and shows the API key once', async () => {
    vi.stubGlobal('scrollTo', vi.fn())
    const { user } = renderPage('growth', 'monthly')
    await user.click(await screen.findByRole('tab', { name: 'UPI' }))
    await user.type(screen.getByLabelText('Email'), 'buyer@example.com')
    await fillInvoice(user)
    await sameAsInvoice(user)
    await user.type(screen.getByLabelText('UPI ID'), 'buyer@okhdfc')
    await user.type(screen.getByLabelText('Mobile number'), '9876543210')
    await user.click(screen.getByRole('button', { name: /pay with upi/i }))

    expect(
      await screen.findByRole('heading', { name: 'Payment successful!' }, { timeout: 4000 })
    ).toBeInTheDocument()
    expect(screen.getByText(/^CYRA-\d{6}$/)).toBeInTheDocument()
    expect(screen.getByText('cyra_test_selfserve_key_9999')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy API key' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view my orders/i }).getAttribute('href')).toBe(
      '/orders?email=buyer%40example.com'
    )
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    toastMock.error.mockClear()
  }, 10000)

  it('keeps the API key visible in the copy box', async () => {
    vi.stubGlobal('scrollTo', vi.fn())
    const user = userEvent.setup()
    const navigatorWrite = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: navigatorWrite },
      writable: true,
      configurable: true,
    })
    render(
      <MemoryRouter initialEntries={['/payment?plan=growth&billing=monthly']}>
        <AuthProvider>
          <PaymentPage />
        </AuthProvider>
      </MemoryRouter>
    )
    await user.click(await screen.findByRole('tab', { name: 'UPI' }))
    await user.type(screen.getByLabelText('Email'), 'buyer@example.com')
    await fillInvoice(user)
    await sameAsInvoice(user)
    await user.type(screen.getByLabelText('UPI ID'), 'buyer@okhdfc')
    await user.type(screen.getByLabelText('Mobile number'), '9876543210')
    await user.click(screen.getByRole('button', { name: /pay with upi/i }))
    const copy = await screen.findByRole('button', { name: 'Copy API key' }, { timeout: 4000 })
    await user.click(copy)
    await waitFor(() => expect(navigatorWrite).toHaveBeenCalledWith('cyra_test_selfserve_key_9999'))
    vi.unstubAllGlobals()
  }, 10000)

  describe('invoice & billing addresses', () => {
    it('renders the invoice address fields below the email field', async () => {
      renderPage('growth', 'monthly')
      await screen.findByRole('heading', { name: 'Checkout' })
      expect(screen.getByText('Invoice address')).toBeInTheDocument()
      expect(screen.getByText('Billing address')).toBeInTheDocument()
      const company = screen.getAllByLabelText('Company Name or Name')
      const addr1 = screen.getAllByLabelText('Address 1')
      const addr2 = screen.getAllByLabelText('Address 2 (optional)')
      const city = screen.getAllByLabelText('City')
      const state = screen.getAllByLabelText('State')
      const postal = screen.getAllByLabelText('Postal / ZIP Code')
      const country = screen.getAllByLabelText('Country')
      expect(company.length).toBe(2)
      expect(addr1.length).toBe(2)
      expect(addr2.length).toBe(2)
      expect(city.length).toBe(2)
      expect(state.length).toBe(2)
      expect(postal.length).toBe(2)
      expect(country.length).toBe(2)
    })

    it('shows the same-as-invoice checkbox unchecked by default', async () => {
      renderPage('growth', 'monthly')
      await screen.findByRole('heading', { name: 'Checkout' })
      const cb = screen.getByRole('checkbox', { name: /billing address is the same as the invoice address/i })
      expect(cb).not.toBeChecked()
    })

    it('copies invoice into billing and disables billing fields when checked', async () => {
      const { user } = renderPage('growth', 'monthly')
      await screen.findByRole('heading', { name: 'Checkout' })
      await fillInvoice(user)
      const cb = screen.getByRole('checkbox', { name: /billing address is the same as the invoice address/i })
      await user.click(cb)
      expect(cb).toBeChecked()
      expect(screen.getAllByDisplayValue('Acme Ltd').length).toBeGreaterThanOrEqual(2)
      // Billing-side inputs become disabled once the box is ticked.
      const billingCompany = screen.getAllByLabelText('Company Name or Name')[1]
      const billingCity = screen.getAllByLabelText('City')[1]
      expect(billingCompany).toBeDisabled()
      expect(billingCity).toBeDisabled()
    })

    it('keeps billing synchronized as the invoice address is edited', async () => {
      const { user } = renderPage('growth', 'monthly')
      await screen.findByRole('heading', { name: 'Checkout' })
      await fillInvoice(user)
      await user.click(screen.getByRole('checkbox', { name: /billing address is the same as the invoice address/i }))
      await user.clear(screen.getAllByLabelText('City')[0])
      await user.type(screen.getAllByLabelText('City')[0], 'Mumbai')
      expect(screen.getAllByDisplayValue('Mumbai').length).toBeGreaterThanOrEqual(2)
    })

    it('unchecking restores independent billing editing', async () => {
      const { user } = renderPage('growth', 'monthly')
      await screen.findByRole('heading', { name: 'Checkout' })
      await fillInvoice(user)
      await user.type(screen.getAllByLabelText('City')[1], 'Hyderabad')
      const billingCity = screen.getAllByLabelText('City')[1]
      expect(billingCity).toBeEnabled()
      const cb = screen.getByRole('checkbox', { name: /billing address is the same as the invoice address/i })
      await user.click(cb)
      expect(billingCity).toBeDisabled()
      await user.click(cb)
      expect(billingCity).toBeEnabled()
      // The previously-entered billing value is preserved.
      expect(screen.getByDisplayValue('Hyderabad')).toBeInTheDocument()
    })

    it('rejects a bad postal code for the selected country', async () => {
      const { user } = renderPage('growth', 'monthly')
      await screen.findByRole('heading', { name: 'Checkout' })
      await user.type(screen.getAllByLabelText('Company Name or Name')[0], 'Acme Ltd')
      await user.type(screen.getAllByLabelText('Address 1')[0], '12 MG Road')
      await user.type(screen.getAllByLabelText('City')[0], 'Delhi')
      await user.type(screen.getAllByLabelText('State')[0], 'Delhi')
      await user.type(screen.getAllByLabelText('Postal / ZIP Code')[0], 'ABC12')
      await user.selectOptions(screen.getAllByLabelText('Country')[0], 'IN')
      await user.click(screen.getByRole('button', { name: /pay with card/i }))
      expect(await screen.findByText(/enter a valid postal code for the selected country/i)).toBeInTheDocument()
      // Changing the country immediately re-bases postal validation.
      await user.selectOptions(screen.getAllByLabelText('Country')[0], 'US')
      await user.clear(screen.getAllByLabelText('Postal / ZIP Code')[0])
      await user.type(screen.getAllByLabelText('Postal / ZIP Code')[0], '90210')
      await user.click(screen.getByRole('button', { name: /pay with card/i }))
      expect(screen.queryByText(/enter a valid postal code for the selected country/i)).not.toBeInTheDocument()
    })

    it('validates invoice address required fields before submitting', async () => {
      const { user } = renderPage('growth', 'monthly')
      const pay = await screen.findByRole('button', { name: /pay with card/i })
      await user.click(pay)
      await waitFor(async () => {
        const required = (await screen.findAllByText('This field is required'))
        expect(required.length).toBeGreaterThanOrEqual(9)
      })
    })
  })
})
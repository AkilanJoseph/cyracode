import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import { ContactWidgetProvider } from '../../context/ContactWidgetContext'
import PaymentPage from '../../pages/PaymentPage'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('react-hot-toast', () => ({
  default: toastMock,
  Toaster: () => null,
}))

function renderPage(plan = 'growth', billing = 'monthly', { signedInAs } = {}) {
  if (signedInAs) {
    localStorage.setItem('cyracode_token', 'mock-token')
    localStorage.setItem('cyracode_user', JSON.stringify({ email: signedInAs, role: 'user' }))
  }
  const user = userEvent.setup()
  const utils = render(
    <MemoryRouter initialEntries={[`/payment?plan=${plan}&billing=${billing}`]}>
      <ContactWidgetProvider>
        <AuthProvider>
          <PaymentPage />
        </AuthProvider>
      </ContactWidgetProvider>
    </MemoryRouter>
  )
  return { user, ...utils }
}

async function fillInvoice(user) {
  await user.type(screen.getAllByLabelText('Company Name or Name')[0], 'Acme Ltd')
  // Country first: it decides which state dropdown is offered, and India
  // requires one, so the label is the "required" variant here.
  await user.selectOptions(screen.getAllByLabelText('Country')[0], 'IN')
  await user.selectOptions(screen.getAllByLabelText('State / Province / Region')[0], 'Delhi')
  await user.type(screen.getAllByLabelText('Address 1')[0], '12 MG Road')
  await user.type(screen.getAllByLabelText('City')[0], 'Delhi')
  await user.type(screen.getAllByLabelText('Postal / ZIP Code')[0], '110001')
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
    const { user } = renderPage('growth', 'monthly', { signedInAs: 'buyer@example.com' })
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
      '/orders'
    )
    // The success screen keeps the shared marketing frame; the receipt card
    // stays a readable column inside it.
    const frame = document.querySelector('main#main-content')
    expect(frame.className).toContain('max-w-6xl')
    expect(frame.firstElementChild.className).toContain('max-w-2xl')
    expect(screen.getByRole('contentinfo').firstElementChild.className).toContain('max-w-6xl')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    toastMock.error.mockClear()
  }, 10000)

  // /orders is owner-scoped behind login, so a guest checkouter must not be
  // offered a link that would bounce them to the landing page.
  it('hides the orders shortcut for a guest checkout', async () => {
    vi.stubGlobal('scrollTo', vi.fn())
    const { user } = renderPage('growth', 'monthly')
    await user.click(await screen.findByRole('tab', { name: 'UPI' }))
    await user.type(screen.getByLabelText('Email'), 'guest@example.com')
    await fillInvoice(user)
    await sameAsInvoice(user)
    await user.type(screen.getByLabelText('UPI ID'), 'guest@okhdfc')
    await user.type(screen.getByLabelText('Mobile number'), '9876543210')
    await user.click(screen.getByRole('button', { name: /pay with upi/i }))

    expect(
      await screen.findByRole('heading', { name: 'Payment successful!' }, { timeout: 4000 })
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /view my orders/i })).not.toBeInTheDocument()
    // The guest still has somewhere to go (the footer links /pricing too).
    const pricingLinks = screen.getAllByRole('link', { name: /pricing/i })
    expect(pricingLinks.some((l) => l.getAttribute('href') === '/pricing')).toBe(true)
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
        <ContactWidgetProvider>
          <AuthProvider>
            <PaymentPage />
          </AuthProvider>
        </ContactWidgetProvider>
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

  describe('PaymentPage — live validation', () => {
    it('does not flag fields before the first submit', async () => {
      const { user } = renderPage('growth', 'monthly')
      const email = await screen.findByLabelText('Email')

      // Mid-typing nothing is wrong yet, so no error should appear.
      await user.type(email, 'not-an-email')
      expect(email).not.toHaveAttribute('aria-invalid')
      expect(screen.queryByText('This field is required')).not.toBeInTheDocument()
    })

    it('clears an error as soon as the field is corrected', async () => {
      const { user } = renderPage('growth', 'monthly')
      const email = await screen.findByLabelText('Email')
      await user.click(screen.getByRole('button', { name: /pay with card/i }))

      await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'))

      await user.type(email, 'buyer@example.com')
      await waitFor(() => expect(email).not.toHaveAttribute('aria-invalid'))
    })

    it('keeps only the fields that are still wrong', async () => {
      const { user } = renderPage('growth', 'monthly')
      const email = await screen.findByLabelText('Email')
      await user.type(email, 'buyer@example.com')
      await fillInvoice(user)
      await sameAsInvoice(user)
      await user.type(screen.getByLabelText('Cardholder name'), 'Jane Doe')
      await user.type(screen.getByLabelText('Card number'), '4111111111111111')
      await user.type(screen.getByLabelText('Expiry'), '12/30')
      await user.click(screen.getByRole('button', { name: /pay with card/i }))

      const cvv = screen.getByLabelText('CVV')
      await waitFor(() => expect(cvv).toHaveAttribute('aria-invalid', 'true'))
      // Corrected fields stay clean while the untouched CVV keeps its message.
      expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid')
      expect(screen.getByLabelText('Card number')).not.toHaveAttribute('aria-invalid')

      await user.type(cvv, '123')
      await waitFor(() => expect(cvv).not.toHaveAttribute('aria-invalid'))
    })

    it('rejects a well-formed expiry date that is already past', async () => {
      const { user } = renderPage('growth', 'monthly')
      await user.type(await screen.findByLabelText('Email'), 'buyer@example.com')
      await fillInvoice(user)
      await sameAsInvoice(user)
      await user.type(screen.getByLabelText('Cardholder name'), 'Jane Doe')
      await user.type(screen.getByLabelText('Card number'), '4111111111111111')
      // 01/24 is correctly shaped but expired, so format validation alone misses it.
      await user.type(screen.getByLabelText('Expiry'), '01/24')
      await user.type(screen.getByLabelText('CVV'), '123')
      await user.click(screen.getByRole('button', { name: /pay with card/i }))

      expect(await screen.findByText('This card has expired')).toBeInTheDocument()
    })

    it('announces a bank select error and clears it on change', async () => {
      const { user } = renderPage('growth', 'monthly')
      await user.click(await screen.findByRole('tab', { name: /net banking/i }))
      const bank = screen.getByLabelText('Select your bank')
      await user.click(screen.getByRole('button', { name: /proceed to net banking/i }))

      await waitFor(() => expect(bank).toHaveAttribute('aria-invalid', 'true'))
      expect(bank).toHaveAttribute('aria-describedby', 'pay-bank-error')
      // Other fields are invalid too, so assert this one by id rather than
      // grabbing the first role="alert" on the page.
      const bankError = document.getElementById('pay-bank-error')
      expect(bankError).toHaveAttribute('role', 'alert')
      expect(bankError).toHaveTextContent('Select your bank')

      await user.selectOptions(bank, 'HDFC Bank')
      await waitFor(() => expect(bank).not.toHaveAttribute('aria-invalid'))
    })

    it('moves focus to the first invalid field on submit', async () => {
      const { user } = renderPage('growth', 'monthly')
      await user.click(await screen.findByRole('button', { name: /pay with card/i }))
      await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Email')))
    })
  })

  describe('PaymentPage — address field order', () => {
    // Company, then country (with the state/province it governs), then the
    // street, city and postal lines. Country leads because whether a state is
    // required depends on it.
    const ORDER = [
      'Company Name or Name',
      'Country',
      'State',
      'Address 1',
      'Address 2 (optional)',
      'City',
      'Postal / ZIP Code',
    ]

    const visibleOrder = (container) =>
      [...container.querySelectorAll('input, select')]
        .map((el) => el.labels?.[0]?.textContent?.trim())
        .filter(Boolean)

    it.each([
      ['invoice', 'Invoice address'],
      ['billing', 'Billing address'],
    ])('orders the %s address fields as specified', async (_ns, heading) => {
      renderPage('growth', 'monthly')
      const section = (await screen.findByText(heading)).closest('div.rounded-2xl')
      expect(visibleOrder(section)).toEqual(ORDER)
    })

    it('marks state/province required only once a country needs one', async () => {
      const { user } = renderPage('growth', 'monthly')
      const invoice = (await screen.findByText('Invoice address')).closest('div.rounded-2xl')
      const stateLabel = () => invoice.querySelector('#invoice-state').labels[0].textContent.trim()

      expect(stateLabel()).toBe('State')
      // The United States has states, so the field becomes mandatory.
      await user.selectOptions(invoice.querySelector('#invoice-country'), 'US')
      expect(stateLabel()).toBe('State / Province / Region')
      // The United Kingdom does not, so the requirement is dropped again.
      await user.selectOptions(invoice.querySelector('#invoice-country'), 'GB')
      expect(stateLabel()).toBe('State')
    })
  })

  describe('PaymentPage — state dropdown', () => {
    const invoiceSection = async () =>
      (await screen.findByText('Invoice address')).closest('div.rounded-2xl')

    it('offers the regions of the selected country', async () => {
      const { user } = renderPage('growth', 'monthly')
      const invoice = await invoiceSection()

      await user.selectOptions(invoice.querySelector('#invoice-country'), 'IN')
      const state = invoice.querySelector('#invoice-state')
      // A dropdown, not a free-text box.
      expect(state.tagName).toBe('SELECT')

      const options = [...state.options].map((o) => o.value)
      expect(options[0]).toBe('') // placeholder
      expect(options).toContain('Delhi')
      expect(options).toContain('Maharashtra')
      // Sorted, so the list is scannable.
      expect([...options.slice(1)]).toEqual([...options.slice(1)].sort((a, b) => a.localeCompare(b, 'en')))

      await user.selectOptions(state, 'Maharashtra')
      expect(state.value).toBe('Maharashtra')
    })

    it('swaps the region list when the country changes', async () => {
      const { user } = renderPage('growth', 'monthly')
      const invoice = await invoiceSection()

      await user.selectOptions(invoice.querySelector('#invoice-country'), 'US')
      const us = [...invoice.querySelector('#invoice-state').options].map((o) => o.value)
      expect(us).toContain('California')
      expect(us).not.toContain('Delhi')

      await user.selectOptions(invoice.querySelector('#invoice-country'), 'AU')
      const au = [...invoice.querySelector('#invoice-state').options].map((o) => o.value)
      expect(au).toContain('Victoria')
      expect(au).not.toContain('California')
    })

    it('clears a region that is not valid for the newly selected country', async () => {
      const { user } = renderPage('growth', 'monthly')
      const invoice = await invoiceSection()

      await user.selectOptions(invoice.querySelector('#invoice-country'), 'IN')
      await user.selectOptions(invoice.querySelector('#invoice-state'), 'Delhi')
      expect(invoice.querySelector('#invoice-state').value).toBe('Delhi')

      // "Delhi" is not a US state, so it must not survive as a hidden value.
      await user.selectOptions(invoice.querySelector('#invoice-country'), 'US')
      expect(invoice.querySelector('#invoice-state').value).toBe('')
    })

    it('keeps a region that is still valid for the new country', async () => {
      const { user } = renderPage('growth', 'monthly')
      const invoice = await invoiceSection()

      // Germany has no list on file, so the region is free text and carries
      // over to another country that also has none.
      await user.selectOptions(invoice.querySelector('#invoice-country'), 'DE')
      await user.type(invoice.querySelector('#invoice-state'), 'Bavaria')
      await user.selectOptions(invoice.querySelector('#invoice-country'), 'FR')
      expect(invoice.querySelector('#invoice-state')).toHaveValue('Bavaria')
    })

    it('stays free text for a country with no region list on file', async () => {
      const { user } = renderPage('growth', 'monthly')
      const invoice = await invoiceSection()

      // Germany has regions but no list here, so entry must not be blocked.
      await user.selectOptions(invoice.querySelector('#invoice-country'), 'DE')
      const state = invoice.querySelector('#invoice-state')
      expect(state.tagName).toBe('INPUT')
      await user.type(state, 'Bavaria')
      expect(state).toHaveValue('Bavaria')
    })

    it('requires a region once a listed country needs one', async () => {
      const { user } = renderPage('growth', 'monthly')
      const invoice = await invoiceSection()
      await fillInvoice(user)

      // Switching to a country that needs a region drops the incompatible one,
      // leaving the field empty and mandatory.
      await user.selectOptions(invoice.querySelector('#invoice-country'), 'US')
      expect(invoice.querySelector('#invoice-state').value).toBe('')

      await user.click(screen.getByRole('button', { name: /pay with card/i }))
      const stateError = document.getElementById('invoice-state-error')
      expect(stateError).toHaveTextContent('This field is required')
      expect(stateError).toHaveAttribute('role', 'alert')
      expect(invoice.querySelector('#invoice-state')).toHaveAttribute('aria-invalid', 'true')
    })
  })

  describe('PaymentPage — responsive layout', () => {
    it('puts the order summary above the form on narrow screens only', async () => {
      renderPage('growth', 'monthly')
      const main = (await screen.findByRole('heading', { name: 'Checkout' })).closest('main')
      const section = main.querySelector('section')
      const aside = main.querySelector('aside')

      // Narrow: the summary leads, so the total is visible before the form.
      expect(aside).toHaveClass('order-first')
      // Wide: order flips back so the form is on the left, as before.
      expect(aside).toHaveClass('lg:order-last')
      expect(section).toHaveClass('lg:order-first')
      // Pinned on mobile the summary would cover the form fields below it.
      expect(aside).toHaveClass('lg:sticky')
      expect(aside.className).not.toMatch(/(^|\s)sticky(\s|$)/)
      expect(aside.className).not.toMatch(/(^|\s)top-20(\s|$)/)
      // The DOM order is unchanged, so keyboard users still reach the form first.
      expect(main.querySelector('section').compareDocumentPosition(aside))
        .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    })
  })
})
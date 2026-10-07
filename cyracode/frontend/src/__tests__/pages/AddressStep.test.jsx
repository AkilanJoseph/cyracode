import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddressStep, ADDRESS_CASCADE_ORDER } from '../../pages/RegisterTraditional'

vi.mock('country-state-city/lib/state', () => ({
  default: { getStatesOfCountry: () => [{ isoCode: 'KA', name: 'Karnataka' }] },
}))

vi.mock('country-state-city/lib/city', () => ({
  default: { getCitiesOfState: () => [{ name: 'Bengaluru Urban' }] },
}))

const EMPTY_ADDRESS = {
  country_code: '', country: '', state: '', stateIso: '', district: '',
  city: '', area: '', town: '', road_name: '', avenue_name: '',
  street_address: '', building_name: '', flat_number: '', suite_name: '',
  plot_number: '', floor_unit: '', postal_code: '', po_box: '', landmark: '',
}

function renderStep(countryCode, { errors = {}, clearError } = {}) {
  const address = {
    ...EMPTY_ADDRESS,
    country_code: countryCode,
    country: countryCode,
  }
  return render(
    <AddressStep
      address={address}
      setAddress={vi.fn()}
      errors={errors}
      clearError={clearError}
    />
  )
}

// The cascade fields in the order they are rendered. The UK has no state field
// and Japan spells its district a ward, but both still follow the same chain.
const renderedCascade = (container) =>
  [...container.querySelectorAll('[data-address-field]')].map((el) =>
    el.getAttribute('data-address-field')
  )

describe('AddressStep — cascading order', () => {
  it.each([
    ['IN', ['country_code', 'state', 'district', 'city', 'street_address', 'postal_code']],
    ['US', ['country_code', 'state', 'city', 'street_address', 'postal_code']],
    ['GB', ['country_code', 'city', 'street_address', 'postal_code']],
    ['JP', ['country_code', 'state', 'district', 'city', 'street_address', 'postal_code']],
    ['DE', ['country_code', 'state', 'city', 'street_address', 'postal_code']],
  ])('%s asks for the cascade in order', async (countryCode, expected) => {
    const { container } = renderStep(countryCode)
    // The state dataset loads lazily, so let the dropdown settle first.
    await waitFor(() => {
      if (expected.includes('state')) {
        expect(container.querySelector('[data-address-field="state"]')).toBeInTheDocument()
      }
    })

    expect(renderedCascade(container)).toEqual(expected)
  })

  // The order above is only meaningful if it agrees with the order validation
  // reports on, otherwise the focused field and the message disagree.
  it('declares the same chain it renders', () => {
    expect(ADDRESS_CASCADE_ORDER).toEqual([
      'country_code',
      'state',
      'district',
      'city',
      'street_address',
      'postal_code',
    ])
  })
})

describe('AddressStep — mandatory field messages', () => {
  // Every field validateAddress can mark required has to show it. Japan used to
  // render the ward with no error slot, so its message was computed and dropped.
  it.each([
    ['IN', ['country_code', 'state', 'district', 'city', 'street_address', 'postal_code']],
    ['US', ['country_code', 'state', 'city', 'street_address', 'postal_code']],
    ['GB', ['country_code', 'city', 'street_address', 'postal_code']],
    ['JP', ['country_code', 'state', 'district', 'city', 'street_address', 'postal_code']],
    ['DE', ['country_code', 'state', 'city', 'street_address', 'postal_code']],
  ])('%s shows a message for each required field', async (countryCode, required) => {
    const errors = Object.fromEntries(required.map((f) => [f, 'This field is required']))
    const { container } = renderStep(countryCode, { errors })
    await waitFor(() => {
      if (required.includes('state')) {
        expect(container.querySelector('[data-address-field="state"]')).toBeInTheDocument()
      }
    })

    required.forEach((field) => {
      const control = container.querySelector(`[data-address-field="${field}"]`)
      expect(control, `${field} control missing`).toBeInTheDocument()
      // The message has to be programmatically tied to this exact control, not
      // merely present somewhere on the step.
      expect(control).toHaveAttribute('aria-invalid', 'true')
      const describedBy = control.getAttribute('aria-describedby')
      expect(describedBy, `${field} has no aria-describedby`).toBeTruthy()
      expect(document.getElementById(describedBy)).toHaveTextContent('This field is required')
    })
  })

  it('marks the failing controls invalid for assistive tech', async () => {
    const { container } = renderStep('IN', {
      errors: { city: 'This field is required' },
    })

    const city = container.querySelector('[data-address-field="city"]')
    expect(city).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('AddressStep — where the cursor lands on a failed submit', () => {
  beforeEach(() => {
    // jsdom keeps focus between renders, so start from a known element.
    document.body.focus()
  })

  it('focuses the first unfilled field of the cascade', async () => {
    const errors = {
      country_code: 'This field is required',
      state: 'This field is required',
      city: 'This field is required',
      postal_code: 'This field is required',
    }
    const { container, rerender } = render(
      <AddressStep address={EMPTY_ADDRESS} setAddress={vi.fn()} errors={{}} clearError={vi.fn()} />
    )

    // The parent sets every error at once on submit, which is the trigger.
    rerender(
      <AddressStep address={EMPTY_ADDRESS} setAddress={vi.fn()} errors={errors} clearError={vi.fn()} />
    )

    await waitFor(() => {
      expect(document.activeElement).toBe(container.querySelector('[data-address-field="country_code"]'))
    })
  })

  it('skips to the next failing field when the earlier one is filled in', async () => {
    const { container, rerender } = render(
      <AddressStep
        address={EMPTY_ADDRESS}
        setAddress={vi.fn()}
        errors={{ country_code: 'This field is required', city: 'This field is required' }}
        clearError={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(document.activeElement).toBe(
        container.querySelector('[data-address-field="country_code"]')
      )
    })

    // Correcting a field clears just its error, and focus must not jump.
    rerender(
      <AddressStep
        address={EMPTY_ADDRESS}
        setAddress={vi.fn()}
        errors={{ city: 'This field is required' }}
        clearError={vi.fn()}
      />
    )

    expect(document.activeElement).toBe(container.querySelector('[data-address-field="country_code"]'))
  })
})

describe('AddressStep — changing country resets the dependent cascade', () => {
  it('clears every field the new country invalidates', async () => {
    const user = userEvent.setup()
    const clearError = vi.fn()
    renderStep('IN', { errors: { state: 'x', district: 'x', city: 'x' }, clearError })

    await user.selectOptions(screen.getByLabelText('Country'), 'US')

    // A country change makes each dependent answer stale, so all of them reset.
    const dependentFields = ['country_code', 'state', 'district', 'city']
    dependentFields.forEach((field) => {
      expect(clearError, `${field} was not reset`).toHaveBeenCalledWith(field)
    })
  })
})
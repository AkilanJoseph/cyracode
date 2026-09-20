import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { server } from '../mocks/server'
import { AuthProvider } from '../../context/AuthContext'
import RegisterAutoGenerate from '../../pages/RegisterAutoGenerate'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('react-hot-toast', () => ({
  default: toastMock,
  Toaster: () => null,
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../components/MapPicker', () => ({
  default: ({ onLocationSelect }) => (
    <div data-testid="map-picker">
      <button onClick={() => onLocationSelect && onLocationSelect(37.7749, -122.4194)}>
        pick on map
      </button>
    </div>
  ),
}))

vi.mock('country-state-city/lib/state', () => ({
  default: { getStatesOfCountry: (code) => (code === 'US' ? [{ isoCode: 'CA', name: 'California' }] : []) },
}))

vi.mock('country-state-city/lib/city', () => ({
  default: { getCitiesOfState: () => [] },
}))

function setup() {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <AuthProvider>
        <RegisterAutoGenerate />
      </AuthProvider>
    </MemoryRouter>
  )
  return { user }
}

// The country select has no label association, so scope it by its options.
function countrySelect() {
  return screen.getAllByRole('combobox').find((el) =>
    Array.from(el.options).some((o) => o.value === 'US')
  )
}

// The state select is not label-associated either; scope it by its options.
// Exclude the country select so 'CA' (Canada) from the country list is not
// mistaken for a California state option.
function stateSelect() {
  return screen.getAllByRole('combobox').find((el) =>
    el !== countrySelect() && Array.from(el.options).some((o) => o.value === 'CA')
  )
}

const PERSONALIZED_URL = 'http://localhost:5173/api/registration/personalized'

describe('RegisterAutoGenerate — personalized names', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    toastMock.error.mockClear()
  })

  it('shows the empty state and the auto-generate button', () => {
    setup()
    expect(screen.getByRole('button', { name: /auto generate my code/i })).toBeInTheDocument()
    expect(screen.getByText(/10 unique name ideas/i)).toBeInTheDocument()
  })

  it('generates 10 available suggestions from the backend', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /auto generate my code/i }))

    expect(await screen.findByText('TestNova')).toBeInTheDocument()
    expect(screen.getByText('TestBloom')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^suggestion-/)).toHaveLength(10)
    expect(screen.getByRole('button', { name: /generate another set/i })).toBeInTheDocument()
  })

  it('asks for a selection before continuing once a location is picked', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /auto generate my code/i }))
    await screen.findByText('TestNova')

    await user.click(screen.getByRole('button', { name: /pick on map/i }))
    await user.click(screen.getByRole('button', { name: /^continue$/i }))

    expect(toastMock.error).toHaveBeenCalledWith('Select one of the suggested names first')
  })

  it('shows the chosen name on the address step after selection + location', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /auto generate my code/i }))
    await screen.findByText('TestNova')

    await user.click(screen.getByTestId('suggestion-TestNova'))
    expect(screen.getByTestId('suggestion-TestNova')).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /pick on map/i }))
    await user.click(screen.getByRole('button', { name: /^continue$/i }))

    expect(await screen.findByText(/your chosen cyracode:/i)).toBeInTheDocument()
    expect(screen.getByText('TestNova')).toBeInTheDocument()
  })

  it('saves the personalized code and navigates to confirmation', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /auto generate my code/i }))
    await screen.findByText('TestNova')

    await user.click(screen.getByTestId('suggestion-TestNova'))
    await user.click(screen.getByRole('button', { name: /pick on map/i }))
    await user.click(screen.getByRole('button', { name: /^continue$/i }))

    await user.selectOptions(countrySelect(), 'US')
    await user.type(screen.getByLabelText(/street name/i), 'Mission St')
    await user.type(screen.getByLabelText(/city/i), 'San Francisco')
    await vi.waitFor(() => expect(stateSelect()).toBeDefined())
    await user.selectOptions(stateSelect(), 'CA')
    await user.type(screen.getByLabelText(/zip code/i), '94103')
    await user.click(screen.getByRole('button', { name: /complete registration/i }))

    await vi.waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/confirmation', expect.objectContaining({
        state: expect.objectContaining({ mode: 'auto_generate' }),
      }))
    )
    const { record } = mockNavigate.mock.calls[0][1].state
    expect(record.code_name).toBe('TestNova')
    expect(record.code_type).toBe('personalized')
  })

  it('handles a 409 by sending the user back to pick another name', async () => {
    server.use(
      http.post(PERSONALIZED_URL, () =>
        HttpResponse.json({ detail: 'This CyraCode name is already taken.' }, { status: 409 })
      )
    )
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /auto generate my code/i }))
    await screen.findByText('TestNova')

    await user.click(screen.getByTestId('suggestion-TestNova'))
    await user.click(screen.getByRole('button', { name: /pick on map/i }))
    await user.click(screen.getByRole('button', { name: /^continue$/i }))

    await user.selectOptions(countrySelect(), 'US')
    await user.type(screen.getByLabelText(/street name/i), 'Mission St')
    await user.type(screen.getByLabelText(/city/i), 'San Francisco')
    await vi.waitFor(() => expect(stateSelect()).toBeDefined())
    await user.selectOptions(stateSelect(), 'CA')
    await user.type(screen.getByLabelText(/zip code/i), '94103')
    await user.click(screen.getByRole('button', { name: /complete registration/i }))

    await vi.waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('This name is no longer available. Please select another name.'))
    expect(screen.getByRole('button', { name: /auto generate my code/i })).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('requires state/city/district and clears errors as soon as a value is filled', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /auto generate my code/i }))
    await screen.findByText('TestNova')

    await user.click(screen.getByTestId('suggestion-TestNova'))
    await user.click(screen.getByRole('button', { name: /pick on map/i }))
    await user.click(screen.getByRole('button', { name: /^continue$/i }))

    await user.selectOptions(countrySelect(), 'US')
    await user.type(screen.getByLabelText(/street name/i), 'Mission St')
    await user.type(screen.getByLabelText(/city/i), 'San Francisco')
    await user.type(screen.getByLabelText(/zip code/i), '94103')
    await user.click(screen.getByRole('button', { name: /complete registration/i }))

    // State is mandatory now — submission is blocked without it.
    await vi.waitFor(() => expect(stateSelect()).toBeDefined())
    const stateField = stateSelect().closest('div').parentElement
    expect(within(stateField).getByText('This field is required')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()

    // Selecting a state clears the state error immediately.
    await user.selectOptions(stateSelect(), 'CA')
    expect(within(stateField).queryByText('This field is required')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /complete registration/i }))
    await vi.waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/confirmation', expect.objectContaining({
        state: expect.objectContaining({ mode: 'auto_generate' }),
      }))
    )
  })
})
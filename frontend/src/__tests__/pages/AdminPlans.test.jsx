import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import AdminPlans from '../../pages/AdminPlans'
import toast from 'react-hot-toast'
import { mockAdminUser, mockToken, adminPlanStore, adminClientStore } from '../mocks/handlers'

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

function setup() {
  localStorage.setItem('cyracode_token', mockToken)
  localStorage.setItem('cyracode_user', JSON.stringify(mockAdminUser))
  const utils = render(
    <MemoryRouter>
      <AuthProvider>
        <AdminPlans />
      </AuthProvider>
    </MemoryRouter>
  )
  return { user: userEvent.setup(), ...utils }
}

beforeEach(() => {
  localStorage.clear()
  adminPlanStore.reset()
  adminClientStore.reset()
  vi.clearAllMocks()
})

describe('AdminPlans', () => {
  it('lists the seeded plans with pricing', async () => {
    setup()
    expect(await screen.findByText('Basic')).toBeInTheDocument()
    expect(screen.getAllByText('Pro').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('$500/mo')).toBeInTheDocument()
    expect(screen.getByText('$2,000/mo')).toBeInTheDocument()
    expect(screen.getByText('$5,000/mo')).toBeInTheDocument()
  })

  it('creates a plan and lists it', async () => {
    const { user } = setup()
    await screen.findByText('Basic')

    await user.click(screen.getByRole('button', { name: /new plan/i }))
    await user.type(screen.getByLabelText(/plan code/i), 'gold')
    await user.type(screen.getByLabelText(/plan name/i), 'Gold')
    await user.type(screen.getByLabelText(/monthly cost/i), '1000')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText('$1,000/mo')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('created'))
  })

  it('rejects an invalid plan code', async () => {
    const { user } = setup()
    await screen.findByText('Basic')

    await user.click(screen.getByRole('button', { name: /new plan/i }))
    await user.type(screen.getByLabelText(/plan code/i), 'has space')
    await user.type(screen.getByLabelText(/plan name/i), 'Bad Code')
    await user.type(screen.getByLabelText(/monthly cost/i), '100')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/letters, digits, '_' and '-' only/i)).toBeInTheDocument()
  })

  it('edits a plan price', async () => {
    const { user } = setup()
    await screen.findByText('Basic')

    await user.click(screen.getByRole('button', { name: /edit basic/i }))
    const cost = screen.getByLabelText(/monthly cost/i)
    await user.clear(cost)
    await user.type(cost, '750')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText('$750/mo')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('updated'))
  })

  it('blocks deletion while a plan is in use', async () => {
    const { user } = setup()
    await screen.findByText('Basic')

    await user.click(screen.getByRole('button', { name: /delete basic/i }))
    await user.click(screen.getByRole('button', { name: /yes, remove/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    expect(screen.getByText('$500/mo')).toBeInTheDocument()
  })

  it('deletes an unused plan after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    adminPlanStore.plans.push({ id: 'plan-gold', code: 'gold', name: 'Gold', monthly_cost: 1000 })
    const { user } = setup()
    await screen.findByText('Gold')

    await user.click(screen.getByRole('button', { name: /delete gold/i }))
    expect(screen.getByText(/remove plan/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /yes, remove/i }))

    await waitFor(() => {
      expect(screen.queryByText('$1,000/mo')).not.toBeInTheDocument()
    })
    confirmSpy.mockRestore()
  })
})
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProgressSteps from '../../components/common/ProgressSteps'

const STEPS = ['Location', 'Address', 'Verify']

describe('ProgressSteps', () => {
  it('renders all step labels', () => {
    render(<ProgressSteps steps={STEPS} current={1} />)
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('Address')).toBeInTheDocument()
    expect(screen.getByText('Verify')).toBeInTheDocument()
  })

  it('shows step numbers for upcoming steps', () => {
    render(<ProgressSteps steps={STEPS} current={1} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('active step has ring class', () => {
    const { container } = render(<ProgressSteps steps={STEPS} current={2} />)
    const rings = container.querySelectorAll('[class*="ring-4"]')
    expect(rings).toHaveLength(1)
  })

  it('renders the correct number of connector lines', () => {
    const { container } = render(<ProgressSteps steps={STEPS} current={1} />)
    const connectors = container.querySelectorAll('[class*="h-0.5"]')
    expect(connectors).toHaveLength(STEPS.length - 1)
  })

  it('completed steps do not show a number', () => {
    render(<ProgressSteps steps={STEPS} current={3} />)
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })

  it('active step label has primary color class', () => {
    const { container } = render(<ProgressSteps steps={STEPS} current={1} />)
    const labels = container.querySelectorAll('[class*="text-primary"]')
    expect(labels.length).toBeGreaterThan(0)
  })

  it('future step connector is gray', () => {
    const { container } = render(<ProgressSteps steps={STEPS} current={1} />)
    const grayConnectors = container.querySelectorAll('[class*="bg-gray-200"]')
    expect(grayConnectors.length).toBeGreaterThan(0)
  })

  it('completed step connector turns primary color', () => {
    const { container } = render(<ProgressSteps steps={STEPS} current={3} />)
    const primaryConnectors = container.querySelectorAll('[class*="bg-primary"]')
    expect(primaryConnectors.length).toBeGreaterThan(0)
  })

  it('renders empty steps without error', () => {
    const { container } = render(<ProgressSteps steps={[]} current={1} />)
    expect(container.firstChild).toBeInTheDocument()
  })
})

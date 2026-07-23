import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Input from '../../components/common/Input'

describe('Input', () => {
  it('renders label when provided', () => {
    render(<Input label="Email" />)
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('renders without label when omitted', () => {
    render(<Input placeholder="Enter value" />)
    expect(screen.queryByText('Email')).not.toBeInTheDocument()
  })

  it('shows error message', () => {
    render(<Input error="This field is required" />)
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('shows helper text when no error', () => {
    render(<Input helperText="e.g. 6 digits" />)
    expect(screen.getByText('e.g. 6 digits')).toBeInTheDocument()
  })

  it('hides helper text when error is present', () => {
    render(<Input helperText="Hint" error="Required" />)
    expect(screen.queryByText('Hint')).not.toBeInTheDocument()
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('applies error border style when error is set', () => {
    render(<Input error="Oops" />)
    expect(screen.getByRole('textbox').className).toMatch(/border-red/)
  })

  it('applies normal border when no error', () => {
    render(<Input />)
    expect(screen.getByRole('textbox').className).toMatch(/border-gray/)
  })

  it('calls onChange when user types', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Input onChange={onChange} />)
    await user.type(screen.getByRole('textbox'), 'hello')
    expect(onChange).toHaveBeenCalled()
  })

  it('shows password toggle for type=password', () => {
    render(<Input type="password" />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    render(<Input type="password" />)
    const input = document.querySelector('input[type="password"]')
    expect(input).toBeInTheDocument()
    await user.click(screen.getByRole('button'))
    expect(document.querySelector('input[type="text"]')).toBeInTheDocument()
    await user.click(screen.getByRole('button'))
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument()
  })

  it('does not show password toggle for type=text', () => {
    render(<Input type="text" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders rightIcon when provided', () => {
    render(<Input rightIcon={<span data-testid="icon" />} />)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('rightIcon not shown for password type', () => {
    render(<Input type="password" rightIcon={<span data-testid="icon" />} />)
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument()
  })

  it('forwards value and placeholder props', () => {
    render(<Input value="preset" placeholder="Type here" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('preset')
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Type here')
  })
})

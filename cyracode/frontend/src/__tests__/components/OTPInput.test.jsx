import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OTPInput from '../../components/OTPInput'

describe('OTPInput', () => {
  it('renders 6 input boxes by default', () => {
    render(<OTPInput onChange={() => {}} />)
    expect(screen.getAllByRole('textbox')).toHaveLength(6)
  })

  it('renders custom length', () => {
    render(<OTPInput length={4} onChange={() => {}} />)
    expect(screen.getAllByRole('textbox')).toHaveLength(4)
  })

  it('calls onChange with joined digit string', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<OTPInput onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], '1')
    expect(onChange).toHaveBeenLastCalledWith(expect.stringMatching(/^1/))
  })

  it('only accepts digits', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<OTPInput onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'a')
    expect(inputs[0]).toHaveValue('')
  })

  it('moves focus to next input after digit entry', async () => {
    const user = userEvent.setup()
    render(<OTPInput onChange={() => {}} />)
    const inputs = screen.getAllByRole('textbox')
    inputs[0].focus()
    await user.type(inputs[0], '5')
    expect(document.activeElement).toBe(inputs[1])
  })

  it('backspace on empty moves focus to previous', async () => {
    const user = userEvent.setup()
    render(<OTPInput onChange={() => {}} />)
    const inputs = screen.getAllByRole('textbox')
    inputs[1].focus()
    await user.keyboard('{Backspace}')
    expect(document.activeElement).toBe(inputs[0])
  })

  it('handles paste to fill all boxes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<OTPInput onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox')
    inputs[0].focus()
    await user.paste('123456')
    expect(onChange).toHaveBeenLastCalledWith('123456')
  })

  it('paste ignores non-digit characters', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<OTPInput onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox')
    inputs[0].focus()
    await user.paste('12-34')
    expect(onChange).toHaveBeenLastCalledWith(expect.stringMatching(/^1234/))
  })

  it('renders with initial value', () => {
    render(<OTPInput value="123456" onChange={() => {}} />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs[0]).toHaveValue('1')
    expect(inputs[5]).toHaveValue('6')
  })
})

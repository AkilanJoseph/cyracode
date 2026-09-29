import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContactWidget from '../../components/common/ContactWidget'
import { ContactWidgetProvider } from '../../context/ContactWidgetContext'
import { contact } from '../../services/api'

vi.mock('../../services/api', () => ({
  contact: { send: vi.fn() },
}))

function renderWidget() {
  return render(
    <ContactWidgetProvider>
      <ContactWidget />
    </ContactWidgetProvider>
  )
}

function open() {
  renderWidget()
  return userEvent.setup()
}

async function fill(user, { name, email, address, message }) {
  if (name !== undefined) await user.type(screen.getByLabelText('Name'), name)
  if (email !== undefined) await user.type(screen.getByLabelText('Email'), email)
  if (address !== undefined) await user.type(screen.getByLabelText('Address'), address)
  if (message !== undefined) await user.type(screen.getByLabelText('Message'), message)
}

const VALID = {
  name: 'Priya Raman',
  email: 'priya@example.com',
  address: '12 Park Street, Bengaluru',
  message: 'How do I get a CyraCode for a rural address?',
}

describe('ContactWidget', () => {
  beforeEach(() => {
    contact.send.mockReset()
    contact.send.mockResolvedValue({ data: { message: 'ok' } })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts closed and shows only the launcher', () => {
    renderWidget()
    expect(screen.queryByTestId('contact-widget')).not.toBeInTheDocument()
    expect(screen.getByTestId('contact-launcher')).toBeInTheDocument()
  })

  it('opens a panel with all four fields', async () => {
    const user = open()
    await user.click(screen.getByTestId('contact-launcher'))

    const panel = screen.getByTestId('contact-widget')
    expect(panel).toBeInTheDocument()
    for (const field of ['Name', 'Email', 'Address', 'Message']) {
      expect(within(panel).getByLabelText(field)).toBeInTheDocument()
    }
  })

  it('exposes the panel as a modal dialog labelled by its heading', async () => {
    const user = open()
    await user.click(screen.getByTestId('contact-launcher'))

    const panel = screen.getByRole('dialog')
    expect(panel).toHaveAttribute('aria-modal', 'true')
    expect(panel).toHaveAccessibleName('Contact us')
  })

  it('tells the launcher its expanded state', async () => {
    const user = open()
    const launcher = screen.getByTestId('contact-launcher')
    expect(launcher).toHaveAttribute('aria-expanded', 'false')

    await user.click(launcher)
    expect(launcher).toHaveAttribute('aria-expanded', 'true')
  })

  it('sends the enquiry and confirms', async () => {
    const user = open()
    await user.click(screen.getByTestId('contact-launcher'))
    await fill(user, VALID)
    await user.click(screen.getByTestId('contact-submit'))

    await waitFor(() => expect(contact.send).toHaveBeenCalledTimes(1))
    expect(contact.send).toHaveBeenCalledWith(VALID)
    expect(await screen.findByTestId('contact-success')).toBeInTheDocument()
  })

  it('trims surrounding whitespace before sending', async () => {
    const user = open()
    await user.click(screen.getByTestId('contact-launcher'))
    await fill(user, { ...VALID, name: '  Priya  ' })
    await user.click(screen.getByTestId('contact-submit'))

    await waitFor(() => expect(contact.send).toHaveBeenCalled())
    expect(contact.send.mock.calls[0][0].name).toBe('Priya')
  })

  it('surfaces a server failure instead of claiming success', async () => {
    contact.send.mockRejectedValue({
      response: { data: { detail: 'Could not send your message right now.' } },
    })
    const user = open()
    await user.click(screen.getByTestId('contact-launcher'))
    await fill(user, VALID)
    await user.click(screen.getByTestId('contact-submit'))

    expect(await screen.findByTestId('contact-error')).toBeInTheDocument()
    expect(screen.getByText('Could not send your message right now.')).toBeInTheDocument()
    expect(screen.queryByTestId('contact-success')).not.toBeInTheDocument()
  })

  it('does not double-send while a request is in flight', async () => {
    let release
    contact.send.mockReturnValue(new Promise((r) => { release = r }))
    const user = open()
    await user.click(screen.getByTestId('contact-launcher'))
    await fill(user, VALID)
    await user.click(screen.getByTestId('contact-submit'))

    await waitFor(() => expect(contact.send).toHaveBeenCalledTimes(1))
    // Submit is disabled while sending, so a second click cannot double-send.
    expect(screen.getByTestId('contact-submit')).toBeDisabled()
    await user.click(screen.getByTestId('contact-submit'))
    expect(contact.send).toHaveBeenCalledTimes(1)

    release({ data: {} })
    await screen.findByTestId('contact-success')
  })

  // ---------- Validation ----------

  it('blocks an empty submit and does not call the API', async () => {
    const user = open()
    await user.click(screen.getByTestId('contact-launcher'))
    await user.click(screen.getByTestId('contact-submit'))

    expect(await screen.findAllByRole('alert')).toHaveLength(4)
    expect(contact.send).not.toHaveBeenCalled()
  })

  it('rejects a malformed email before sending', async () => {
    const user = open()
    await user.click(screen.getByTestId('contact-launcher'))
    await fill(user, { ...VALID, email: 'not-an-email' })
    await user.click(screen.getByTestId('contact-submit'))

    expect(
      await screen.findByText('Please enter a valid email address.')
    ).toBeInTheDocument()
    expect(contact.send).not.toHaveBeenCalled()
  })

  it('clears a field error once the visitor edits that field', async () => {
    const user = open()
    await user.click(screen.getByTestId('contact-launcher'))
    await user.click(screen.getByTestId('contact-submit'))
    expect(await screen.findByText('Please enter your name.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Name'), 'P')
    await waitFor(() =>
      expect(screen.queryByText('Please enter your name.')).not.toBeInTheDocument()
    )
  })

  // ---------- Open/close behaviour ----------

  it('closes on Escape and returns focus to the launcher', async () => {
    const user = open()
    const launcher = screen.getByTestId('contact-launcher')
    await user.click(launcher)
    expect(screen.getByTestId('contact-widget')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByTestId('contact-widget')).not.toBeInTheDocument())
    expect(launcher).toHaveFocus()
  })

  it('closes when the backdrop is clicked', async () => {
    const user = open()
    await user.click(screen.getByTestId('contact-launcher'))
    // The overlay is the element immediately before the panel.
    const backdrop = document.querySelector('.fixed.inset-0')
    await user.click(backdrop)
    await waitFor(() => expect(screen.queryByTestId('contact-widget')).not.toBeInTheDocument())
  })

  it('toggles closed from the launcher', async () => {
    const user = open()
    const launcher = screen.getByTestId('contact-launcher')
    await user.click(launcher)
    expect(screen.getByTestId('contact-widget')).toBeInTheDocument()

    await user.click(launcher)
    await waitFor(() => expect(screen.queryByTestId('contact-widget')).not.toBeInTheDocument())
  })

  it('moves focus into the panel when it opens', async () => {
    const user = open()
    await user.click(screen.getByTestId('contact-launcher'))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveFocus())
  })
})

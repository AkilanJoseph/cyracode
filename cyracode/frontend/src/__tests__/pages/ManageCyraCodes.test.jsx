import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { cyracodeStore } from '../mocks/handlers'
import { AuthProvider } from '../../context/AuthContext'
import { ContactWidgetProvider } from '../../context/ContactWidgetContext'
import ManageCyraCodes from '../../pages/ManageCyraCodes'

const MY_CODES_URL = 'http://localhost:5173/api/registration/my-codes'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('react-hot-toast', () => ({
  default: toastMock,
  Toaster: () => null,
}))

vi.mock('../../components/MapPicker', () => ({
  default: ({ markerPosition, onLocationSelect }) => (
    <div data-testid="map-picker">
      {markerPosition && <span>Marker at {markerPosition.lat}</span>}
      <button onClick={() => onLocationSelect && onLocationSelect(12.9999, 77.1111)}>
        pick on map
      </button>
    </div>
  ),
}))

vi.mock('country-state-city/lib/state', () => ({
  default: { getStatesOfCountry: () => [{ isoCode: 'KA', name: 'Karnataka' }] },
}))

vi.mock('country-state-city/lib/city', () => ({
  default: { getCitiesOfState: () => [{ name: 'Bengaluru' }] },
}))

function setup() {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <ContactWidgetProvider>
        <AuthProvider>
          <ManageCyraCodes />
        </AuthProvider>
      </ContactWidgetProvider>
    </MemoryRouter>
  )
  return { user }
}

describe('ManageCyraCodes — tile list', () => {
  beforeEach(() => {
    cyracodeStore.reset()
  })

  it('loads and lists the user cyracodes as tiles', async () => {
    setup()
    expect(await screen.findByRole('heading', { name: 'TestHome' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'MyOffice' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /view/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /edit/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(2)
    expect(screen.getAllByText(/type: customized/i)).toHaveLength(2)
  })

  it('shows a notice and both registration options when there are no cyracodes', async () => {
    server.use(http.get(MY_CODES_URL, () => HttpResponse.json([])))
    setup()
    expect(await screen.findByText(/you don't have any registered cyracodes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /custom code/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /auto code/i })).toBeInTheDocument()
  })
})

describe('ManageCyraCodes — search', () => {
  beforeEach(() => {
    cyracodeStore.reset()
  })

  it('exposes the search box with an accessible name', async () => {
    setup()
    expect(await screen.findByRole('searchbox', { name: /search by name, address, city, or country/i })).toBeInTheDocument()
  })

  it('filters the tiles down to a single code by name', async () => {
    const { user } = setup()
    await screen.findByRole('heading', { name: 'TestHome' })

    await user.type(screen.getByTestId('manage-search'), 'office')

    expect(screen.getByRole('heading', { name: 'MyOffice' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'TestHome' })).not.toBeInTheDocument()
  })

  it('matches address fields too, so a code is findable without knowing its name', async () => {
    const { user } = setup()
    await screen.findByRole('heading', { name: 'TestHome' })

    // "koramangala" appears only in MyOffice's address, never in its name.
    await user.type(screen.getByTestId('manage-search'), 'koramangala')

    expect(screen.getByRole('heading', { name: 'MyOffice' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'TestHome' })).not.toBeInTheDocument()
  })

  it('keeps every code whose address matches a shared city', async () => {
    const { user } = setup()
    await screen.findByRole('heading', { name: 'TestHome' })

    // Both codes are in Bangalore, so neither should be dropped.
    await user.type(screen.getByTestId('manage-search'), 'bangalore')

    expect(screen.getByRole('heading', { name: 'TestHome' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'MyOffice' })).toBeInTheDocument()
  })

  it('ignores surrounding whitespace and casing', async () => {
    const { user } = setup()
    await screen.findByRole('heading', { name: 'TestHome' })

    await user.type(screen.getByTestId('manage-search'), '  OFFICE  ')

    expect(screen.getByRole('heading', { name: 'MyOffice' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'TestHome' })).not.toBeInTheDocument()
  })

  it('shows a no-results message instead of an empty grid when nothing matches', async () => {
    const { user } = setup()
    await screen.findByRole('heading', { name: 'TestHome' })

    await user.type(screen.getByTestId('manage-search'), 'zzzznomatch')

    expect(screen.getByText(/no cyracodes match your search/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'TestHome' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'MyOffice' })).not.toBeInTheDocument()
  })

  it('restores the full list once the query is cleared', async () => {
    const { user } = setup()
    await screen.findByRole('heading', { name: 'TestHome' })
    const input = screen.getByTestId('manage-search')

    await user.type(input, 'office')
    expect(screen.queryByRole('heading', { name: 'TestHome' })).not.toBeInTheDocument()

    await user.clear(input)
    expect(screen.getByRole('heading', { name: 'TestHome' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'MyOffice' })).toBeInTheDocument()
  })

  it('uses the same two-row layout at every width, with Remove spanning a full row', async () => {
    setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')

    // Three equal columns, and no breakpoint override — desktop matches mobile.
    const row = tile.querySelector('.grid-cols-3')
    expect(row).not.toBeNull()
    expect(row.className).not.toContain('sm:')

    const [copy, view, edit, remove] = within(tile).getAllByRole('button')

    // Only Remove spans the full width; the first three each take one column.
    expect(copy.className).not.toContain('col-span-3')
    expect(view.className).not.toContain('col-span-3')
    expect(edit.className).not.toContain('col-span-3')
    expect(remove.className).toContain('col-span-3')

    // None of the buttons carry a breakpoint-specific width override either.
    for (const button of [copy, view, edit, remove]) {
      expect(button.className).not.toContain('sm:flex-1')
    }
  })

  it('offers copy before view on every tile, matching the view/edit row', async () => {
    setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    const labels = within(tile)
      .getAllByRole('button')
      .map((b) => b.textContent.trim())
    expect(labels).toEqual(['Copy', 'View', 'Edit', 'Remove'])
  })

  it('copies the code name and address, each with its own title', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')

    await user.click(within(tile).getByRole('button', { name: 'Copy' }))

    await vi.waitFor(async () => {
      expect(await navigator.clipboard.readText()).toBe(
        'CyraCode Name: TestHome\nAddress: MG Road, 100 Feet Road, Indiranagar, Bengaluru East, Bangalore, 560001, Bengaluru Urban, Karnataka, India'
      )
    })
  })

  it('confirms the tile copy with a toast', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')

    await user.click(within(tile).getByRole('button', { name: 'Copy' }))

    await vi.waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith(
        'CyraCode name and address copied to clipboard.'
      )
    })
  })

  it('copies each tile its own details, not the first one', async () => {
    const { user } = setup()
    const second = await screen.findByTestId('code-tile-code-test-id-2')

    await user.click(within(second).getByRole('button', { name: 'Copy' }))

    await vi.waitFor(async () => {
      expect(await navigator.clipboard.readText()).toContain('CyraCode Name: MyOffice')
    })
    const copied = await navigator.clipboard.readText()
    // MyOffice has its own area, so it must not leak the other tile's address.
    expect(copied).toContain('Koramangala')
    expect(copied).not.toContain('Indiranagar')
  })

  it('marks only the tile that was copied', async () => {
    const { user } = setup()
    const first = await screen.findByTestId('code-tile-code-test-id')
    const second = await screen.findByTestId('code-tile-code-test-id-2')

    await user.click(within(first).getByRole('button', { name: 'Copy' }))

    expect(first.querySelector('.text-emerald-600')).not.toBeNull()
    expect(second.querySelector('.text-emerald-600')).toBeNull()
  })

  it('reports a failure when the clipboard write is rejected', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      writable: true,
      configurable: true,
    })

    await user.click(within(tile).getByRole('button', { name: 'Copy' }))

    await vi.waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith('Could not copy the CyraCode details.')
    })
  })

  it('hides the search box when the user has no codes at all', async () => {
    server.use(http.get(MY_CODES_URL, () => HttpResponse.json([])))
    setup()
    expect(await screen.findByText(/you don't have any registered cyracodes/i)).toBeInTheDocument()
    // The empty state already prompts registration, so a filter box would be dead UI.
    expect(screen.queryByTestId('manage-search')).not.toBeInTheDocument()
  })
})

describe('ManageCyraCodes — view mode', () => {
  beforeEach(() => {
    cyracodeStore.reset()
  })

  it('opens a read-only view modal with the code details', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /view/i }))

    const modal = await screen.findByTestId('view-modal')
    expect(within(modal).getByRole('heading', { name: 'TestHome' })).toBeInTheDocument()
    expect(within(modal).getByText(/MG Road, 100 Feet Road/)).toBeInTheDocument()
    expect(within(modal).getByText(/12\.971600/)).toBeInTheDocument()
    expect(within(modal).getByText('Customized')).toBeInTheDocument()
  })

  it('shows the QR code at the top of the view modal with a download button', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /view/i }))

    const modal = await screen.findByTestId('view-modal')
    const address = within(modal).getByTestId('view-address')
    const download = within(modal).getByRole('button', { name: /download qr/i })

    // Same renderer as the confirmation screen, so the code scans identically.
    const qr = within(modal).getByTestId('view-qr')
    const canvas = qr.querySelector('canvas')
    expect(canvas).toBeInTheDocument()

    // The code leads the modal, and its download action sits directly beneath
    // it, both above the address details they encode.
    const follows = (a, b) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(canvas, download)).toBe(true)
    expect(follows(download, address)).toBe(true)
  })

  it('downloads the QR code from the view modal', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /view/i }))
    const modal = await screen.findByTestId('view-modal')

    // jsdom has no 2D context, so give the canvas a toDataURL and capture the
    // synthetic anchor the download relies on.
    const clicked = []
    const realCreate = document.createElement.bind(document)
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreate(tag)
      if (tag === 'a') el.click = () => clicked.push({ download: el.download, href: el.href })
      return el
    })
    const canvas = within(modal).getByTestId('view-qr').querySelector('canvas')
    canvas.toDataURL = (mime = 'image/png') =>
      mime === 'image/webp' ? 'data:image/webp;base64,x' : 'data:image/png;base64,x'

    await user.click(within(modal).getByRole('button', { name: /download qr/i }))
    spy.mockRestore()

    expect(clicked).toHaveLength(1)
    expect(clicked[0].download).toMatch(/^CyraCode_TestHome_\d+\.(webp|png)$/)
  })

  it('includes sharing controls in the view modal', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /view/i }))

    const modal = await screen.findByTestId('view-modal')
    // No standalone external links expected; the share actions are buttons that
    // trigger native sharing or copy.
    for (const label of [/whatsapp/i, /copy link/i, /email/i, /facebook/i]) {
      expect(within(modal).getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('shows the copy control as an icon with no text label', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /view/i }))

    const modal = await screen.findByTestId('view-modal')
    const copy = within(modal).getByTestId('copy-address')

    // The visible label is gone; the accessible name still names the action.
    expect(copy.textContent).toBe('')
    expect(copy).toHaveAttribute('aria-label', 'Copy address')
    expect(copy.querySelector('svg')).toBeInTheDocument()
  })

  it('closes the view modal', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /view/i }))
    const modal = await screen.findByTestId('view-modal')
    await user.click(within(modal).getByLabelText('Close'))
    expect(screen.queryByTestId('view-modal')).not.toBeInTheDocument()
  })

  it('displays the address in standardized order with clean formatting', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /view/i }))

    const modal = await screen.findByTestId('view-modal')
    const address = within(modal).getByTestId('view-address')
    expect(address).toHaveTextContent(
      'MG Road, 100 Feet Road, Indiranagar, Bengaluru East, Bangalore, 560001, Bengaluru Urban, Karnataka, India'
    )
    expect(address.textContent).not.toMatch(/\s,/)
    expect(address.textContent).not.toMatch(/,,/)
  })

  it('copies the displayed address and confirms via toast', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /view/i }))

    const modal = await screen.findByTestId('view-modal')
    const addressEl = within(modal).getByTestId('view-address')

    await user.click(within(modal).getByRole('button', { name: 'Copy address' }))

    await vi.waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith('Address copied to clipboard.')
    })
    // Copy always passes exactly the string the modal displays.
    expect(addressEl.textContent).toBe(
      'MG Road, 100 Feet Road, Indiranagar, Bengaluru East, Bangalore, 560001, Bengaluru Urban, Karnataka, India'
    )
  })
})

describe('ManageCyraCodes — edit flow', () => {
  beforeEach(() => {
    cyracodeStore.reset()
  })

  it('editing a code loads the map and lets the user continue', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /edit/i }))
    expect(await screen.findByText('TestHome')).toBeInTheDocument()
    expect(screen.getByTestId('map-picker')).toBeInTheDocument()
  })

  it('shows the immutable-name warning above the map, not below the form', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /edit/i }))

    const warning = await screen.findByText(/cannot be changed/i)
    const map = await screen.findByTestId('map-picker')

    // The warning used to render after the step content, so it appeared under
    // the map and the buttons. It must be read before the user starts editing.
    expect(
      warning.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('shows the edit hint on the first screen, below the warning and above the map', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /edit/i }))

    const warning = await screen.findByText(/cannot be changed/i)
    const hint = await screen.findByText(/adjust the pin on the map/i)
    const map = await screen.findByTestId('map-picker')

    // The pin is adjusted on the first screen, so the hint reads between the
    // name warning and the map rather than on the address form.
    expect(
      warning.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      hint.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    // It is guidance for the map, so it must not follow onto the address form.
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByLabelText(/Street Name/i)
    expect(screen.queryByText(/adjust the pin on the map/i)).not.toBeInTheDocument()
  })

  it('prefills the address form with the selected code values', async () => {

    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /edit/i }))
    await screen.findByTestId('map-picker')

    await user.click(screen.getByRole('button', { name: /continue/i }))
    const area = await screen.findByLabelText(/Area/i)
    expect(area).toHaveValue('Indiranagar')
    const city = screen.getByLabelText(/City/i)
    expect(city).toHaveValue('Bangalore')
    const street = screen.getByLabelText(/Street Name/i)
    expect(street).toHaveValue('MG Road')
    const town = screen.getByLabelText('Town')
    expect(town).toHaveValue('Bengaluru East')
  })

  it('walks through the address step and saves', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /edit/i }))
    await screen.findByTestId('map-picker')

    await user.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText(/Street Name/i)

    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await vi.waitFor(() => expect(toastMock.success).toHaveBeenCalled())
    expect(await screen.findByRole('heading', { name: 'TestHome' })).toBeInTheDocument()
  })
})

describe('ManageCyraCodes — remove', () => {
  beforeEach(() => {
    cyracodeStore.reset()
  })

  it('removing a code shows a confirmation, then removes and refreshes the list', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /remove/i }))

    const modal = await screen.findByTestId('remove-modal')
    expect(within(modal).getByText(/Are you sure you want to remove TestHome/i)).toBeInTheDocument()

    await user.click(within(modal).getByRole('button', { name: /yes, remove/i }))
    await vi.waitFor(() => expect(toastMock.success).toHaveBeenCalled())
    await screen.findByRole('heading', { name: 'MyOffice' })
    expect(screen.queryByRole('heading', { name: 'TestHome' })).not.toBeInTheDocument()
  })

  it('cancelling the confirmation keeps the code', async () => {
    const { user } = setup()
    const tile = await screen.findByTestId('code-tile-code-test-id')
    await user.click(within(tile).getByRole('button', { name: /remove/i }))

    const modal = await screen.findByTestId('remove-modal')
    await user.click(within(modal).getByRole('button', { name: /cancel/i }))
    expect(screen.queryByTestId('remove-modal')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'TestHome' })).toBeInTheDocument()
  })
})
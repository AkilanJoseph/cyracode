import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGoBack } from '../../utils/navigation'

const mockNavigate = vi.fn()
let mockLocation = { key: 'default' }
let historyLength = 1

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}))

function setHistoryLength(n) {
  Object.defineProperty(window.history, 'length', { value: n, configurable: true })
}

function goBack(fallbackPath) {
  const { result } = renderHook(() => useGoBack(fallbackPath))
  act(() => result.current())
}

describe('useGoBack', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockLocation = { key: 'default' }
    setHistoryLength(1)
  })

  it('returns to the previous entry when there is one', () => {
    mockLocation = { key: 'k3' }
    setHistoryLength(4)

    goBack('/dashboard')

    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('uses the fallback on a direct load, where the entry is the first one', () => {
    // A deep link or a refresh: history may be long, but this entry is the
    // first, so there is nothing to go back to.
    mockLocation = { key: 'default' }
    setHistoryLength(4)

    goBack('/dashboard')

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('uses the fallback when history holds only this entry', () => {
    mockLocation = { key: 'k1' }
    setHistoryLength(1)

    goBack('/dashboard')

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('honours a caller-supplied fallback instead of a hard-coded page', () => {
    mockLocation = { key: 'default' }
    setHistoryLength(4)

    goBack('/manage-cyracodes')

    expect(mockNavigate).toHaveBeenCalledWith('/manage-cyracodes')
  })
})

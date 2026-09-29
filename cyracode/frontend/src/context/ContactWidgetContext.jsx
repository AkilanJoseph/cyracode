import { createContext, useCallback, useContext, useMemo, useState } from 'react'

/**
 * Open/closed state for the Contact-us widget, lifted out of the widget itself
 * so other components (currently the footer Support link) can open it without
 * owning the form.
 */
const ContactWidgetContext = createContext(null)

export function ContactWidgetProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((o) => !o), [])

  const value = useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle]
  )

  return <ContactWidgetContext.Provider value={value}>{children}</ContactWidgetContext.Provider>
}

export function useContactWidget() {
  const ctx = useContext(ContactWidgetContext)
  // Throwing beats silently no-op'ing: a missing provider means the footer link
  // would do nothing at all, which is much harder to notice than a crash.
  if (!ctx) {
    throw new Error('useContactWidget must be used within a ContactWidgetProvider')
  }
  return ctx
}

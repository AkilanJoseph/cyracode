import { useLocation } from 'react-router-dom'
import ContactWidget from './ContactWidget'

/**
 * Renders the public Contact-us widget everywhere except the Admin Portal.
 * Operators are there to support customers, not to become enquiries, and the
 * launcher would sit on top of the admin tables. Must be rendered inside
 * ContactWidgetProvider and a Router.
 */
export default function ContactWidgetRoute() {
  const { pathname } = useLocation()
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return null
  return <ContactWidget />
}

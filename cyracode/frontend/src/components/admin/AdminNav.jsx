import { NavLink } from 'react-router-dom'
import { LayoutDashboard, MapPin, KeyRound, Users, ScrollText, CreditCard, Tag } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const links = [
  { to: '/admin', icon: LayoutDashboard, key: 'admin.nav_dashboard', end: true },
  { to: '/admin/cyracodes', icon: MapPin, key: 'admin.nav_cyracodes' },
  { to: '/admin/clients', icon: KeyRound, key: 'admin.nav_clients' },
  { to: '/admin/subscriptions', icon: CreditCard, key: 'admin.nav_subscriptions' },
  { to: '/admin/plans', icon: Tag, key: 'admin.nav_plans' },
  { to: '/admin/users', icon: Users, key: 'admin.nav_users' },
  { to: '/admin/audit', icon: ScrollText, key: 'admin.nav_audit' },
]

export default function AdminNav() {
  const { t } = useTranslation()
  return (
    <nav aria-label="Admin" className="border-b border-border bg-white/80 sticky top-14 z-10">
      <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-1 overflow-x-auto">
        {links.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive ? 'bg-primary-light text-primary' : 'text-muted hover:text-ink hover:bg-slate-100'
              }`
            }
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {t(key)}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
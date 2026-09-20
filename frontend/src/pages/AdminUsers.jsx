import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Search, ShieldCheck, Shield, UserRound, Power, Trash2 } from 'lucide-react'
import Header from '../components/common/Header'
import AdminNav from '../components/admin/AdminNav'
import Button from '../components/common/Button'
import { admin } from '../services/api'
import { apiErrorMessage } from '../utils/errors'
import { useAuth } from '../context/AuthContext'

const ROLES = ['user', 'client', 'admin']
const ROLE_META = {
  admin: { Icon: ShieldCheck, cls: 'bg-primary-light text-primary', labelKey: 'admin.role_admin' },
  client: { Icon: Shield, cls: 'bg-sky-100 text-sky-700', labelKey: 'admin.role_client' },
  user: { Icon: UserRound, cls: 'bg-slate-100 text-muted', labelKey: 'admin.role_user' },
}

export default function AdminUsers() {
  const { t } = useTranslation()
  const { user: me } = useAuth()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(
    (q) => {
      setLoading(true)
      admin
        .listUsers(q)
        .then(({ data }) => {
          setItems(data.items)
          setTotal(data.total)
        })
        .catch((err) => toast.error(apiErrorMessage(err, t('admin.user_list_failed'))))
        .finally(() => setLoading(false))
    },
    [t]
  )

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), 300)
    return () => clearTimeout(timer)
  }, [input])

  useEffect(() => {
    load(query)
  }, [query, load])

  const changeRole = async (u, role) => {
    setBusyId(u.id)
    try {
      await admin.updateUser(u.id, { role })
      toast.success(t('admin.user_role_updated'))
      load(query)
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.user_failed')))
    } finally {
      setBusyId(null)
    }
  }

  const toggleActive = async (u) => {
    setBusyId(u.id)
    try {
      await admin.updateUser(u.id, { is_active: !u.is_active })
      toast.success(u.is_active ? t('admin.user_disabled') : t('admin.user_enabled'))
      load(query)
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.user_failed')))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(t('admin.user_delete_body', { email: u.email }))) return
    setBusyId(u.id)
    try {
      await admin.deleteUser(u.id)
      toast.success(t('admin.user_deleted'))
      load(query)
    } catch (err) {
      toast.error(apiErrorMessage(err, t('admin.user_failed')))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <AdminNav />

      <main id="main-content" className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">{t('admin.users_title')}</h1>
          <p className="text-sm text-muted">{t('admin.user_list_subtitle')}</p>
        </div>

        <div className="relative mb-4 max-w-md">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('admin.user_search_hint')}
            aria-label={t('admin.user_search_hint')}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">{t('admin.no_users')}</p>
        ) : (
          <div className="rounded-2xl border border-border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">{t('admin.user_name')}</th>
                  <th className="px-4 py-3 hidden sm:table-cell">{t('admin.user_joined')}</th>
                  <th className="px-4 py-3">{t('admin.role')}</th>
                  <th className="px-4 py-3">{t('admin.client_status')}</th>
                  <th className="px-4 py-3 text-right">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((u) => {
                  const isSelf = u.id === me?.id
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink">
                          {u.first_name} {u.last_name}
                          {isSelf && <span className="ml-2 text-xs font-normal text-muted">({t('admin.you')})</span>}
                        </p>
                        <p className="text-xs text-muted">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted hidden sm:table-cell">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const meta = ROLE_META[u.role] || ROLE_META.user
                          const RoleIcon = meta.Icon
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>
                              <RoleIcon className="w-3 h-3" aria-hidden="true" />
                              {t(meta.labelKey)}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {u.is_active ? t('admin.active') : t('admin.inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={u.role}
                            disabled={busyId === u.id || isSelf}
                            onChange={(e) => changeRole(u, e.target.value)}
                            aria-label={t('admin.change_role', { email: u.email })}
                            className="px-2 py-1.5 text-xs border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{t(`admin.role_${r}`)}</option>
                            ))}
                          </select>
                          <Button variant="secondary" size="sm" disabled={busyId === u.id || isSelf} onClick={() => toggleActive(u)}>
                            <Power className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                            {u.is_active ? t('admin.disable') : t('admin.enable')}
                          </Button>
                          <Button variant="ghost" size="sm" disabled={busyId === u.id || isSelf} onClick={() => handleDelete(u)} aria-label={t('admin.delete')}>
                            <Trash2 className="w-4 h-4 text-muted hover:text-red-500" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="px-4 py-3 text-xs text-muted border-t border-border">
              {t('admin.user_total', { total })}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
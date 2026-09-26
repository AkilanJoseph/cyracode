import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import Header from '../components/common/Header'
import AdminNav from '../components/admin/AdminNav'
import Button from '../components/common/Button'
import { admin } from '../services/api'
import { apiErrorMessage } from '../utils/errors'

const pageSize = 50

export default function AdminAuditLogs() {
  const { t } = useTranslation()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    (params) => {
      setLoading(true)
      admin
        .listAuditLogs(params)
        .then(({ data }) => {
          setItems(data.items)
          setTotal(data.total)
        })
        .catch((err) => toast.error(apiErrorMessage(err, t('admin.audit_failed'))))
        .finally(() => setLoading(false))
    },
    [t]
  )

  useEffect(() => {
    load({ action: action || undefined, page, page_size: pageSize })
  }, [action, page, load])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="min-h-screen bg-surface">
      <Header maxWidth="max-w-5xl" />
      <AdminNav />

      <main id="main-content" className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">{t('admin.audit_title')}</h1>
            <p className="text-sm text-muted">{t('admin.audit_subtitle')}</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted uppercase tracking-wide">{t('admin.filter_action')}</span>
            <input
              type="text"
              value={action}
              onChange={(e) => {
                setAction(e.target.value)
                setPage(1)
              }}
              placeholder="admin_login, cyracode_create…"
              className="px-3 py-2.5 text-sm border border-border rounded-xl bg-white text-ink outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">{t('admin.no_audit')}</p>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">{t('admin.audit_time')}</th>
                    <th className="px-4 py-3 hidden sm:table-cell">{t('admin.audit_user')}</th>
                    <th className="px-4 py-3">{t('admin.audit_action')}</th>
                    <th className="px-4 py-3 hidden md:table-cell">{t('admin.audit_ip')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted hidden sm:table-cell">{log.user_email || '—'}</td>
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs bg-slate-100 rounded px-2 py-0.5">{log.action}</code>
                      </td>
                      <td className="px-4 py-3 text-muted hidden md:table-cell">{log.ip_address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 text-sm text-muted">
              <span>
                {t('admin.showing')} {total === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} {t('admin.of')} {total}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t('admin.prev')}
                </Button>
                <span>{page} / {totalPages}</span>
                <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  {t('admin.next')}
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
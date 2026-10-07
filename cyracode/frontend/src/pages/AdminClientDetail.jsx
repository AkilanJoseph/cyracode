import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { ChevronLeft, Loader2 } from 'lucide-react'
import Header from '../components/common/Header'
import Footer from '../components/common/Footer'
import { ADMIN_MAX_WIDTH, ADMIN_PADDING_Y } from '../lib/layout'
import AdminNav from '../components/admin/AdminNav'
import { admin } from '../services/api'
import { apiErrorMessage } from '../utils/errors'
import { ClientDetailPanel } from './AdminClients'

// Where to send the admin when this screen was opened directly (typed URL or a
// refresh), since no origin screen was recorded in that case.
const FALLBACK_LIST = '/admin/clients'

export default function AdminClientDetail() {
  const { t } = useTranslation()
  const { clientId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  // The screen that opened this one, with its own search and filters intact.
  // AdminClients and AdminSubscriptions both pass this.
  const from = location.state?.from

  const load = useCallback(() => {
    if (!clientId) return
    setLoading(true)
    setMissing(false)
    // No single-client GET endpoint exists, so the id is resolved from the list
    // response the admin portal already uses.
    admin
      .listClients()
      .then(({ data }) => {
        const found = (data || []).find((c) => String(c.id) === String(clientId))
        if (found) setClient(found)
        else setMissing(true)
      })
      .catch((err) => toast.error(apiErrorMessage(err, t('admin.client_list_failed'))))
      .finally(() => setLoading(false))
  }, [clientId, t])

  useEffect(() => {
    load()
  }, [load])

  const goBack = () => navigate(from || FALLBACK_LIST)

  // Origins arrive as full URLs, so match on the path and let the label match even
  // when that list was carrying a search or filter query.
  const fromPath = typeof from === 'string' ? from.split('?')[0] : ''
  const backLabel =
    fromPath === '/admin/subscriptions' ? t('admin.back_to_subscriptions') : t('admin.back_to_clients')

  return (
    <div className="min-h-screen bg-surface">
      <Header maxWidth={ADMIN_MAX_WIDTH} />
      <AdminNav />

      <main id="main-content" className={`${ADMIN_MAX_WIDTH} mx-auto px-4 ${ADMIN_PADDING_Y}`}>
        <div className="mb-6">
          {/* Plain button when there is an origin screen, so the admin always
              returns to the exact list they came from rather than to history. */}
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            {backLabel}
          </button>
        </div>

        {loading && !client ? (
          <div className="flex items-center justify-center py-16 text-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden="true" /> {t('common.loading')}
          </div>
        ) : missing || !client ? (
          <div className="rounded-2xl border border-border bg-white p-10 text-center">
            <p className="text-muted">{t('admin.client_not_found')}</p>
            <div className="mt-6">
              <Link
                to={FALLBACK_LIST}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                {t('admin.back_to_clients')}
              </Link>
            </div>
          </div>
        ) : (
          // Refetches after an edit keep this panel mounted rather than swapping in
          // the spinner, so one-time values it holds — a freshly rotated key above
          // all — stay on screen instead of vanishing on reload.
          <ClientDetailPanel
            client={client}
            onClose={goBack}
            onChanged={load}
            refreshing={loading}
            showClose={false}
          />
        )}
      </main>

      <Footer variant="minimal" maxWidth={ADMIN_MAX_WIDTH} />
    </div>
  )
}

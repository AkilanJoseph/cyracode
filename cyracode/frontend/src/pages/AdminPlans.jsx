import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, X, Tag } from 'lucide-react'
import Header from '../components/common/Header'
import AdminNav from '../components/admin/AdminNav'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import { formatMoney } from '../components/admin/Badges'
import { admin } from '../services/api'
import { apiErrorMessage } from '../utils/errors'

function PlanFormModal({ mode, plan, onClose, onSaved }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(
    plan ?? { code: '', name: '', monthly_cost: '' }
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!String(form.code).trim()) errs.code = t('common.required')
    else if (!/^[a-z0-9_-]+$/i.test(String(form.code))) errs.code = t('admin.plan_code_invalid')
    if (!String(form.name).trim()) errs.name = t('common.required')
    const cost = Number(form.monthly_cost)
    if (!Number.isFinite(cost) || cost < 1) errs.monthly_cost = t('admin.plan_cost_invalid')
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSaving(true)
    try {
      if (mode === 'create') {
        await admin.createPlan({ code: String(form.code).trim(), name: String(form.name).trim(), monthly_cost: cost })
        toast.success(t('admin.plan_created'))
      } else {
        await admin.updatePlan(plan.code, { name: String(form.name).trim(), monthly_cost: cost })
        toast.success(t('admin.plan_updated'))
      }
      onSaved()
    } catch (err) {
      if (err?.response?.status === 409) toast.error(apiErrorMessage(err, t('admin.plan_exists')))
      else toast.error(apiErrorMessage(err, t('admin.plan_save_failed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-modal">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-ink">
            {mode === 'create' ? t('admin.plan_add_title') : t('admin.plan_edit_title')}
          </h2>
          <button onClick={onClose} aria-label={t('admin.close')} className="text-muted hover:text-ink">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'create' && (
            <Input id="admin-plan-code" label={t('admin.plan_code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} error={errors.code} placeholder="basic" />
          )}
          <Input id="admin-plan-name" label={t('admin.plan_name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <Input id="admin-plan-cost" label={t('admin.plan_cost')} type="number" min="1" step="1" value={form.monthly_cost} onChange={(e) => setForm({ ...form, monthly_cost: e.target.value })} error={errors.monthly_cost} />
          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={saving} className="flex-1">{t('admin.save')}</Button>
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">{t('admin.cancel')}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminPlans() {
  const { t } = useTranslation()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    admin
      .listPlans()
      .then(({ data }) => setPlans(data))
      .catch((err) => toast.error(apiErrorMessage(err, t('admin.plan_list_failed'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  const confirmDelete = async () => {
    setBusy(true)
    try {
      await admin.deletePlan(deleteTarget.code)
      toast.success(t('admin.plan_deleted'))
      setDeleteTarget(null)
      load()
    } catch (err) {
      if (err?.response?.status === 409) toast.error(t('admin.plan_in_use'))
      else toast.error(apiErrorMessage(err, t('admin.plan_save_failed')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header maxWidth="max-w-5xl" />
      <AdminNav />

      <main id="main-content" className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">{t('admin.plans_title')}</h1>
            <p className="text-sm text-muted">{t('admin.plans_subtitle')}</p>
          </div>
          <Button onClick={() => setModal({ mode: 'create' })}>
            <Plus className="w-4 h-4" aria-hidden="true" /> {t('admin.plan_add')}
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted">{t('admin.plan_no_plans')}</p>
        ) : (
          <div className="rounded-2xl border border-border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">{t('admin.plan_name')}</th>
                  <th className="px-4 py-3 hidden sm:table-cell">{t('admin.plan_code')}</th>
                  <th className="px-4 py-3">{t('admin.subs_cost')}</th>
                  <th className="px-4 py-3 text-right">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans.map((p) => (
                  <tr key={p.code} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-ink">{p.name}</td>
                    <td className="px-4 py-3 text-muted hidden sm:table-cell"><code className="font-mono">{p.code}</code></td>
                    <td className="px-4 py-3">{formatMoney(p.monthly_cost)}/mo</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setModal({ mode: 'edit', plan: p })}
                          aria-label={`${t('admin.edit')} ${p.name}`}
                          className="p-2 text-muted hover:text-ink hover:bg-slate-100 rounded-lg"
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          aria-label={`${t('admin.delete')} ${p.name}`}
                          className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-6 text-xs text-muted flex items-center gap-1">
          <Tag className="w-3.5 h-3.5" aria-hidden="true" /> {t('admin.plan_seed_hint')}
        </p>
      </main>

      {modal && (
        <PlanFormModal
          mode={modal.mode}
          plan={modal.plan}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            load()
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-modal">
            <h2 className="text-lg font-bold text-ink">{t('admin.plan_delete_title')}</h2>
            <p className="text-sm text-muted mt-1 mb-6">{t('admin.plan_delete_body', { name: deleteTarget.name })}</p>
            <div className="flex gap-3">
              <Button variant="danger" loading={busy} onClick={confirmDelete} className="flex-1">
                {t('admin.confirm_delete')}
              </Button>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">
                {t('admin.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
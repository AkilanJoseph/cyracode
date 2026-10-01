import { useTranslation } from 'react-i18next'
import { MessageCircleQuestion } from 'lucide-react'
import Header from '../components/common/Header'
import Footer from '../components/common/Footer'
import FAQItem from '../components/faq/FAQItem'
import { useContactWidget } from '../context/ContactWidgetContext'
import { FAQ_CATEGORIES } from '../lib/faqs'
import { MARKETING_MAX_WIDTH, MARKETING_PADDING_Y } from '../lib/layout'

export default function FAQPage() {
  const { t } = useTranslation()
  const { open: openContact } = useContactWidget()

  return (
    <div className="min-h-screen bg-surface">
      <Header maxWidth={MARKETING_MAX_WIDTH} marketingNav />

      <main
        id="main-content"
        className={`${MARKETING_MAX_WIDTH} mx-auto px-4 ${MARKETING_PADDING_Y}`}
      >
        <header className="text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink">{t('faq.title')}</h1>
          <p className="mt-3 text-muted leading-relaxed max-w-2xl mx-auto">
            {t('faq.subtitle')}
          </p>
        </header>

        {/* Fifty-one answers is a long page, so the headings are reachable from
            the top. Reuses the footer/support keys for the nav and CTA labels
            rather than adding duplicate strings. */}
        <nav aria-label={t('footer.faqs')} className="mt-8 flex flex-wrap justify-center gap-2">
          {FAQ_CATEGORIES.map((category) => (
            <a
              key={category.id}
              href={`#faq-${category.id}`}
              className="px-3 py-1.5 rounded-full border border-border bg-white text-sm
                text-muted hover:text-primary hover:border-primary/40 transition-colors"
            >
              {t(`faq.categories.${category.id}`)}
            </a>
          ))}
        </nav>

        {/* The page frame is the full marketing width, but the answers stay in
            a centred column — a 1000px-wide paragraph is unreadable. */}
        {FAQ_CATEGORIES.map((category) => {
          const headingId = `faq-${category.id}`
          return (
            <section key={category.id} aria-labelledby={headingId} className="mt-12 scroll-mt-20 max-w-3xl mx-auto">
              <h2
                id={headingId}
                className="text-xl sm:text-2xl font-bold text-ink pb-3 border-b border-border"
              >
                {t(`faq.categories.${category.id}`)}
              </h2>

              <div className="mt-4 space-y-3">
                {category.items.map((item) => (
                  <FAQItem key={item.q} question={item.q} answer={item.a} />
                ))}
              </div>
            </section>
          )
        })}

        {/* Opens the same enquiry widget as the footer so the page has a real
            way out for anything not covered above. */}
        <section className="mt-14 mb-4 max-w-3xl mx-auto rounded-2xl border border-border bg-white shadow-card p-6 sm:p-8 text-center">
          <MessageCircleQuestion className="w-7 h-7 mx-auto text-primary" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold text-ink">{t('footer.support')}</h2>
          <p className="mt-2 text-sm text-muted leading-relaxed max-w-xl mx-auto">
            {t('footer.queries')}
          </p>
          <button
            type="button"
            onClick={openContact}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
              bg-primary text-white text-sm font-semibold transition-colors
              hover:bg-primary-dark focus:outline-none focus-visible:ring-2
              focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            {t('footer.contact_us')}
          </button>
        </section>
      </main>

      <Footer maxWidth={MARKETING_MAX_WIDTH} />
    </div>
  )
}

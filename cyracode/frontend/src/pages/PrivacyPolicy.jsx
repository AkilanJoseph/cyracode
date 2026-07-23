import { Link } from 'react-router-dom'
import { MapPin, ArrowLeft } from 'lucide-react'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-surface">
      <nav className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-ink">CyraCode</span>
          </div>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-12 prose prose-sm text-ink">
        <h1 className="text-2xl font-bold text-ink mb-2">Privacy Policy</h1>
        <p className="text-muted text-sm mb-8">Effective date: 1 January 2025 &mdash; Last updated: 22 July 2026</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-3">1. Who We Are</h2>
          <p className="text-muted leading-relaxed">
            CyraCode (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates a universal address-naming platform. Our registered
            address and data-controller contact details are available at <span className="text-primary">support@cyracode.com</span>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-3">2. Data We Collect</h2>
          <ul className="list-disc pl-5 text-muted space-y-1 leading-relaxed">
            <li><strong>Account data:</strong> first name, last name, email address, and hashed password.</li>
            <li><strong>Address data:</strong> the CyraCode name, physical address, GPS coordinates, and address type you register.</li>
            <li><strong>Mobile number:</strong> collected solely to verify your identity via one-time passcode (OTP).</li>
            <li><strong>Usage data:</strong> IP address, browser user-agent, and action timestamps stored in audit logs.</li>
            <li><strong>Consent record:</strong> timestamp and checkbox state when you accepted this policy.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-3">3. How We Use Your Data</h2>
          <ul className="list-disc pl-5 text-muted space-y-1 leading-relaxed">
            <li>To create and maintain your CyraCode account.</li>
            <li>To verify your mobile number via OTP during registration.</li>
            <li>To allow other users to search for your publicly registered CyraCode.</li>
            <li>To send transactional emails (password reset, confirmation).</li>
            <li>To detect and prevent fraud, abuse, and security incidents.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-3">4. Legal Basis (GDPR Article 6)</h2>
          <ul className="list-disc pl-5 text-muted space-y-1 leading-relaxed">
            <li><strong>Consent (Art. 6(1)(a)):</strong> processing of your personal data during registration.</li>
            <li><strong>Contract (Art. 6(1)(b)):</strong> processing necessary to provide the service you requested.</li>
            <li><strong>Legitimate interests (Art. 6(1)(f)):</strong> security logging and fraud prevention.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-3">5. Your Rights Under GDPR</h2>
          <p className="text-muted leading-relaxed mb-3">
            If you are located in the European Economic Area or United Kingdom you have the following rights:
          </p>
          <ul className="list-disc pl-5 text-muted space-y-1 leading-relaxed">
            <li><strong>Right of access (Art. 15):</strong> request a copy of the personal data we hold about you.</li>
            <li><strong>Right to rectification (Art. 16):</strong> correct inaccurate personal data.</li>
            <li><strong>Right to erasure (Art. 17):</strong> delete your account and associated data via <em>Settings &rarr; Delete Account</em>.</li>
            <li><strong>Right to restriction (Art. 18):</strong> request we restrict processing of your data.</li>
            <li><strong>Right to data portability (Art. 20):</strong> receive your data in a machine-readable format.</li>
            <li><strong>Right to object (Art. 21):</strong> object to processing based on legitimate interests.</li>
          </ul>
          <p className="text-muted leading-relaxed mt-3">
            To exercise any of these rights, email <span className="text-primary">privacy@cyracode.com</span>. We will respond
            within 30 days.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-3">6. Data Retention</h2>
          <p className="text-muted leading-relaxed">
            Active account data is retained for as long as your account is open. When you delete your account, personal
            identifiers are anonymised within 24 hours. Audit log entries are retained for 12 months for security
            compliance, after which they are purged.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-3">7. Security</h2>
          <p className="text-muted leading-relaxed">
            All data in transit is protected by TLS 1.2 or higher. Passwords are hashed using bcrypt (cost factor 12)
            and are never stored or logged in plaintext. OTPs are hashed immediately after generation and expire after
            5 minutes.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-3">8. Cookies</h2>
          <p className="text-muted leading-relaxed">
            We use only functional session tokens stored in browser local storage. We do not use tracking or analytics
            cookies.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-3">9. Contact</h2>
          <p className="text-muted leading-relaxed">
            Data Controller: CyraCode &mdash; <span className="text-primary">privacy@cyracode.com</span>
          </p>
        </section>
      </main>
    </div>
  )
}

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Sparkles, Shield, ArrowLeft } from 'lucide-react';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className="mb-10"
  >
    <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
      <span className="w-1 h-6 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full inline-block" />
      {title}
    </h2>
    <div className="text-slate-400 leading-relaxed space-y-3 text-sm">{children}</div>
  </motion.div>
);

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050d12] relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-0 right-1/3 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <Link to="/" className="inline-flex items-center gap-3 mb-10 group">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/30">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <span className="text-xl font-black text-white tracking-tight">Pronote</span>
              <span className="block text-emerald-400 text-xs font-medium -mt-0.5">AI Medical Scribe</span>
            </div>
          </Link>

          <Link to="/signup" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-8 group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Sign Up
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center">
              <Shield size={26} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white">Privacy Policy</h1>
              <p className="text-slate-500 text-sm mt-1">Last updated: April 19, 2025</p>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4 text-sm text-blue-300/80">
            Your privacy is fundamental to how we build Pronote. This policy explains exactly what data we collect, why we collect it, and how we protect it — especially in healthcare settings.
          </div>
        </motion.div>

        {/* Content */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-8 backdrop-blur-sm">

          <Section title="1. Introduction">
            <p>Pronote ("we," "our," or "us") is committed to protecting your privacy and the privacy of your patients. This Privacy Policy describes how we collect, use, disclose, and safeguard information when you use our AI medical scribe platform.</p>
            <p>As a healthcare technology platform, we are acutely aware of the sensitivity of medical data and have designed our systems with privacy and HIPAA compliance as core principles.</p>
          </Section>

          <Section title="2. Information We Collect">
            <p><strong className="text-white">Account Information:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Full name, email address, and password (stored encrypted)</li>
              <li>Medical specialty and professional credentials</li>
              <li>Billing and payment information (processed securely via Stripe/PayPal — we do not store card numbers)</li>
              <li>Account preferences and settings</li>
            </ul>
            <p><strong className="text-white mt-3 block">Clinical Content:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Audio recordings you upload or capture for transcription</li>
              <li>AI-generated clinical notes and transcriptions</li>
              <li>Patient identifiers you enter (name, date of service, etc.)</li>
              <li>Note edits, templates, and documentation preferences</li>
            </ul>
            <p><strong className="text-white mt-3 block">Usage Data:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Log data including IP address, browser type, pages visited</li>
              <li>Session activity and feature usage patterns</li>
              <li>Device information and operating system</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-white">Provide the Service:</strong> Process audio, generate clinical notes, and deliver transcriptions</li>
              <li><strong className="text-white">Account Management:</strong> Create and manage your account, process payments, send receipts</li>
              <li><strong className="text-white">Customer Support:</strong> Respond to inquiries, troubleshoot issues, improve your experience</li>
              <li><strong className="text-white">Security:</strong> Detect and prevent fraudulent or unauthorized activity, enforce our Terms of Service</li>
              <li><strong className="text-white">Communications:</strong> Send account-related notifications, product updates (you may opt out)</li>
              <li><strong className="text-white">Service Improvement:</strong> Analyze anonymized, de-identified aggregate usage to improve AI accuracy and platform features</li>
            </ul>
            <p className="mt-2 text-amber-400/80 text-xs font-medium">⚠️ We do NOT use identifiable patient data to train AI models without explicit consent.</p>
          </Section>

          <Section title="4. HIPAA & Protected Health Information">
            <p>Pronote operates as a HIPAA Business Associate when processing Protected Health Information (PHI) on behalf of covered entities. We implement the required safeguards under the HIPAA Security Rule:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-white">Administrative Safeguards:</strong> Staff training, access controls, risk assessments</li>
              <li><strong className="text-white">Physical Safeguards:</strong> Secure data centers, workstation controls, device management</li>
              <li><strong className="text-white">Technical Safeguards:</strong> End-to-end encryption in transit (TLS 1.3) and at rest (AES-256)</li>
            </ul>
            <p>A signed Business Associate Agreement (BAA) is available for all customers. Contact <a href="mailto:legal@pronote.ai" className="text-blue-400 hover:underline">legal@pronote.ai</a> to request your BAA.</p>
          </Section>

          <Section title="5. Data Storage & Security">
            <p>All data is stored on enterprise-grade, SOC 2 Type II certified infrastructure. Key security measures include:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>All data encrypted in transit using TLS 1.3</li>
              <li>All data encrypted at rest using AES-256 encryption</li>
              <li>Passwords hashed using bcrypt with per-user salts</li>
              <li>Regular automated security audits and penetration testing</li>
              <li>Multi-factor authentication available for all accounts</li>
              <li>Automatic session expiration after 30 minutes of inactivity</li>
              <li>Comprehensive HIPAA-compliant audit logs for all data access</li>
            </ul>
          </Section>

          <Section title="6. Data Sharing & Disclosure">
            <p>We do <strong className="text-white">not sell</strong> your personal information or patient data to third parties. We may share data only in the following limited circumstances:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-white">Service Providers:</strong> Trusted vendors (cloud hosting, payment processors, email services) under strict data processing agreements</li>
              <li><strong className="text-white">Legal Requirements:</strong> When required by law, court order, or government regulation</li>
              <li><strong className="text-white">Safety:</strong> To protect the rights, property, or safety of Pronote, our users, or the public</li>
              <li><strong className="text-white">Business Transfers:</strong> In the event of a merger or acquisition, with 30 days' notice to users</li>
            </ul>
          </Section>

          <Section title="7. Audio Recording & Transcription">
            <p>Audio recordings submitted to Pronote are:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Processed securely using AI transcription services</li>
              <li>Encrypted during upload and storage</li>
              <li>Automatically deleted from processing servers within 24 hours of transcription</li>
              <li>Retained in your account only as long as you keep the associated note</li>
            </ul>
            <p>You are solely responsible for obtaining proper patient consent before recording any clinical encounter.</p>
          </Section>

          <Section title="8. Your Rights & Choices">
            <p>You have the following rights regarding your data:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-white">Access:</strong> Request a copy of all personal data we hold about you</li>
              <li><strong className="text-white">Correction:</strong> Update or correct inaccurate personal information via account settings</li>
              <li><strong className="text-white">Deletion:</strong> Request permanent deletion of your account and all associated data</li>
              <li><strong className="text-white">Portability:</strong> Export your notes and data in standard formats (JSON, PDF)</li>
              <li><strong className="text-white">Opt-Out:</strong> Unsubscribe from marketing emails at any time via account settings</li>
            </ul>
            <p>To exercise any of these rights, contact <a href="mailto:privacy@pronote.ai" className="text-blue-400 hover:underline">privacy@pronote.ai</a>. We will respond within 30 days.</p>
          </Section>

          <Section title="9. Cookies & Tracking">
            <p>Pronote uses minimal cookies necessary for the Service to function:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-white">Authentication cookies:</strong> To keep you logged in securely</li>
              <li><strong className="text-white">Preference cookies:</strong> To remember your settings and template choices</li>
            </ul>
            <p>We do <strong className="text-white">not</strong> use advertising cookies, third-party tracking pixels, or behavioral profiling. We do not use Google Analytics on pages containing PHI.</p>
          </Section>

          <Section title="10. Data Retention">
            <p>We retain your data for as long as your account is active. Upon account deletion:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Clinical notes and audio files are deleted within 30 days</li>
              <li>Account information is deleted within 30 days</li>
              <li>HIPAA audit logs are retained for 6 years as required by law</li>
              <li>Billing records are retained for 7 years for tax compliance</li>
            </ul>
          </Section>

          <Section title="11. Children's Privacy">
            <p>Pronote is intended exclusively for use by licensed healthcare professionals. The Service is not directed at individuals under 18 years of age. We do not knowingly collect personal information from minors.</p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email at least 14 days before the changes take effect. Your continued use of the Service after the effective date constitutes acceptance of the updated policy.</p>
          </Section>

          <Section title="13. Contact Us">
            <p>For privacy-related questions, data requests, or to report a privacy concern:</p>
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 mt-3 space-y-1">
              <p><span className="text-white font-semibold">Privacy Email:</span> <a href="mailto:privacy@pronote.ai" className="text-blue-400 hover:underline">privacy@pronote.ai</a></p>
              <p><span className="text-white font-semibold">Legal Email:</span> <a href="mailto:legal@pronote.ai" className="text-blue-400 hover:underline">legal@pronote.ai</a></p>
              <p><span className="text-white font-semibold">Support:</span> <a href="mailto:support@pronote.ai" className="text-blue-400 hover:underline">support@pronote.ai</a></p>
            </div>
          </Section>
        </div>

        {/* Footer CTA */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 text-center">
          <Link to="/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:opacity-90 transition-all">
            I Agree — Create My Account
          </Link>
          <p className="text-slate-600 text-xs mt-4">By clicking, you confirm you have read and agree to this Privacy Policy.</p>
        </motion.div>
      </div>
    </div>
  );
}

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Sparkles, Trash2, ArrowLeft, Mail, Settings as SettingsIcon } from 'lucide-react';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className="mb-10"
  >
    <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
      <span className="w-1 h-6 bg-gradient-to-b from-rose-400 to-red-500 rounded-full inline-block" />
      {title}
    </h2>
    <div className="text-slate-400 leading-relaxed space-y-3 text-sm">{children}</div>
  </motion.div>
);

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-[#050d12] relative overflow-hidden">
      <div className="absolute top-0 right-1/3 w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage: 'linear-gradient(rgba(244,63,94,1) 1px, transparent 1px), linear-gradient(90deg, rgba(244,63,94,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
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

          <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-8 group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to home
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-400/20 to-red-500/20 border border-rose-500/30 flex items-center justify-center">
              <Trash2 size={26} className="text-rose-400" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white">Delete your account</h1>
              <p className="text-slate-500 text-sm mt-1">Pronote — AI Medical Scribe</p>
            </div>
          </div>

          <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 text-sm text-rose-300/80">
            You can permanently delete your Pronote account and all associated data at any time. Two methods are available — choose whichever is more convenient.
          </div>
        </motion.div>

        <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-8 backdrop-blur-sm">

          <Section title="Method 1 — Delete from inside the app">
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Open Pronote on your device or sign in at <a href="/login" className="text-emerald-400 hover:underline">pronoteai.com/login</a>.</li>
              <li>Open <strong className="text-white">Settings</strong> from the sidebar.</li>
              <li>Scroll to <strong className="text-white">Danger zone</strong> at the bottom of the page.</li>
              <li>Click <strong className="text-white">Delete account</strong>.</li>
              <li>Type your email to confirm and click <strong className="text-white">Permanently delete</strong>.</li>
            </ol>
            <p className="mt-3">Your account and all associated data are permanently removed within minutes. You will receive a confirmation email when deletion is complete.</p>
          </Section>

          <Section title="Method 2 — Email request">
            <p>If you cannot sign in to your account, send a deletion request from the email address associated with your Pronote account:</p>
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 mt-3 flex items-center gap-3">
              <Mail size={18} className="text-emerald-400 flex-shrink-0" />
              <a href="mailto:support@pronoteai.com?subject=Account%20deletion%20request" className="text-emerald-300 font-mono text-sm hover:underline">
                support@pronoteai.com
              </a>
            </div>
            <p className="mt-3">Subject: <em>Account deletion request</em></p>
            <p>We will verify your identity and complete the deletion within <strong className="text-white">7 business days</strong>, in accordance with HIPAA recordkeeping requirements.</p>
          </Section>

          <Section title="What is deleted">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Your account profile (name, email, specialty, credentials)</li>
              <li>All audio recordings you have captured or uploaded</li>
              <li>All AI-generated clinical notes</li>
              <li>All patient identifiers and chart data you have entered</li>
              <li>Custom templates and saved preferences</li>
              <li>Authentication tokens and session history</li>
            </ul>
          </Section>

          <Section title="What is retained (and why)">
            <p>To meet legal, tax, and HIPAA recordkeeping obligations, we retain a limited set of data after account deletion:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-white">Anonymized billing and audit records</strong> — retained for 7 years for tax and HIPAA audit-trail compliance. These records do not contain identifiable patient information.</li>
              <li><strong className="text-white">Aggregated, non-identifiable analytics</strong> — retained indefinitely to improve Pronote's reliability. These cannot be linked back to you or your patients.</li>
            </ul>
            <p>No identifiable patient health information (PHI) is retained after account deletion.</p>
          </Section>

          <Section title="Need help?">
            <p>If you have any questions about deletion, data retention, or your privacy rights as a Pronote user, contact our privacy team at <a href="mailto:support@pronoteai.com" className="text-emerald-400 hover:underline">support@pronoteai.com</a>.</p>
            <p>For more information about how we handle your data, see our <Link to="/privacy" className="text-emerald-400 hover:underline">Privacy Policy</Link>.</p>
          </Section>

          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <Link to="/settings"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-red-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-rose-500/30 hover:from-rose-600 hover:to-red-600 transition-all">
              <SettingsIcon size={16} /> Open Settings to delete now
            </Link>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Pronote AI Medical Scribe — HIPAA-aligned clinical documentation platform
        </p>
      </div>
    </div>
  );
}

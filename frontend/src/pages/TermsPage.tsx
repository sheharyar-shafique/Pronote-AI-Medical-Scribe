import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Sparkles, FileText, ArrowLeft } from 'lucide-react';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className="mb-10"
  >
    <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
      <span className="w-1 h-6 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-full inline-block" />
      {title}
    </h2>
    <div className="text-slate-400 leading-relaxed space-y-3 text-sm">{children}</div>
  </motion.div>
);

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050d12] relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage: 'linear-gradient(rgba(52,211,153,1) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
              <FileText size={26} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white">Terms of Service</h1>
              <p className="text-slate-500 text-sm mt-1">Last updated: April 19, 2025</p>
            </div>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 text-sm text-emerald-300/80">
            Please read these Terms of Service carefully before using Pronote. By creating an account, you agree to be bound by these terms.
          </div>
        </motion.div>

        {/* Content */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-8 backdrop-blur-sm">

          <Section title="1. Acceptance of Terms">
            <p>By accessing or using Pronote ("the Service"), you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using the Service.</p>
            <p>We reserve the right to modify these terms at any time. We will notify registered users of significant changes via email. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>Pronote is an AI-powered medical scribe platform designed to assist healthcare professionals with clinical documentation. The Service uses artificial intelligence to transcribe and generate clinical notes based on voice input, audio recordings, or conversation captures.</p>
            <p>Pronote is a documentation assistance tool only. It is <strong className="text-white">not a medical device</strong>, does not provide medical advice, and does not replace the clinical judgment of a licensed healthcare professional.</p>
          </Section>

          <Section title="3. Medical Disclaimer">
            <p>
              <strong className="text-amber-400">⚠️ Important:</strong> All AI-generated clinical notes must be reviewed, verified, and approved by a licensed healthcare professional before being used in patient care decisions or entered into any official medical record.
            </p>
            <p>Pronote makes no representations or warranties regarding the accuracy, completeness, or fitness for purpose of any AI-generated content. You, as the licensed clinician, bear full professional and legal responsibility for all clinical documentation submitted under your credentials.</p>
            <p>Pronote shall not be liable for any clinical decisions made based on AI-generated notes without proper clinician review and verification.</p>
          </Section>

          <Section title="4. HIPAA Compliance & Patient Privacy">
            <p>Pronote is designed with HIPAA compliance in mind. We implement administrative, technical, and physical safeguards to protect Protected Health Information (PHI) as required by the Health Insurance Portability and Accountability Act (HIPAA).</p>
            <p>As a covered entity or business associate, you are responsible for:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Obtaining proper patient consent before recording or transcribing conversations</li>
              <li>Ensuring your use of the Service complies with applicable HIPAA regulations</li>
              <li>Not sharing your account credentials with unauthorized individuals</li>
              <li>Immediately reporting any suspected security breaches to our team</li>
            </ul>
            <p>A Business Associate Agreement (BAA) is available for enterprise customers upon request at <a href="mailto:legal@pronote.ai" className="text-emerald-400 hover:underline">legal@pronote.ai</a>.</p>
          </Section>

          <Section title="5. Account Registration & Security">
            <p>You must provide accurate, complete, and current information when creating your account. You are responsible for maintaining the confidentiality of your password and for all activities that occur under your account.</p>
            <p>You agree to immediately notify Pronote of any unauthorized use of your account or any other breach of security. Pronote will not be liable for any loss resulting from someone else using your account with or without your knowledge.</p>
            <p>You may not use another person's account, share your account credentials, or create accounts for the purpose of fraudulent activities.</p>
          </Section>

          <Section title="6. Subscription Plans & Billing">
            <p>Pronote offers a <strong className="text-white">7-day free trial</strong> for new users, after which a paid subscription is required to continue using the Service. Trial accounts that are not converted to a paid plan will be suspended after the trial period expires.</p>
            <p>Subscription plans are billed on a monthly or annual basis as selected at checkout. All fees are non-refundable except as expressly provided in our Refund Policy.</p>
            <p>We reserve the right to change our pricing at any time with 30 days' notice to existing subscribers. Failure to pay subscription fees will result in account suspension.</p>
          </Section>

          <Section title="7. Acceptable Use">
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Violate any applicable laws, regulations, or professional standards</li>
              <li>Record or transcribe conversations without proper consent</li>
              <li>Attempt to reverse-engineer, decompile, or hack the Service</li>
              <li>Transmit malicious code, viruses, or harmful content</li>
              <li>Use the Service for any purpose other than legitimate clinical documentation</li>
              <li>Share, sell, or sublicense access to the Service to third parties</li>
            </ul>
          </Section>

          <Section title="8. Data Ownership & Retention">
            <p>You retain ownership of all patient data and clinical notes created through the Service. Pronote does not claim ownership of your clinical content.</p>
            <p>Pronote retains the right to use anonymized, de-identified aggregate data to improve the Service and its AI models. No identifiable patient data will be used for model training without explicit consent.</p>
            <p>Upon account deletion, your data will be permanently removed from our systems within 30 days, subject to any legal retention requirements.</p>
          </Section>

          <Section title="9. Intellectual Property">
            <p>The Pronote platform, including its software, AI models, design, and branding, is the exclusive property of Pronote and is protected by copyright, trademark, and other intellectual property laws.</p>
            <p>You are granted a limited, non-exclusive, non-transferable license to use the Service for your professional clinical documentation needs.</p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>To the fullest extent permitted by law, Pronote shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill, arising out of or in connection with your use of the Service.</p>
            <p>Pronote's total liability for any claim related to the Service shall not exceed the amount you paid to Pronote in the 12 months preceding the claim.</p>
          </Section>

          <Section title="11. Termination">
            <p>Pronote reserves the right to suspend or terminate your account at any time for violation of these Terms of Service, failure to pay subscription fees, or for any other reason at our sole discretion with reasonable notice.</p>
            <p>You may terminate your account at any time by contacting our support team. Termination does not entitle you to any refund of prepaid subscription fees.</p>
          </Section>

          <Section title="12. Governing Law">
            <p>These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any disputes shall be resolved through binding arbitration in accordance with the American Arbitration Association rules.</p>
          </Section>

          <Section title="13. Contact Us">
            <p>If you have questions about these Terms of Service, please contact us:</p>
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 mt-3 space-y-1">
              <p><span className="text-white font-semibold">Email:</span> <a href="mailto:legal@pronote.ai" className="text-emerald-400 hover:underline">legal@pronote.ai</a></p>
              <p><span className="text-white font-semibold">Support:</span> <a href="mailto:support@pronote.ai" className="text-emerald-400 hover:underline">support@pronote.ai</a></p>
              <p><span className="text-white font-semibold">Website:</span> <a href="https://pronote.ai" className="text-emerald-400 hover:underline">pronote.ai</a></p>
            </div>
          </Section>
        </div>

        {/* Footer CTA */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 text-center">
          <Link to="/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:opacity-90 transition-all">
            I Agree — Create My Account
          </Link>
          <p className="text-slate-600 text-xs mt-4">By clicking, you confirm you have read and agree to these terms.</p>
        </motion.div>
      </div>
    </div>
  );
}

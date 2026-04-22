import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, FileCheck, Download, CheckCircle, AlertCircle,
  Building2, User, Calendar, Lock
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { useAuthStore } from '../store';
import { apiFetch } from '../services/api';
import toast from 'react-hot-toast';

interface BaaStatus {
  accepted: boolean;
  acceptedAt: string | null;
  organization: string | null;
  signerTitle: string | null;
  name: string;
  email: string;
  plan: string;
}

// Use the internal apiFetch — re-export it from api.ts
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(
    `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}${endpoint}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export default function HipaaBaaPage() {
  const { user } = useAuthStore();
  const [status, setStatus] = useState<BaaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [form, setForm] = useState({ organizationName: '', signerTitle: 'Practice Administrator' });

  const isGroupAnnual = user?.subscriptionPlan === 'group_annual';

  useEffect(() => {
    apiCall<BaaStatus>('/support/baa-status')
      .then(setStatus)
      .catch(() => toast.error('Failed to load BAA status'))
      .finally(() => setLoading(false));
  }, []);

  const handleAccept = async () => {
    if (!form.organizationName.trim()) {
      toast.error('Organization name is required');
      return;
    }
    setAccepting(true);
    try {
      await apiCall('/support/accept-baa', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setStatus(prev => prev ? {
        ...prev,
        accepted: true,
        acceptedAt: new Date().toISOString(),
        organization: form.organizationName,
        signerTitle: form.signerTitle,
      } : prev);
      toast.success('HIPAA BAA accepted and recorded!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to accept BAA');
    } finally {
      setAccepting(false);
    }
  };

  const handleDownload = () => {
    const html = generateBaaDocument(
      status?.organization || form.organizationName || '[Organization Name]',
      status?.name || user?.name || '',
      status?.signerTitle || form.signerTitle,
      status?.acceptedAt || undefined
    );
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'pronote-hipaa-baa.html';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('BAA document downloaded — open in browser to print/save as PDF');
  };

  return (
    <Sidebar>
      <div className="relative min-h-screen overflow-x-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-7 lg:p-9 max-w-4xl mx-auto">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Shield size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">HIPAA Business Associate Agreement</h1>
                <p className="text-slate-500 text-sm">Required for handling Protected Health Information (PHI)</p>
              </div>
            </div>
          </motion.div>

          {/* Plan gate */}
          {!isGroupAnnual && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-6 mb-6">
              <div className="flex items-start gap-4">
                <AlertCircle size={22} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-400 font-bold mb-1">Group Annual Plan Required</p>
                  <p className="text-slate-400 text-sm">HIPAA BAA is included in the <strong className="text-white">Group Annual ($460/year)</strong> plan. Upgrade to access this document and HIPAA compliance features.</p>
                </div>
              </div>
            </motion.div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* BAA Status Card */}
              {status?.accepted && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-6 mb-6">
                  <div className="flex items-start gap-4">
                    <CheckCircle size={22} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-emerald-400 font-bold mb-3">✅ BAA Accepted & Active</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><p className="text-slate-500 text-xs mb-0.5">Organization</p><p className="text-white font-semibold">{status.organization}</p></div>
                        <div><p className="text-slate-500 text-xs mb-0.5">Signer Title</p><p className="text-white font-semibold">{status.signerTitle}</p></div>
                        <div><p className="text-slate-500 text-xs mb-0.5">Accepted By</p><p className="text-white font-semibold">{status.name}</p></div>
                        <div><p className="text-slate-500 text-xs mb-0.5">Date Accepted</p><p className="text-white font-semibold">{new Date(status.acceptedAt!).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* BAA Document Preview */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden mb-6">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <FileCheck size={18} className="text-emerald-400" />
                    <span className="text-white font-bold text-sm">BAA Document</span>
                  </div>
                  <button onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 rounded-xl text-xs font-bold transition-all">
                    <Download size={14} /> Download BAA
                  </button>
                </div>

                <div className="p-6 max-h-96 overflow-y-auto space-y-4 text-sm text-slate-300 leading-relaxed">
                  <div>
                    <h3 className="text-white font-bold text-base mb-1">HIPAA Business Associate Agreement</h3>
                    <p className="text-slate-500 text-xs">Between Covered Entity (Practice) and Pronote AI Medical Scribe (Business Associate)</p>
                  </div>

                  {[
                    { title: '1. Definitions', text: 'Terms used but not otherwise defined in this Agreement shall have the same meaning as those terms in the HIPAA Rules, 45 CFR Parts 160 and 164. "Business Associate" means Pronote AI Medical Scribe. "Covered Entity" means the healthcare provider or practice entering into this Agreement.' },
                    { title: '2. Obligations of Business Associate', text: 'Business Associate agrees to: (a) not use or disclose PHI other than as permitted or required by this Agreement or as required by law; (b) use appropriate safeguards to prevent use or disclosure of PHI other than as provided for by this Agreement; (c) report to Covered Entity any use or disclosure of PHI not provided for by this Agreement; (d) ensure any subcontractors agree to the same restrictions; (e) make PHI available to Covered Entity as required by 45 CFR §164.524.' },
                    { title: '3. Permitted Uses and Disclosures', text: 'Business Associate may use or disclose PHI to perform functions, activities, or services for, or on behalf of, Covered Entity. Business Associate may use PHI for the proper management and administration of Business Associate or to carry out legal responsibilities. Business Associate may disclose PHI for such purposes if required by law or if Business Associate obtains reasonable assurances from the person to whom the information is disclosed.' },
                    { title: '4. Security Standards', text: 'Business Associate shall implement administrative, physical, and technical safeguards that reasonably and appropriately protect the confidentiality, integrity, and availability of ePHI that it creates, receives, maintains, or transmits. Business Associate uses AES-256 encryption at rest, TLS 1.3 in transit, role-based access controls, and audit logging.' },
                    { title: '5. Breach Notification', text: 'Business Associate shall notify Covered Entity without unreasonable delay and no later than 60 days following discovery of a breach of Unsecured PHI. Notification shall include: identification of individuals whose PHI was involved, description of the breach, steps individuals should take, and steps Business Associate is taking to investigate and prevent future breaches.' },
                    { title: '6. Term and Termination', text: 'This Agreement shall remain in effect for the duration of the service agreement between the parties. Either party may terminate this Agreement upon 30 days written notice. Upon termination, Business Associate shall return or destroy all PHI.' },
                    { title: '7. Governing Law', text: 'This Agreement shall be governed by and interpreted in accordance with HIPAA, the HITECH Act, and applicable federal regulations. In the event of any conflict between this Agreement and HIPAA, HIPAA shall control.' },
                  ].map((s, i) => (
                    <div key={i}>
                      <h4 className="text-white font-semibold mb-1">{s.title}</h4>
                      <p className="text-slate-400 text-xs leading-relaxed">{s.text}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Accept Form */}
              {!status?.accepted && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                  <h3 className="text-white font-bold mb-1">Accept Business Associate Agreement</h3>
                  <p className="text-slate-500 text-xs mb-6">By accepting, you confirm you are authorized to enter into this agreement on behalf of your organization.</p>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        <Building2 size={13} /> Organization / Practice Name *
                      </label>
                      <input
                        value={form.organizationName}
                        onChange={e => setForm(f => ({ ...f, organizationName: e.target.value }))}
                        placeholder="e.g. Riverside Family Medicine"
                        disabled={!isGroupAnnual}
                        className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        <User size={13} /> Your Title / Role *
                      </label>
                      <input
                        value={form.signerTitle}
                        onChange={e => setForm(f => ({ ...f, signerTitle: e.target.value }))}
                        placeholder="e.g. Practice Administrator, Chief Medical Officer"
                        disabled={!isGroupAnnual}
                        className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-slate-500">
                      <Lock size={13} className="text-emerald-400 flex-shrink-0" />
                      <span>Signing as: <strong className="text-white">{user?.name}</strong> ({user?.email}) · Date: <strong className="text-white">{new Date().toLocaleDateString()}</strong></span>
                    </div>
                  </div>

                  <button
                    onClick={handleAccept}
                    disabled={!isGroupAnnual || accepting || !form.organizationName.trim()}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {accepting ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                    ) : (
                      <><CheckCircle size={16} /> I Accept the Business Associate Agreement</>
                    )}
                  </button>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </Sidebar>
  );
}

function generateBaaDocument(org: string, signerName: string, signerTitle: string, acceptedAt?: string): string {
  const date = acceptedAt ? new Date(acceptedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Pending';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>HIPAA BAA — Pronote AI</title>
  <style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:40px;color:#1a1a1a;line-height:1.7;}
  h1{font-size:22px;border-bottom:3px solid #10b981;padding-bottom:12px;margin-bottom:24px;}
  h2{font-size:14px;margin:24px 0 6px;color:#059669;text-transform:uppercase;letter-spacing:1px;}
  p{font-size:13px;margin:0 0 12px;color:#374151;}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:24px 0;}
  .meta-item{font-size:12px;} .meta-item strong{display:block;color:#059669;margin-bottom:2px;}
  .sig{margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;display:grid;grid-template-columns:1fr 1fr;gap:40px;}
  .sig-box{border-top:2px solid #374151;padding-top:8px;font-size:12px;color:#6b7280;}
  @media print{body{margin:20px;}}</style></head>
  <body>
  <div style="text-align:center;margin-bottom:32px;"><div style="font-size:11px;color:#10b981;font-weight:800;letter-spacing:2px;">PRONOTE AI MEDICAL SCRIBE</div></div>
  <h1>HIPAA Business Associate Agreement</h1>
  <div class="meta">
    <div class="meta-item"><strong>Covered Entity (Practice)</strong>${org}</div>
    <div class="meta-item"><strong>Business Associate</strong>Pronote AI Medical Scribe</div>
    <div class="meta-item"><strong>Effective Date</strong>${date}</div>
    <div class="meta-item"><strong>Agreement Type</strong>Business Associate Agreement</div>
  </div>
  ${['1. Definitions — Terms used but not otherwise defined in this Agreement shall have the same meaning as those terms in the HIPAA Rules, 45 CFR Parts 160 and 164.',
    '2. Obligations of Business Associate — Business Associate shall not use or disclose PHI other than as permitted or required by this Agreement or as required by law. Business Associate shall use appropriate safeguards to prevent use or disclosure of PHI other than as provided for by this Agreement.',
    '3. Permitted Uses and Disclosures — Business Associate may use or disclose PHI to perform functions, activities, or services for or on behalf of Covered Entity as specified in the service agreement.',
    '4. Security Standards — Business Associate shall implement administrative, physical, and technical safeguards (AES-256 encryption at rest, TLS 1.3 in transit, audit logging, RBAC) to reasonably and appropriately protect the confidentiality, integrity, and availability of ePHI.',
    '5. Breach Notification — Business Associate shall notify Covered Entity without unreasonable delay and no later than 60 days following discovery of a breach of Unsecured PHI.',
    '6. Term and Termination — This Agreement shall remain in effect for the duration of the service agreement. Either party may terminate upon 30 days written notice.',
  ].map(s => {
    const [title, ...rest] = s.split(' — ');
    return `<h2>${title}</h2><p>${rest.join(' — ')}</p>`;
  }).join('')}
  <div class="sig">
    <div><div class="sig-box"><strong>${signerName || '_______________________'}</strong><br>Authorized Representative, Covered Entity<br>${signerTitle}<br>${org}<br>Date: ${date}</div></div>
    <div><div class="sig-box"><strong>Pronote AI Medical Scribe</strong><br>Business Associate<br>Authorized Signatory<br>Date: ${date}</div></div>
  </div>
  <p style="margin-top:32px;font-size:11px;color:#9ca3af;text-align:center;">This document constitutes a legally binding agreement under HIPAA 45 CFR Parts 160 and 164. Generated by Pronote AI — ${new Date().toLocaleDateString()}</p>
  </body></html>`;
}

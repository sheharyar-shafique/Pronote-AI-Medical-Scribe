import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Play, Star, Clock, Shield, Zap, ChevronDown, Check, Mic, FileText,
  Users, ArrowRight, Sparkles, Brain, Lock, RefreshCw, Menu, X
} from 'lucide-react';
import { useState } from 'react';
import { faqs, pricingPlans } from '../data';

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const navLinks = ['Features', 'Pricing', 'About'];

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:scale-105 transition-transform">
              <Sparkles size={17} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">Pronote</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(l => (
              <a key={l} href={`#${l.toLowerCase()}`}
                className="text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors">
                {l}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Sign In
            </Link>
            <Link to="/signup"
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-200 hover:from-emerald-600 hover:to-teal-700 transition-all">
              Start Free Trial
            </Link>
          </div>

          <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-2 rounded-lg hover:bg-slate-100">
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileMenu && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-3">
            {navLinks.map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setMobileMenu(false)}
                className="block text-slate-700 font-medium py-2">{l}</a>
            ))}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              <Link to="/login" onClick={() => setMobileMenu(false)} className="text-center py-2.5 text-slate-700 font-medium rounded-xl border border-slate-200">Sign In</Link>
              <Link to="/signup" onClick={() => setMobileMenu(false)} className="text-center py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl">Start Free Trial</Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────── */}
      <section className="relative min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center pt-16 overflow-hidden">
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-[10%] w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-[10%] w-80 h-80 bg-teal-500/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/8 rounded-full blur-3xl" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-medium mb-6">
                <Zap size={13} /> Trusted by 50,000+ clinicians
              </motion.div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                Your clinical notes.{' '}
                <span className="relative">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                    Auto
                  </span>
                </span>{' '}
                generated.
              </h1>

              <p className="text-lg text-slate-400 mb-8 leading-relaxed max-w-xl">
                Save 2+ hours per day on documentation. Our AI listens to your patient conversations and generates accurate clinical notes instantly.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-10">
                <Link to="/signup">
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-xl shadow-emerald-500/30 hover:from-emerald-600 hover:to-teal-600 transition-all w-full sm:w-auto">
                    Start Free Trial <ArrowRight size={18} />
                  </motion.button>
                </Link>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/15 transition-all backdrop-blur-sm w-full sm:w-auto">
                  <Play size={16} className="fill-white" /> Watch Demo
                </motion.button>
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2.5">
                  {['E','S','J','M','R'].map((l, i) => (
                    <div key={i} className={`w-9 h-9 rounded-full border-2 border-slate-800 flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br ${
                      ['from-emerald-400 to-teal-500','from-blue-400 to-indigo-500','from-violet-400 to-purple-500','from-rose-400 to-pink-500','from-amber-400 to-orange-500'][i]
                    }`}>{l}</div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(i => <Star key={i} size={14} className="fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-slate-400 text-sm">from 2,000+ reviews</p>
                </div>
              </div>
            </motion.div>

            {/* Right — Dashboard mockup */}
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
              className="relative hidden lg:block">
              {/* Main card */}
              <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                {/* Top bar */}
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <div className="flex-1 bg-white/10 rounded-lg h-6 ml-2" />
                </div>

                {/* Mock stats */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[{v:'24',l:'Notes Today',c:'from-emerald-400 to-teal-500'},{v:'98%',l:'Accuracy',c:'from-blue-400 to-indigo-500'},{v:'2.1h',l:'Time Saved',c:'from-violet-400 to-purple-500'}].map((s,i) => (
                    <div key={i} className="bg-white/8 rounded-xl p-3">
                      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${s.c} flex items-center justify-center mb-2`}>
                        <div className="w-3 h-3 bg-white/60 rounded-sm" />
                      </div>
                      <p className="text-white font-bold text-lg">{s.v}</p>
                      <p className="text-slate-400 text-xs">{s.l}</p>
                    </div>
                  ))}
                </div>

                {/* Mock note entry */}
                <div className="space-y-2">
                  {[{w:'80%',h:'12px'},{w:'65%',h:'12px'},{w:'90%',h:'12px'},{w:'50%',h:'12px'}].map((b,i) => (
                    <div key={i} className="bg-white/10 rounded-lg" style={{width:b.w, height:b.h}} />
                  ))}
                </div>

                {/* Green pulse */}
                <div className="mt-4 flex items-center gap-2">
                  <motion.div animate={{ scale: [1,1.3,1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
                  <span className="text-emerald-400 text-xs font-medium">AI generating note...</span>
                </div>
              </div>

              {/* Floating badge 1 */}
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                className="absolute -bottom-5 -left-8 bg-white rounded-2xl shadow-2xl p-3.5 flex items-center gap-3 border border-slate-100">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Clock size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">2+ hours saved</p>
                  <p className="text-slate-500 text-xs">per day on average</p>
                </div>
              </motion.div>

              {/* Floating badge 2 */}
              <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut', delay: 0.5 }}
                className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-2xl p-3 flex items-center gap-2 border border-slate-100">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Shield size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-xs">HIPAA Compliant</p>
                  <p className="text-slate-400 text-xs">100% secure</p>
                </div>
              </motion.div>

              {/* Decorative glow */}
              <div className="absolute -inset-4 bg-emerald-500/10 rounded-3xl blur-2xl -z-10" />
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-500">
          <ChevronDown size={24} />
        </motion.div>
      </section>

      {/* ── Stats Bar ──────────────────────────── */}
      <section className="bg-white border-b border-slate-100 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '50,000+', label: 'Active clinicians', color: 'text-emerald-600' },
              { value: '2M+', label: 'Notes generated', color: 'text-blue-600' },
              { value: '10,000+', label: 'Hours saved daily', color: 'text-violet-600' },
              { value: '98.5%', label: 'Accuracy rate', color: 'text-amber-600' },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="text-center">
                <p className={`text-3xl sm:text-4xl font-bold ${stat.color} mb-1`}>{stat.value}</p>
                <p className="text-slate-500 text-sm">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────── */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-4">
              <Sparkles size={13} /> Features
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Built for clinicians, by clinicians.
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Every feature designed to save you time and improve documentation quality.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <Clock size={24} />, color: 'from-emerald-400 to-teal-500', glow: 'group-hover:shadow-emerald-100',
                title: 'Save 2+ hours/day', desc: 'Streamline your notes and reclaim time for what truly matters—your patients and your life.' },
              { icon: <Shield size={24} />, color: 'from-blue-400 to-indigo-500', glow: 'group-hover:shadow-blue-100',
                title: 'HIPAA compliant & secure', desc: 'Your patients\' data is encrypted and secure with industry-leading security protocols.' },
              { icon: <Zap size={24} />, color: 'from-violet-400 to-purple-500', glow: 'group-hover:shadow-violet-100',
                title: 'Instant accuracy', desc: 'AI-powered medical speech recognition delivers accurate clinical documentation instantly.' },
              { icon: <Brain size={24} />, color: 'from-rose-400 to-pink-500', glow: 'group-hover:shadow-rose-100',
                title: 'AI-powered summaries', desc: 'GPT-4 generates structured SOAP notes, HPI, assessment and plan automatically.' },
              { icon: <RefreshCw size={24} />, color: 'from-amber-400 to-orange-500', glow: 'group-hover:shadow-amber-100',
                title: 'Real-time transcription', desc: 'See your conversation transcribed live as you speak with your patient.' },
              { icon: <Lock size={24} />, color: 'from-cyan-400 to-sky-500', glow: 'group-hover:shadow-cyan-100',
                title: 'Role-based access', desc: 'Secure multi-user support with admin controls and audit logging built in.' },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                <div className={`group bg-white rounded-2xl border border-slate-100 p-6 h-full hover:shadow-xl ${f.glow} transition-all duration-300 hover:-translate-y-1`}>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-4">
                Simple & Powerful
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Super simple,<br />super powerful.
              </h2>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Just press record at the start of your visit. Our AI handles the rest—transcribing, organizing and generating clinical notes in seconds.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  { step: '1', title: 'Press record', desc: 'One tap to start capturing your patient visit' },
                  { step: '2', title: 'AI transcribes', desc: 'Real-time medical speech recognition at 98%+ accuracy' },
                  { step: '3', title: 'Note generated', desc: 'Structured SOAP note ready in under 60 seconds' },
                ].map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                    className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-lg shadow-emerald-200">
                      {s.step}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{s.title}</h4>
                      <p className="text-slate-500 text-sm">{s.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <Link to="/signup">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200 hover:from-emerald-600 hover:to-teal-700 transition-all">
                  Get Started Free <ArrowRight size={18} />
                </motion.button>
              </Link>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="relative">
                <img src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=700&auto=format&fit=crop"
                  alt="Doctor with patient" className="rounded-3xl shadow-2xl w-full object-cover" />
                {/* Overlay card */}
                <motion.div animate={{ y: [0,-8,0] }} transition={{ repeat: Infinity, duration: 3.5 }}
                  className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-4 border border-slate-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                      <Mic size={15} className="text-white" />
                    </div>
                    <div>
                      <p className="text-slate-900 font-semibold text-sm">AI Note Generated</p>
                      <p className="text-emerald-600 text-xs">52 seconds</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1 text-emerald-600 text-xs font-medium bg-emerald-50 px-2 py-1 rounded-lg">
                      <Check size={12} /> SOAP
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 bg-slate-200 rounded-full w-full" />
                    <div className="h-2 bg-slate-200 rounded-full w-4/5" />
                    <div className="h-2 bg-slate-200 rounded-full w-3/5" />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── For Different Roles ─────────────────── */}
      <section className="py-24 bg-slate-900" id="about">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              For every healthcare professional
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Whether you're a physician, nurse, or therapist — Pronote adapts to your specialty.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <Users size={28} />, gradient: 'from-emerald-400 to-teal-500', title: 'For MDs',
                desc: 'Streamlined notes, clinical accuracy, and integration with your existing workflows.', badge: '50,000+ MDs' },
              { icon: <FileText size={28} />, gradient: 'from-blue-400 to-indigo-500', title: 'For RNs',
                desc: 'Document patient assessments and care plans in a fraction of the time.', badge: '20,000+ RNs' },
              { icon: <Mic size={28} />, gradient: 'from-violet-400 to-purple-500', title: 'For Therapists',
                desc: 'Capture session details while staying present with your clients.', badge: '15,000+ Therapists' },
            ].map((role, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center h-full hover:bg-white/8 transition-all hover:-translate-y-1">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${role.gradient} flex items-center justify-center mx-auto mb-5 text-white shadow-xl`}>
                    {role.icon}
                  </div>
                  <span className="inline-block text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full mb-3">
                    {role.badge}
                  </span>
                  <h3 className="text-xl font-semibold text-white mb-3">{role.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{role.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────── */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-4">
              Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-slate-500 text-lg">
              Try any plan free for 14 days. No credit card required.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                <div className={`relative rounded-2xl p-6 h-full flex flex-col transition-all duration-300 ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-2xl scale-105 border-0'
                    : 'bg-white border border-slate-200 hover:shadow-xl hover:-translate-y-1'
                }`}>
                  {plan.highlighted && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg">
                      MOST POPULAR
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className={`text-lg font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-2">
                      {plan.price ? (
                        <>
                          <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>${plan.price}</span>
                          <span className={plan.highlighted ? 'text-slate-400' : 'text-slate-400'}>/{plan.period}</span>
                        </>
                      ) : (
                        <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>Custom</span>
                      )}
                    </div>
                    {plan.originalPrice && (
                      <p className={`text-sm line-through ${plan.highlighted ? 'text-slate-500' : 'text-slate-400'}`}>${plan.originalPrice}/month</p>
                    )}
                    <p className={`text-sm mt-2 ${plan.highlighted ? 'text-slate-400' : 'text-slate-500'}`}>{plan.description}</p>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          plan.highlighted ? 'bg-emerald-500/20' : 'bg-emerald-100'
                        }`}>
                          <Check size={11} className={plan.highlighted ? 'text-emerald-400' : 'text-emerald-600'} />
                        </div>
                        <span className={`text-sm ${plan.highlighted ? 'text-slate-300' : 'text-slate-600'}`}>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup">
                    <button className={`w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all ${
                      plan.highlighted
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/30'
                        : 'border-2 border-slate-200 text-slate-900 hover:border-emerald-500 hover:text-emerald-600'
                    }`}>
                      {plan.cta}
                    </button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-slate-400 text-sm mt-8">
            All plans include a 14-day free trial. Cancel anytime. No hidden fees.
          </p>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────── */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Frequently asked questions
            </h2>
            <p className="text-slate-500">Everything you need to know about Pronote.</p>
          </motion.div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div key={faq.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.04 }}>
                <button onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                  className="w-full flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 transition-all text-left shadow-sm">
                  <span className="font-semibold text-slate-900 pr-4">{faq.question}</span>
                  <ChevronDown size={18} className={`text-slate-400 transition-transform flex-shrink-0 ${openFaq === faq.id ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === faq.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-5 py-4 text-slate-600 bg-white border border-t-0 border-slate-200 rounded-b-2xl -mt-1 text-sm leading-relaxed">
                    {faq.answer}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────── */}
      <section className="py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-medium mb-6">
              <Sparkles size={13} /> Join 50,000+ clinicians
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6">
              Reclaim your time.<br />Improve patient care.
            </h2>
            <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto">
              Join thousands of healthcare professionals who have transformed their documentation workflow with AI.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-2xl shadow-emerald-500/30 hover:from-emerald-600 hover:to-teal-600 transition-all w-full sm:w-auto text-lg">
                  Start Your Free Trial <ArrowRight size={20} />
                </motion.button>
              </Link>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-2 px-8 py-4 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 transition-all w-full sm:w-auto">
                <Play size={18} className="fill-white" /> Watch Demo
              </motion.button>
            </div>
            <p className="text-slate-500 text-sm mt-6">
              No credit card required • 14-day free trial • Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────── */}
      <footer className="bg-slate-900 border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <Sparkles size={17} className="text-white" />
                </div>
                <span className="text-white font-bold text-lg">Pronote</span>
              </Link>
              <p className="text-slate-500 text-sm leading-relaxed">AI-powered clinical documentation for modern healthcare.</p>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Security', 'Changelog'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
              { title: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'HIPAA', 'Cookie Policy'] },
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-white font-semibold text-sm mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map(l => (
                    <li key={l}><a href="#" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm">© {new Date().getFullYear()} Pronote. All rights reserved.</p>
            <p className="text-slate-600 text-sm">Made with ❤️ for healthcare professionals</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

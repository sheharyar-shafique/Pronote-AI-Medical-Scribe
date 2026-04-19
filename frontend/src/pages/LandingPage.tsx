import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Play, Star, Clock, Shield, Zap, ChevronDown, Check, Mic, FileText,
  Users, ArrowRight, Sparkles, Brain, Lock, RefreshCw, Menu, X
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { faqs, pricingPlans } from '../data';
import { AnimatePresence } from 'framer-motion';

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [demoStep, setDemoStep] = useState(0);

  // Auto-advance demo steps
  useEffect(() => {
    if (!showDemo) { setDemoStep(0); return; }
    if (demoStep >= 4) return;
    const timings = [2000, 3000, 2500, 0];
    const t = setTimeout(() => setDemoStep(s => s + 1), timings[demoStep]);
    return () => clearTimeout(t);
  }, [showDemo, demoStep]);

  // Lock body scroll when demo is open
  useEffect(() => {
    if (showDemo) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [showDemo]);

  const navLinks = ['Features', 'How It Works', 'Pricing', 'Security', 'About'];

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <motion.div whileHover={{ scale: 1.08, rotate: 5 }} transition={{ type: 'spring', stiffness: 400 }}
              className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Sparkles size={17} className="text-white" />
            </motion.div>
            <span className="text-lg font-bold text-white tracking-tight">Pronote</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/\s+/g, '-')}`}
                className="relative px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors duration-200 group rounded-lg hover:bg-white/5">
                {l}
                <span className="absolute bottom-1 left-4 right-4 h-px bg-gradient-to-r from-emerald-400 to-teal-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left rounded-full" />
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login">
              <motion.span whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="inline-block text-sm font-medium text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5">
                Sign In
              </motion.span>
            </Link>
            <Link to="/signup">
              <motion.span whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                className="relative inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:from-emerald-400 hover:to-teal-400 transition-all duration-200">
                <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
                Start Free Trial
                <ArrowRight size={14} />
              </motion.span>
            </Link>
          </div>

          {/* Mobile menu button */}
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => setMobileMenu(!mobileMenu)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </motion.button>
        </div>

        {/* Mobile Menu */}
        {mobileMenu && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-slate-900/95 backdrop-blur-xl border-t border-white/[0.07] px-4 py-5 space-y-1">
            {navLinks.map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/\s+/g, '-')}`} onClick={() => setMobileMenu(false)}
                className="flex items-center gap-2 text-slate-300 hover:text-white font-medium py-3 px-3 rounded-xl hover:bg-white/5 transition-all">
                {l}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-4 border-t border-white/10 mt-2">
              <Link to="/login" onClick={() => setMobileMenu(false)}
                className="text-center py-3 text-slate-300 hover:text-white font-medium rounded-xl border border-white/10 hover:bg-white/5 transition-all">
                Sign In
              </Link>
              <Link to="/signup" onClick={() => setMobileMenu(false)}
                className="text-center py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30">
                Start Free Trial
              </Link>
            </div>
          </motion.div>
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
                  onClick={() => setShowDemo(true)}
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
      <section className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 py-14 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
            {[
              { value: '50,000+', label: 'Active clinicians',  gradient: 'from-emerald-400 to-teal-400' },
              { value: '2M+',     label: 'Notes generated',    gradient: 'from-blue-400 to-indigo-400' },
              { value: '10,000+', label: 'Hours saved daily',  gradient: 'from-violet-400 to-purple-400' },
              { value: '98.5%',   label: 'Accuracy rate',      gradient: 'from-amber-400 to-orange-400' },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="text-center px-6 py-4">
                <p className={`text-4xl sm:text-5xl font-black bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent mb-2`}>
                  {stat.value}
                </p>
                <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────── */}
      <section id="features" className="relative py-28 bg-gradient-to-b from-slate-900 to-slate-800 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-10 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-20">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-5">
              <Sparkles size={13} /> Features
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-5">
              Built for clinicians,{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">by clinicians.</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Every feature designed to save you time and improve documentation quality.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <Clock size={22} />, color: 'from-emerald-400 to-teal-500', hoverBorder: 'hover:border-emerald-500/40', hoverBg: 'hover:bg-emerald-500/5', hoverGlow: 'hover:shadow-emerald-500/20',
                title: 'Save 2+ hours/day', desc: 'Streamline your notes and reclaim time for what truly matters—your patients and your life.' },
              { icon: <Shield size={22} />, color: 'from-blue-400 to-indigo-500', hoverBorder: 'hover:border-blue-500/40', hoverBg: 'hover:bg-blue-500/5', hoverGlow: 'hover:shadow-blue-500/20',
                title: 'HIPAA compliant & secure', desc: "Your patients' data is encrypted and secure with industry-leading security protocols." },
              { icon: <Zap size={22} />, color: 'from-violet-400 to-purple-500', hoverBorder: 'hover:border-violet-500/40', hoverBg: 'hover:bg-violet-500/5', hoverGlow: 'hover:shadow-violet-500/20',
                title: 'Instant accuracy', desc: 'AI-powered medical speech recognition delivers accurate clinical documentation instantly.' },
              { icon: <Brain size={22} />, color: 'from-rose-400 to-pink-500', hoverBorder: 'hover:border-rose-500/40', hoverBg: 'hover:bg-rose-500/5', hoverGlow: 'hover:shadow-rose-500/20',
                title: 'AI-powered summaries', desc: 'GPT-4 generates structured SOAP notes, HPI, assessment and plan automatically.' },
              { icon: <RefreshCw size={22} />, color: 'from-amber-400 to-orange-500', hoverBorder: 'hover:border-amber-500/40', hoverBg: 'hover:bg-amber-500/5', hoverGlow: 'hover:shadow-amber-500/20',
                title: 'Real-time transcription', desc: 'See your conversation transcribed live as you speak with your patient.' },
              { icon: <Lock size={22} />, color: 'from-cyan-400 to-sky-500', hoverBorder: 'hover:border-cyan-500/40', hoverBg: 'hover:bg-cyan-500/5', hoverGlow: 'hover:shadow-cyan-500/20',
                title: 'Role-based access', desc: 'Secure multi-user support with admin controls and audit logging built in.' },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div className={`group relative bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-2xl p-7 h-full
                  hover:shadow-2xl ${f.hoverGlow} ${f.hoverBorder} ${f.hoverBg}
                  transition-all duration-300 hover:-translate-y-2 cursor-default`}>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-5 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                  <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-10 rounded-2xl blur-2xl transition-opacity duration-300`} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────── */}
      <section id="how-it-works" className="relative py-28 bg-gradient-to-b from-slate-800 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-20">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-5">
              How It Works
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
              Super simple.
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              From patient visit to finalized note — in under 60 seconds.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* ── Left: Visual diagram ── */}
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="relative">
              <div className="relative bg-white/[0.03] border border-white/10 rounded-3xl p-8 overflow-hidden"
                style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)', backgroundSize: '30px 30px' }}>

                {/* Step 01 — Start visit */}
                <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                  className="mb-2">
                  <p className="text-slate-500 text-xs font-mono mb-2"><span className="text-emerald-400 font-bold">01</span> Start visit</p>
                  <div className="bg-white/[0.06] border border-white/10 rounded-xl p-4 inline-block">
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-900 font-bold text-sm rounded-lg shadow-lg">
                      <Mic size={14} className="text-emerald-600" /> Capture conversation
                    </motion.button>
                  </div>
                </motion.div>

                {/* Dotted connector */}
                <div className="ml-6 my-1 flex flex-col items-start gap-[3px]">
                  {[...Array(5)].map((_, i) => <div key={i} className="w-px h-2 bg-white/20 rounded" />)}
                </div>

                {/* Step 02 — Capturing */}
                <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.25 }}
                  className="ml-8 mb-2">
                  <p className="text-slate-500 text-xs font-mono mb-2"><span className="text-blue-400 font-bold">02</span> Capturing</p>
                  <div className="bg-white/[0.06] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-[2px]">
                      {[...Array(28)].map((_, i) => (
                        <motion.div key={i}
                          animate={{ height: [6, Math.random() * 24 + 6, 6] }}
                          transition={{ repeat: Infinity, duration: 0.6 + Math.random() * 0.4, delay: i * 0.05 }}
                          className="w-[3px] bg-gradient-to-t from-emerald-500 to-teal-400 rounded-full"
                          style={{ height: 6 }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Dotted connector */}
                <div className="ml-14 my-1 flex flex-col items-start gap-[3px]">
                  {[...Array(5)].map((_, i) => <div key={i} className="w-px h-2 bg-white/20 rounded" />)}
                </div>

                {/* Step 03 — Clinical note */}
                <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }}
                  className="ml-16">
                  <p className="text-slate-500 text-xs font-mono mb-2"><span className="text-violet-400 font-bold">03</span> Clinical note</p>
                  <div className="bg-white/[0.06] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-semibold text-sm">Personalized</span>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg">
                        Copy
                      </motion.button>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 bg-white/10 rounded-full w-full" />
                      <div className="h-2 bg-white/10 rounded-full w-4/5" />
                      <div className="h-2 bg-emerald-500/20 rounded-full w-3/5" />
                    </div>
                  </div>
                </motion.div>

              </div>
            </motion.div>

            {/* ── Right: Step descriptions ── */}
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="space-y-0 pt-4">
              {[
                {
                  num: '01', color: 'text-emerald-400', label: 'Capture',
                  desc: 'Click "Capture conversation" when your visit begins. Pronote listens for up to 1.5 hours, virtual or in-office visits.'
                },
                {
                  num: '02', color: 'text-blue-400', label: 'Review and Edit',
                  desc: 'Click "End conversation" and view your personalized note in just a few seconds. With every visit, Pronote learns your style.'
                },
                {
                  num: '03', color: 'text-violet-400', label: 'Send',
                  desc: 'Easily send auto-generated patient instructions, and copy completed notes into any EHR system with one click.'
                },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                  className="group py-8 border-b border-white/[0.08] last:border-0">
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className={`font-mono text-sm font-bold ${s.color}`}>{s.num}</span>
                    <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors duration-200">{s.label}</h3>
                  </div>
                  <p className="text-slate-400 leading-relaxed pl-9">{s.desc}</p>
                </motion.div>
              ))}

              <div className="pt-8">
                <Link to="/signup">
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-7 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 transition-all text-base">
                    Get Started Free <ArrowRight size={18} />
                  </motion.button>
                </Link>
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
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center h-full hover:bg-white/[0.08] transition-all hover:-translate-y-1">
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
      <section id="pricing" className="relative py-28 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-5">
              Pricing
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
              Simple,{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">transparent pricing</span>
            </h2>
            <p className="text-slate-400 text-lg">Try any plan free for 7 days. No credit card required.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-center">
            {pricingPlans.map((plan, index) => (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                <div className={`relative rounded-2xl p-7 h-full flex flex-col transition-all duration-300 ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-emerald-500/20 to-teal-500/10 border-2 border-emerald-500/50 shadow-2xl shadow-emerald-500/20 scale-105'
                    : 'bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.07] hover:-translate-y-1'
                }`}>
                  {plan.highlighted && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-1.5 rounded-full text-xs font-black shadow-lg shadow-emerald-500/40 tracking-wide">
                      MOST POPULAR
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-white mb-3">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-1">
                      {plan.price ? (
                        <>
                          <span className="text-5xl font-black text-white">${plan.price}</span>
                          <span className="text-slate-400 text-sm">/{plan.period}</span>
                        </>
                      ) : (
                        <span className="text-5xl font-black text-white">Custom</span>
                      )}
                    </div>
                    {plan.pricePerMonth && plan.period === 'year' && (
                      <p className="text-emerald-400 text-sm font-semibold">${plan.pricePerMonth.toFixed(2)}/mo</p>
                    )}
                    {plan.originalPrice && (
                      <p className="text-slate-500 text-sm line-through">${plan.originalPrice}/month</p>
                    )}
                    <p className="text-slate-400 text-sm mt-2">{plan.description}</p>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          plan.highlighted ? 'bg-emerald-500/30' : 'bg-white/10'
                        }`}>
                          <Check size={11} className="text-emerald-400" />
                        </div>
                        <span className="text-slate-300 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup">
                    <button className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm transition-all ${
                      plan.highlighted
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/30'
                        : 'border border-white/20 text-white hover:bg-white/10 hover:border-white/30'
                    }`}>
                      {plan.cta}
                    </button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-slate-500 text-sm mt-10">
            All plans include a 7-day free trial • Cancel anytime • No hidden fees
          </p>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────── */}
      <section className="relative py-28 bg-gradient-to-b from-slate-900 to-slate-800 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-14">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-5">
              FAQ
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
              Frequently asked<br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">questions</span>
            </h2>
            <p className="text-slate-400">Everything you need to know about Pronote.</p>
          </motion.div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div key={faq.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <button onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                  className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all text-left ${
                    openFaq === faq.id
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.07] hover:border-white/20'
                  }`}>
                  <span className={`font-semibold pr-4 ${openFaq === faq.id ? 'text-emerald-400' : 'text-white'}`}>
                    {faq.question}
                  </span>
                  <ChevronDown size={18} className={`transition-transform flex-shrink-0 ${
                    openFaq === faq.id ? 'rotate-180 text-emerald-400' : 'text-slate-400'
                  }`} />
                </button>
                {openFaq === faq.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-5 py-4 text-slate-400 bg-emerald-500/5 border border-t-0 border-emerald-500/20 rounded-b-2xl -mt-1 text-sm leading-relaxed">
                    {faq.answer}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ──────────────────────────── */}
      <section id="security" className="relative py-28 bg-gradient-to-b from-slate-800 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-20">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-5">
              <Lock size={13} /> Security
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-5">
              Enterprise-grade{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">security.</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Every layer of Pronote is built with HIPAA compliance and patient data protection as the foundation — not an afterthought.
            </p>
          </motion.div>

          {/* Hero trust bar */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {[
              { icon: <Shield size={22} />, label: 'HIPAA Compliant', gradient: 'from-emerald-400 to-teal-500' },
              { icon: <Lock size={22} />, label: 'AES-256-GCM Encrypted', gradient: 'from-blue-400 to-indigo-500' },
              { icon: <RefreshCw size={22} />, label: '24h JWT Sessions', gradient: 'from-violet-400 to-purple-500' },
              { icon: <Zap size={22} />, label: 'Rate Limited APIs', gradient: 'from-amber-400 to-orange-500' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="flex flex-col items-center gap-3 bg-white/[0.04] border border-white/10 rounded-2xl p-5 text-center hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300 hover:-translate-y-1">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-white shadow-lg`}>
                  {item.icon}
                </div>
                <span className="text-white/80 text-sm font-semibold">{item.label}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Main security cards grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {[
              {
                icon: <Lock size={22} />,
                gradient: 'from-emerald-400 to-teal-500',
                hoverBorder: 'hover:border-emerald-500/40',
                hoverGlow: 'hover:shadow-emerald-500/20',
                title: 'AES-256-GCM PHI Encryption',
                desc: 'All Protected Health Information is encrypted at rest using AES-256-GCM — the gold standard for medical data. Each record gets a unique IV and authentication tag to detect tampering.',
                badge: 'At Rest',
              },
              {
                icon: <Shield size={22} />,
                gradient: 'from-blue-400 to-indigo-500',
                hoverBorder: 'hover:border-blue-500/40',
                hoverGlow: 'hover:shadow-blue-500/20',
                title: 'HIPAA-Compliant Audit Logs',
                desc: 'Every data access, login attempt, note creation, and admin action is recorded in immutable audit logs with timestamps, IP addresses, and user agents for full regulatory traceability.',
                badge: 'Compliance',
              },
              {
                icon: <RefreshCw size={22} />,
                gradient: 'from-violet-400 to-purple-500',
                hoverBorder: 'hover:border-violet-500/40',
                hoverGlow: 'hover:shadow-violet-500/20',
                title: 'JWT Session Management',
                desc: 'Authentication tokens expire in 24 hours per HIPAA session management requirements. Tokens are signed with a 256-bit secret and verified on every protected API request.',
                badge: 'Auth',
              },
              {
                icon: <Zap size={22} />,
                gradient: 'from-amber-400 to-orange-500',
                hoverBorder: 'hover:border-amber-500/40',
                hoverGlow: 'hover:shadow-amber-500/20',
                title: 'Rate Limiting & Brute Force Protection',
                desc: 'API endpoints are rate-limited to 100 requests/15 min per IP. Login attempts are tracked — after 5 failures, accounts are automatically locked for 15 minutes to prevent brute force attacks.',
                badge: 'DDoS Shield',
              },
              {
                icon: <Users size={22} />,
                gradient: 'from-rose-400 to-pink-500',
                hoverBorder: 'hover:border-rose-500/40',
                hoverGlow: 'hover:shadow-rose-500/20',
                title: 'Role-Based Access Control',
                desc: 'Strict RBAC separates clinician and admin privileges. Users can only access their own patient notes. Admins have dedicated routes with additional authentication guards.',
                badge: 'RBAC',
              },
              {
                icon: <Brain size={22} />,
                gradient: 'from-cyan-400 to-sky-500',
                hoverBorder: 'hover:border-cyan-500/40',
                hoverGlow: 'hover:shadow-cyan-500/20',
                title: 'bcrypt Password Hashing',
                desc: 'Passwords are never stored in plain text. bcrypt with cost factor 12 is used to hash all passwords — making offline dictionary attacks computationally infeasible.',
                badge: 'Credentials',
              },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div className={`group relative bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-7 h-full
                  hover:shadow-2xl ${item.hoverGlow} ${item.hoverBorder}
                  transition-all duration-300 hover:-translate-y-2 cursor-default`}>
                  <div className="flex items-start justify-between mb-5">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                      {item.icon}
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-gradient-to-r ${item.gradient} bg-opacity-10 text-white/60 border border-white/10`}>
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-[0.06] rounded-2xl blur-2xl transition-opacity duration-300`} />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Bottom: Transport + Infrastructure row */}
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid md:grid-cols-2 gap-6 mb-16">

            {/* HTTPS + Helmet */}
            <div className="group bg-white/[0.03] border border-white/10 rounded-2xl p-7 hover:border-emerald-500/30 hover:bg-white/[0.06] transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-lg">
                  <Shield size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">TLS Encryption in Transit</h3>
                  <span className="text-xs text-emerald-400 font-medium">Transport Security</span>
                </div>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                All data between client and server is encrypted via HTTPS/TLS. HTTP security headers are enforced using Helmet.js — preventing XSS, clickjacking, MIME sniffing, and other common web attacks.
              </p>
              <div className="flex flex-wrap gap-2">
                {['HTTPS / TLS', 'Helmet.js Headers', 'CORS Policy', 'XSS Protection', 'HSTS Enabled'].map(t => (
                  <span key={t} className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-medium">{t}</span>
                ))}
              </div>
            </div>

            {/* Infrastructure */}
            <div className="group bg-white/[0.03] border border-white/10 rounded-2xl p-7 hover:border-blue-500/30 hover:bg-white/[0.06] transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white shadow-lg">
                  <Zap size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Secure Infrastructure</h3>
                  <span className="text-xs text-blue-400 font-medium">Cloud Architecture</span>
                </div>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Backend runs on Render with environment-variable-only secrets — no keys in source code. Supabase provides a SOC 2 Type II certified database with row-level security policies.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Render Cloud', 'Supabase RLS', 'Env-Only Secrets', 'SOC 2 Type II', 'No Plaintext Keys'].map(t => (
                  <span key={t} className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full font-medium">{t}</span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* HIPAA compliance banner */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/10 p-8 text-center">
            <div className="absolute top-0 left-1/4 w-64 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-64 h-32 bg-teal-500/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-bold mb-4">
                <Shield size={15} /> HIPAA Compliant Platform
              </div>
              <h3 className="text-2xl font-black text-white mb-3">
                Your patients' privacy is our highest priority
              </h3>
              <p className="text-slate-400 max-w-2xl mx-auto text-sm leading-relaxed mb-6">
                Pronote is built from the ground up to meet and exceed HIPAA requirements. Every technical safeguard — from AES-256 encryption to 24-hour session expiry — is intentionally designed for clinical environments.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {[
                  '✓ Encryption at Rest',
                  '✓ Encryption in Transit',
                  '✓ Access Controls',
                  '✓ Audit Logging',
                  '✓ Session Timeout',
                  '✓ Breach Notification Ready',
                ].map(item => (
                  <span key={item} className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full font-medium">{item}</span>
                ))}
              </div>
            </div>
          </motion.div>

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
                onClick={() => setShowDemo(true)}
                className="flex items-center justify-center gap-2 px-8 py-4 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 transition-all w-full sm:w-auto">
                <Play size={18} className="fill-white" /> Watch Demo
              </motion.button>
            </div>
            <p className="text-slate-500 text-sm mt-6">
              No credit card required • 7-day free trial • Cancel anytime
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

      {/* ── Demo Modal ─────────────────────────── */}
      <AnimatePresence>
        {showDemo && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={() => setShowDemo(false)}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 to-slate-800 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">

              {/* Close */}
              <button onClick={() => setShowDemo(false)}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <X size={16} />
              </button>

              {/* Header */}
              <div className="px-8 pt-8 pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                    <Sparkles size={14} className="text-white" />
                  </div>
                  <span className="text-white font-bold">Pronote Demo</span>
                </div>
                <p className="text-slate-400 text-sm">See how a clinical note is generated in under 60 seconds.</p>
              </div>

              {/* Progress */}
              <div className="px-8 pb-4">
                <div className="flex gap-2">
                  {['Start Visit', 'Recording', 'Processing', 'Note Ready'].map((label, i) => (
                    <div key={i} className="flex-1">
                      <div className={`h-1 rounded-full transition-all duration-500 ${
                        i < demoStep ? 'bg-emerald-400' : i === demoStep ? 'bg-emerald-400/50' : 'bg-white/10'
                      }`} />
                      <p className={`text-[10px] mt-1 font-medium ${
                        i <= demoStep ? 'text-emerald-400' : 'text-slate-500'
                      }`}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Demo content area */}
              <div className="px-8 pb-8 min-h-[320px]">
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 h-full">

                  {/* Step 0: Start Visit */}
                  {demoStep === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Ready</span>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-2">Patient Name</p>
                        <motion.div initial={{ width: 0 }} animate={{ width: '60%' }} transition={{ duration: 1.2, delay: 0.3 }}
                          className="h-9 bg-white/[0.06] rounded-lg border border-white/10 flex items-center px-3 overflow-hidden">
                          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                            className="text-white text-sm font-medium">Sarah Johnson</motion.span>
                        </motion.div>
                      </div>
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
                        <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg shadow-lg shadow-emerald-500/30">
                          <Mic size={14} className="text-white" />
                          <span className="text-white text-sm font-bold">Start Capture</span>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}

                  {/* Step 1: Recording */}
                  {demoStep === 1 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Recording</span>
                        </div>
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="text-slate-500 text-xs font-mono">00:42</motion.span>
                      </div>

                      {/* Waveform */}
                      <div className="flex items-center justify-center gap-[2px] py-4">
                        {[...Array(40)].map((_, i) => (
                          <motion.div key={i}
                            animate={{ height: [4, Math.random() * 32 + 4, 4] }}
                            transition={{ repeat: Infinity, duration: 0.5 + Math.random() * 0.5, delay: i * 0.03 }}
                            className="w-[3px] bg-gradient-to-t from-emerald-500 to-teal-400 rounded-full"
                            style={{ height: 4 }} />
                        ))}
                      </div>

                      {/* Live transcript */}
                      <div className="space-y-2">
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Live Transcript</p>
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                          className="text-slate-300 text-sm leading-relaxed">
                          <span className="text-emerald-400 font-semibold">Dr:</span> Good morning Sarah. What brings you in today?
                        </motion.p>
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}
                          className="text-slate-300 text-sm leading-relaxed">
                          <span className="text-blue-400 font-semibold">Pt:</span> I've been having headaches for about two weeks...
                        </motion.p>
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.0 }}
                          className="text-slate-300 text-sm leading-relaxed">
                          <span className="text-emerald-400 font-semibold">Dr:</span> Can you describe the location and severity?
                        </motion.p>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Processing */}
                  {demoStep === 2 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-8 space-y-6">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                        className="w-16 h-16 rounded-full border-2 border-white/10 border-t-emerald-400" />
                      <div className="text-center">
                        <p className="text-white font-bold mb-1">AI Processing</p>
                        <p className="text-slate-400 text-sm">Analyzing conversation &amp; generating clinical note...</p>
                      </div>
                      <div className="w-full max-w-xs">
                        <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2.2, ease: 'easeInOut' }}
                          className="h-1.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full" />
                      </div>
                      <div className="flex gap-6 text-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                          <p className="text-emerald-400 text-xs font-bold">✓ Transcribed</p>
                        </motion.div>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
                          <p className="text-emerald-400 text-xs font-bold">✓ Classified</p>
                        </motion.div>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9 }}>
                          <p className="text-emerald-400 text-xs font-bold">✓ Structured</p>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Note Ready */}
                  {demoStep === 3 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Check size={14} className="text-emerald-400" />
                          <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Note Ready — 52 seconds</span>
                        </div>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg">
                          Copy
                        </motion.button>
                      </div>
                      <div className="space-y-3">
                        {[
                          { label: 'Subjective', content: 'Patient reports persistent bilateral frontal headaches for 2 weeks, rated 6/10, worse in the morning...' },
                          { label: 'Objective', content: 'BP 128/82, HR 76, Temp 98.6°F. Neurological exam normal. No papilledema...' },
                          { label: 'Assessment', content: 'Tension-type headache, chronic. Rule out secondary causes given 2-week duration...' },
                          { label: 'Plan', content: 'Order CBC, CMP, TSH. Trial of ibuprofen 400mg TID with meals. Follow up 2 weeks...' },
                        ].map((s, i) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.2 }}>
                            <p className="text-emerald-400 text-xs font-bold mb-0.5">{s.label}</p>
                            <p className="text-slate-300 text-sm leading-relaxed">{s.content}</p>
                          </motion.div>
                        ))}
                      </div>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="pt-4">
                        <Link to="/signup" onClick={() => setShowDemo(false)}>
                          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 transition-all">
                            Try It Free <ArrowRight size={16} />
                          </motion.button>
                        </Link>
                      </motion.div>
                    </motion.div>
                  )}

                  {/* Step 4+: Replay */}
                  {demoStep >= 4 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 space-y-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/30">
                        <Check size={28} className="text-white" />
                      </div>
                      <p className="text-white font-bold text-lg">That&apos;s it!</p>
                      <p className="text-slate-400 text-sm text-center max-w-xs">From conversation to clinical note in under 60 seconds. No typing required.</p>
                      <div className="flex gap-3 pt-2">
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          onClick={() => setDemoStep(0)}
                          className="px-5 py-2.5 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 transition-all text-sm">
                          <RefreshCw size={14} className="inline mr-1.5" />Replay
                        </motion.button>
                        <Link to="/signup" onClick={() => setShowDemo(false)}>
                          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 text-sm">
                            Start Free Trial
                          </motion.button>
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

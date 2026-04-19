import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Check, Sparkles, ArrowRight, Star, Shield, Zap } from 'lucide-react';
import { useAuthStore } from '../store';
import { specialties } from '../data';
import toast from 'react-hot-toast';

// ── Floating particle ──────────────────────────────────────────
function Particle({ delay, x, y, size }: { delay: number; x: string; y: string; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: x, top: y, width: size, height: size,
        background: 'radial-gradient(circle, rgba(52,211,153,0.4) 0%, transparent 70%)',
      }}
      animate={{ y: [0, -40, 0], opacity: [0.1, 0.5, 0.1], scale: [1, 1.4, 1] }}
      transition={{ duration: 5 + Math.random() * 4, delay, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

const particles = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  delay: i * 0.35,
  x: `${Math.random() * 100}%`,
  y: `${Math.random() * 100}%`,
  size: 5 + Math.random() * 14,
}));

// ── Helpers ────────────────────────────────────────────────────
const inputBase =
  'w-full px-4 py-3.5 rounded-xl border bg-white/5 text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40 transition-all duration-300 backdrop-blur-sm text-sm';

const strengthColor = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-400'];
const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];

const benefits = [
  '14-day free trial — no credit card',
  'All specialty templates included',
  'HIPAA-compliant & fully encrypted',
  'AI notes in under 60 seconds',
  'Cancel anytime, hassle-free',
];

// ── Component ──────────────────────────────────────────────────
export default function SignupPage() {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    specialty: 'General Medicine',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { signup, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => { setMounted(true); }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.name) e.name = 'Name is required';
    if (!formData.email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) e.email = 'Invalid email format';
    if (!formData.password) e.password = 'Password is required';
    else if (formData.password.length < 8) e.password = 'Minimum 8 characters';
    if (formData.password !== formData.confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!agreedToTerms) e.terms = 'You must agree to the terms';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    try {
      await signup(formData.email, formData.password, formData.name, formData.specialty);
      toast.success('Account created! Welcome to Pronote 🎉');
      navigate('/dashboard');
    } catch {
      toast.error('Failed to create account');
    }
  };

  const handleChange = (field: string, value: string) =>
    setFormData(p => ({ ...p, [field]: value }));

  const strength = () => {
    const p = formData.password;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  return (
    <div className="min-h-screen flex bg-[#050d12] overflow-hidden">

      {/* ── Left – Form ──────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">

        {/* Ambient glow */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md py-8 relative z-10"
        >
          {/* Logo */}
          <Link to="/" className="inline-flex items-center gap-3 mb-8 group">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 8 }}
              className="relative"
            >
              <motion.div
                className="absolute inset-0 rounded-2xl bg-emerald-500/40"
                animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />
              <div className="relative w-11 h-11 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/30">
                <Sparkles size={20} className="text-white" />
              </div>
            </motion.div>
            <div>
              <span className="text-xl font-black text-white tracking-tight">Pronote</span>
              <span className="block text-emerald-400 text-xs font-medium -mt-0.5">AI Medical Scribe</span>
            </div>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="mb-7"
          >
            <h1 className="text-4xl font-black text-white mb-2">Create account</h1>
            <p className="text-white/40 text-sm">Start your 14-day free trial. No credit card required.</p>
          </motion.div>

          {/* Form card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-7 backdrop-blur-xl shadow-2xl"
          >
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Full Name */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
                <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Full Name</label>
                <input type="text" placeholder="Dr. John Doe" value={formData.name}
                  onChange={e => handleChange('name', e.target.value)}
                  className={`${inputBase} ${errors.name ? 'border-red-400/60 ring-2 ring-red-400/20' : 'border-white/[0.08]'}`} />
                <AnimatePresence>
                  {errors.name && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-1 text-xs text-red-400">{errors.name}</motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Email */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Email Address</label>
                <input type="email" placeholder="you@clinic.com" value={formData.email}
                  onChange={e => handleChange('email', e.target.value)}
                  className={`${inputBase} ${errors.email ? 'border-red-400/60 ring-2 ring-red-400/20' : 'border-white/[0.08]'}`} />
                <AnimatePresence>
                  {errors.email && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-1 text-xs text-red-400">{errors.email}</motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Specialty */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}>
                <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Specialty</label>
                <select value={formData.specialty} onChange={e => handleChange('specialty', e.target.value)}
                  className={`${inputBase} border-white/[0.08] cursor-pointer`}
                  style={{ colorScheme: 'dark' }}>
                  {specialties.map(s => <option key={s} value={s} className="bg-[#0a1f18]">{s}</option>)}
                </select>
              </motion.div>

              {/* Password */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.50 }}>
                <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters"
                    value={formData.password} onChange={e => handleChange('password', e.target.value)}
                    className={`${inputBase} pr-12 ${errors.password ? 'border-red-400/60 ring-2 ring-red-400/20' : 'border-white/[0.08]'}`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map(l => (
                        <motion.div key={l}
                          className={`h-1 flex-1 rounded-full transition-all duration-500 ${strength() >= l ? strengthColor[strength()] : 'bg-white/10'}`}
                          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: l * 0.05 }}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-white/30">{strengthLabel[strength()]} password</p>
                  </div>
                )}
                <AnimatePresence>
                  {errors.password && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-1 text-xs text-red-400">{errors.password}</motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Confirm Password */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.56 }}>
                <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Confirm Password</label>
                <input type="password" placeholder="••••••••" value={formData.confirmPassword}
                  onChange={e => handleChange('confirmPassword', e.target.value)}
                  className={`${inputBase} ${errors.confirmPassword ? 'border-red-400/60 ring-2 ring-red-400/20' : 'border-white/[0.08]'}`} />
                <AnimatePresence>
                  {errors.confirmPassword && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-1 text-xs text-red-400">{errors.confirmPassword}</motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Terms */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.62 }}>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div
                    onClick={() => setAgreedToTerms(!agreedToTerms)}
                    className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${agreedToTerms ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 bg-white/5'}`}
                  >
                    {agreedToTerms && <Check size={12} className="text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-xs text-white/40 leading-relaxed">
                    I agree to the{' '}
                    <a href="#" className="text-emerald-400 hover:text-emerald-300 font-medium">Terms of Service</a>{' '}
                    and{' '}
                    <a href="#" className="text-emerald-400 hover:text-emerald-300 font-medium">Privacy Policy</a>
                  </span>
                </label>
                <AnimatePresence>
                  {errors.terms && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-1 text-xs text-red-400">{errors.terms}</motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Submit */}
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.68 }}>
                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={{ scale: 1.02, boxShadow: '0 0 40px rgba(16,185,129,0.4)' }}
                  whileTap={{ scale: 0.98 }}
                  className="relative w-full py-4 px-6 rounded-xl font-bold text-white overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                  style={{ background: 'linear-gradient(135deg, #10b981, #0d9488)' }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
                  />
                  <span className="relative flex items-center justify-center gap-2">
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Create Account <ArrowRight size={18} /></>
                    )}
                  </span>
                </motion.button>
              </motion.div>
            </form>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }}
            className="text-center text-white/40 mt-5 text-sm"
          >
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">Sign in</Link>
          </motion.p>
        </motion.div>
      </div>

      {/* ── Right – Visual Panel ─────────────────────── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center">

        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-bl from-[#0a1f18] via-[#050d12] to-[#030a0d]" />

        {/* Animated orbs */}
        <motion.div
          className="absolute w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)', top: '-20%', right: '-20%' }}
          animate={{ scale: [1, 1.3, 1], rotate: [0, 60, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.10) 0%, transparent 70%)', bottom: '-15%', left: '-10%' }}
          animate={{ scale: [1.2, 1, 1.2], rotate: [0, -40, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(52,211,153,1) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Particles */}
        {mounted && particles.map(p => <Particle key={p.id} delay={p.delay} x={p.x} y={p.y} size={p.size} />)}

        {/* Content */}
        <div className="relative z-10 max-w-md w-full px-10">

          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-5xl font-black text-white mb-4 leading-tight">
              Start your<br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                free trial
              </span>
            </h2>
            <p className="text-white/40 leading-relaxed">
              Join 50,000+ clinicians transforming their documentation workflow with AI.
            </p>
          </motion.div>

          {/* Benefits */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-6 mb-6 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 mb-5">
              <Zap size={16} className="text-emerald-400" />
              <span className="text-white/60 text-sm font-semibold uppercase tracking-wider">What's included</span>
            </div>
            <div className="space-y-3">
              {benefits.map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                    <Check size={10} className="text-emerald-400" strokeWidth={3} />
                  </div>
                  <span className="text-white/55 text-sm">{b}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Testimonial */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-6 backdrop-blur-sm"
          >
            <div className="flex gap-0.5 mb-3">
              {[1,2,3,4,5].map(i => <Star key={i} size={13} className="fill-amber-400 text-amber-400" />)}
            </div>
            <p className="text-white/50 text-sm italic mb-4 leading-relaxed">
              "Pronote has completely transformed my practice. I save over 2 hours every day and can finally focus on my patients."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-black text-sm">S</span>
              </div>
              <div>
                <p className="text-white/80 font-semibold text-sm">Dr. Sarah Johnson</p>
                <p className="text-white/30 text-xs">Family Medicine</p>
              </div>
              <div className="ml-auto">
                <Shield size={16} className="text-emerald-500/50" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

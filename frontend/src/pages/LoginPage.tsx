import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Sparkles, Shield, Clock, Zap, ArrowRight, Activity } from 'lucide-react';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';

// Floating particle component
function Particle({ delay, x, y, size }: { delay: number; x: string; y: string; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-emerald-400/20 pointer-events-none"
      style={{ left: x, top: y, width: size, height: size }}
      animate={{
        y: [0, -30, 0],
        opacity: [0.2, 0.6, 0.2],
        scale: [1, 1.3, 1],
      }}
      transition={{
        duration: 4 + Math.random() * 3,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

const particles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  delay: i * 0.3,
  x: `${Math.random() * 100}%`,
  y: `${Math.random() * 100}%`,
  size: 4 + Math.random() * 12,
}));

const features = [
  { icon: <Zap size={16} />, text: 'Save 2+ hours per day' },
  { icon: <Shield size={16} />, text: 'HIPAA compliant & encrypted' },
  { icon: <Clock size={16} />, text: 'Notes in under 60 seconds' },
  { icon: <Activity size={16} />, text: '98.5% transcription accuracy' },
];

const inputBase =
  'w-full px-4 py-3.5 rounded-xl border bg-white/5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400/40 transition-all duration-300 backdrop-blur-sm';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [mounted, setMounted] = useState(false);

  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => { setMounted(true); }, []);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email format';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'At least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch {
      toast.error('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex bg-[#050d12] overflow-hidden">

      {/* ── Left – Animated Visual Panel ── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center">

        {/* Deep layered background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1f18] via-[#050d12] to-[#030a0d]" />

        {/* Animated gradient orbs */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)',
            top: '-10%', left: '-10%',
          }}
          animate={{ scale: [1, 1.2, 1], x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)',
            bottom: '-10%', right: '-10%',
          }}
          animate={{ scale: [1.2, 1, 1.2], x: [0, -30, 0], y: [0, -40, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(52,211,153,0.08) 0%, transparent 70%)',
            top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          }}
          animate={{ scale: [1, 1.5, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        />

        {/* Floating particles */}
        {mounted && particles.map(p => (
          <Particle key={p.id} delay={p.delay} x={p.x} y={p.y} size={p.size} />
        ))}

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(52,211,153,1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(52,211,153,1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-lg w-full px-10">

          {/* Logo pulse ring */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
            className="mb-10"
          >
            <div className="relative inline-flex">
              <motion.div
                className="absolute inset-0 rounded-3xl bg-emerald-500/30"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />
              <div className="relative w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                <Sparkles size={28} className="text-white" />
              </div>
            </div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="text-5xl font-black text-white mb-4 leading-tight"
          >
            Clinical AI<br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              Reimagined
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-white/40 text-lg mb-10 leading-relaxed"
          >
            AI listens to your patient conversations and generates structured clinical notes in seconds.
          </motion.p>

          {/* Feature pills */}
          <div className="space-y-3">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.12, duration: 0.5 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  {f.icon}
                </div>
                <span className="text-white/60 text-sm">{f.text}</span>
              </motion.div>
            ))}
          </div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="grid grid-cols-3 gap-3 mt-10"
          >
            {[
              { value: '50K+', label: 'Clinicians' },
              { value: '2M+', label: 'Notes Created' },
              { value: '98.5%', label: 'Accuracy' },
            ].map((s, i) => (
              <div key={i} className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 text-center backdrop-blur-sm">
                <p className="text-2xl font-black text-white">{s.value}</p>
                <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Right – Login Form ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">

        {/* Subtle right-panel glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {/* Logo (mobile) */}
          <Link to="/" className="inline-flex items-center gap-3 mb-10 lg:hidden group">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 10 }}
              className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30"
            >
              <Sparkles size={20} className="text-white" />
            </motion.div>
            <div>
              <span className="text-xl font-black text-white tracking-tight">Pronote</span>
              <span className="block text-emerald-400 text-xs font-medium -mt-0.5">AI Medical Scribe</span>
            </div>
          </Link>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-black text-white mb-2">Welcome back</h1>
            <p className="text-white/40">Sign in to continue your clinical workflow</p>
          </motion.div>

          {/* Form card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-8 backdrop-blur-xl shadow-2xl"
          >
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <label className="block text-sm font-semibold text-white/60 mb-2">Email address</label>
                <input
                  type="email"
                  placeholder="you@clinic.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`${inputBase} ${errors.email ? 'border-red-400/60 ring-2 ring-red-400/20' : 'border-white/[0.08]'}`}
                />
                <AnimatePresence>
                  {errors.email && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-1.5 text-sm text-red-400">{errors.email}</motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Password */}
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                <label className="block text-sm font-semibold text-white/60 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={`${inputBase} pr-12 ${errors.password ? 'border-red-400/60 ring-2 ring-red-400/20' : 'border-white/[0.08]'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <AnimatePresence>
                  {errors.password && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-1.5 text-sm text-red-400">{errors.password}</motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Remember + Forgot */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.46 }}
                className="flex items-center justify-between"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500" />
                  <span className="text-sm text-white/40">Remember me</span>
                </label>
                <Link to="/forgot-password" className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                  Forgot password?
                </Link>
              </motion.div>

              {/* Submit */}
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }}>
                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={{ scale: 1.02, boxShadow: '0 0 40px rgba(16,185,129,0.4)' }}
                  whileTap={{ scale: 0.98 }}
                  className="relative w-full py-4 px-6 rounded-xl font-bold text-white overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #10b981, #0d9488)' }}
                >
                  {/* Shimmer effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
                  />
                  <span className="relative flex items-center justify-center gap-2">
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Sign In <ArrowRight size={18} /></>
                    )}
                  </span>
                </motion.button>
              </motion.div>
            </form>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center text-white/40 mt-6 text-sm"
          >
            Don't have an account?{' '}
            <Link to="/signup" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
              Start free trial
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}

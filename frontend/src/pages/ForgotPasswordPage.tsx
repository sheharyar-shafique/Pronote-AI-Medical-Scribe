import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, ArrowLeft, Mail, KeyRound, Eye, EyeOff, CheckCircle, RefreshCw, UserX, AlertCircle } from 'lucide-react';
import { authApi } from '../services/api';
import toast from 'react-hot-toast';

type Step = 'email' | 'otp' | 'password' | 'done';

const inputBase =
  'w-full px-4 py-3.5 rounded-xl border bg-white/5 text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40 transition-all duration-300 backdrop-blur-sm text-sm';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // ── Step 1: Send OTP ─────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email);
      toast.success('OTP sent! Check your email.');
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── OTP input handler ─────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    // Auto-focus next
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`);
      prev?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      document.getElementById('otp-5')?.focus();
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const otpString = otp.join('');
    if (otpString.length < 6) {
      setError('Please enter all 6 digits.');
      return;
    }
    setIsLoading(true);
    try {
      await authApi.verifyOtp(email, otpString);
      toast.success('OTP verified!');
      setStep('password');
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 3: Reset Password ────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      await authApi.resetPassword(email, otp.join(''), newPassword);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = () => {
    let s = 0;
    if (newPassword.length >= 8) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  };
  const strengthColor = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-400'];
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  const stepIndex = { email: 0, otp: 1, password: 2, done: 3 }[step];

  return (
    <div className="min-h-screen bg-[#050d12] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background orbs */}
      <motion.div className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)', top: '-10%', left: '-10%' }}
        animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 8, repeat: Infinity }} />
      <motion.div className="absolute w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)', bottom: '-10%', right: '-10%' }}
        animate={{ scale: [1.2, 1, 1.2] }} transition={{ duration: 10, repeat: Infinity }} />
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(52,211,153,1) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <Link to="/" className="inline-flex items-center gap-3 mb-8 group">
          <motion.div whileHover={{ scale: 1.1, rotate: 8 }}
            className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/30">
            <Sparkles size={18} className="text-white" />
          </motion.div>
          <div>
            <span className="text-xl font-black text-white tracking-tight">Pronote</span>
            <span className="block text-emerald-400 text-xs font-medium -mt-0.5">AI Medical Scribe</span>
          </div>
        </Link>

        {/* Progress stepper */}
        {step !== 'done' && (
          <div className="flex items-center gap-2 mb-8">
            {['Email', 'Verify OTP', 'New Password'].map((label, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 ${i < stepIndex ? 'opacity-100' : i === stepIndex ? 'opacity-100' : 'opacity-30'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    i < stepIndex ? 'bg-emerald-500 text-white' : i === stepIndex ? 'bg-white/10 border-2 border-emerald-400 text-emerald-400' : 'bg-white/5 text-white/30'
                  }`}>
                    {i < stepIndex ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs font-semibold hidden sm:block ${i === stepIndex ? 'text-white' : 'text-white/30'}`}>{label}</span>
                </div>
                {i < 2 && <div className={`flex-1 h-px transition-all ${i < stepIndex ? 'bg-emerald-500' : 'bg-white/10'}`} />}
              </div>
            ))}
          </div>
        )}

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
          <AnimatePresence mode="wait">

            {/* ── Step 1: Email ── */}
            {step === 'email' && (
              <motion.div key="email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg">
                    <Mail size={22} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-white">Forgot password?</h1>
                    <p className="text-white/40 text-sm">Enter your account email</p>
                  </div>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Email Address</label>
                    <input type="email" placeholder="you@clinic.com" value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={`${inputBase} border-white/[0.08]`} autoFocus />
                  </div>

                  {error && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3 text-sm bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3.5">
                      {error.toLowerCase().includes('no account') || error.toLowerCase().includes('not found') || error.toLowerCase().includes('not exist') ? (
                        <UserX size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-red-300 font-semibold text-xs uppercase tracking-wide mb-0.5">
                          {error.toLowerCase().includes('no account') || error.toLowerCase().includes('not found') ? 'Account Not Found' : 'Error'}
                        </p>
                        <p className="text-red-400 text-sm leading-relaxed">{error}</p>
                      </div>
                    </motion.div>
                  )}

                  <motion.button type="submit" disabled={isLoading}
                    whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(16,185,129,0.3)' }}
                    whileTap={{ scale: 0.98 }}
                    className="relative w-full py-4 rounded-xl font-bold text-white overflow-hidden disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #10b981, #0d9488)' }}>
                    <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                      animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }} />
                    <span className="relative flex items-center justify-center gap-2">
                      {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Send OTP <ArrowRight size={16} /></>}
                    </span>
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* ── Step 2: OTP ── */}
            {step === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg">
                    <KeyRound size={22} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-white">Enter OTP</h1>
                    <p className="text-white/40 text-sm">Check your email</p>
                  </div>
                </div>
                <p className="text-white/40 text-sm mb-6">
                  We sent a 6-digit code to <span className="text-emerald-400 font-semibold">{email}</span>
                </p>

                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  {/* OTP boxes */}
                  <div className="flex gap-3 justify-center" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <motion.input
                        key={i}
                        id={`otp-${i}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        whileFocus={{ scale: 1.05 }}
                        className={`w-12 h-14 text-center text-2xl font-black rounded-xl border bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400/40 transition-all ${
                          digit ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-white/[0.08]'
                        }`}
                      />
                    ))}
                  </div>

                  {error && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-center">
                      {error}
                    </motion.p>
                  )}

                  <motion.button type="submit" disabled={isLoading || otp.join('').length < 6}
                    whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(16,185,129,0.3)' }}
                    whileTap={{ scale: 0.98 }}
                    className="relative w-full py-4 rounded-xl font-bold text-white overflow-hidden disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #10b981, #0d9488)' }}>
                    <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                      animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }} />
                    <span className="relative flex items-center justify-center gap-2">
                      {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Verify OTP <ArrowRight size={16} /></>}
                    </span>
                  </motion.button>

                  <div className="flex items-center justify-between text-sm">
                    <button type="button" onClick={() => { setStep('email'); setOtp(['','','','','','']); setError(''); }}
                      className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors">
                      <ArrowLeft size={14} /> Change email
                    </button>
                    <button type="button" onClick={handleSendOtp} disabled={isLoading}
                      className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors">
                      <RefreshCw size={14} /> Resend OTP
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* ── Step 3: New Password ── */}
            {step === 'password' && (
              <motion.div key="password" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg">
                    <KeyRound size={22} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-white">New Password</h1>
                    <p className="text-white/40 text-sm">Choose a strong password</p>
                  </div>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">New Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters"
                        value={newPassword} onChange={e => setNewPassword(e.target.value)}
                        className={`${inputBase} pr-12 border-white/[0.08]`} autoFocus />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {newPassword && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[1,2,3,4].map(l => (
                            <div key={l} className={`h-1 flex-1 rounded-full transition-all duration-500 ${passwordStrength() >= l ? strengthColor[passwordStrength()] : 'bg-white/10'}`} />
                          ))}
                        </div>
                        <p className="text-xs text-white/30">{strengthLabel[passwordStrength()]} password</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Confirm Password</label>
                    <input type="password" placeholder="••••••••"
                      value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      className={`${inputBase} border-white/[0.08] ${confirmPassword && confirmPassword !== newPassword ? 'border-red-400/60' : confirmPassword && confirmPassword === newPassword ? 'border-emerald-400/60' : ''}`} />
                  </div>

                  {error && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                      {error}
                    </motion.p>
                  )}

                  <motion.button type="submit" disabled={isLoading}
                    whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(16,185,129,0.3)' }}
                    whileTap={{ scale: 0.98 }}
                    className="relative w-full py-4 rounded-xl font-bold text-white overflow-hidden disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #10b981, #0d9488)' }}>
                    <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                      animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }} />
                    <span className="relative flex items-center justify-center gap-2">
                      {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Reset Password <ArrowRight size={16} /></>}
                    </span>
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* ── Step 4: Done ── */}
            {step === 'done' && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400/50 flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle size={36} className="text-emerald-400" />
                </motion.div>
                <h2 className="text-2xl font-black text-white mb-2">Password Reset!</h2>
                <p className="text-white/40 text-sm mb-8 leading-relaxed">
                  Your password has been updated successfully. You can now log in with your new password.
                </p>
                <motion.button
                  onClick={() => navigate('/login')}
                  whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(16,185,129,0.3)' }}
                  whileTap={{ scale: 0.97 }}
                  className="relative w-full py-4 rounded-xl font-bold text-white overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #10b981, #0d9488)' }}>
                  <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                    animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }} />
                  <span className="relative flex items-center justify-center gap-2">
                    Go to Login <ArrowRight size={16} />
                  </span>
                </motion.button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {step !== 'done' && (
          <p className="text-center text-white/30 mt-5 text-sm">
            Remember your password?{' '}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">Sign in</Link>
          </p>
        )}
      </motion.div>
    </div>
  );
}

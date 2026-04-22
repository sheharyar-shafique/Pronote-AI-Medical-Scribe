import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Bell, 
  Shield, 
  CreditCard, 
  FileText,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Lock,
  ExternalLink
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { Card, Button, Input, Toggle, Select, Modal } from '../components/ui';
import { useAuthStore, useSettingsStore } from '../store';
import { templates, specialties, pricingPlans } from '../data';
import { subscriptionsApi, authApi, usersApi } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();
  const { 
    selectedTemplate, 
    setTemplate, 
    autoSave, 
    notifications, 
    weeklySummary,
    noteReminders,
    productUpdates,
    toggleAutoSave, 
    toggleNotifications,
    toggleWeeklySummary,
    toggleNoteReminders,
    toggleProductUpdates
  } = useSettingsStore();
  
  const [activeTab, setActiveTab] = useState('general');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isVerifyingPayPal, setIsVerifyingPayPal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal'>('paypal');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    specialty: user?.specialty || 'General Medicine',
  });

  const tabs = [
    { id: 'general', label: 'General', icon: <User size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'templates', label: 'Templates', icon: <FileText size={18} /> },
    { id: 'security', label: 'Account & Security', icon: <Shield size={18} /> },
  ];

  const handleProfileSave = () => {
    updateUser({
      name: profileForm.name,
      specialty: profileForm.specialty,
    });
    toast.success('Profile updated successfully');
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast.success('Password changed successfully');
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleToggle2FA = () => {
    if (twoFactorEnabled) {
      setTwoFactorEnabled(false);
      toast.success('Two-factor authentication disabled');
    } else {
      setTwoFactorEnabled(true);
      toast.success('Two-factor authentication enabled');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setIsDeletingAccount(true);
    try {
      await usersApi.deleteAccount();
      toast.success('Account deleted successfully');
      logout();
      navigate('/');
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to delete account');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Verify PayPal subscription on return from PayPal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paypalSubId = params.get('subscription_id');
    if (paypalSubId) {
      setIsVerifyingPayPal(true);
      subscriptionsApi.verifyPayPalSubscription(paypalSubId)
        .then(() => {
          toast.success('PayPal subscription activated! Welcome aboard.');
          window.history.replaceState({}, '', '/settings');
        })
        .catch(() => toast.error('Could not verify PayPal subscription.'))
        .finally(() => setIsVerifyingPayPal(false));
    }
    if (params.get('success') === 'true') {
      toast.success('Subscription activated successfully!');
      window.history.replaceState({}, '', '/settings');
    }
    if (params.get('canceled') === 'true') {
      toast('Checkout cancelled.');
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  const handleUpgrade = async (planId: string) => {
    setIsUpgrading(true);
    try {
      const response = await subscriptionsApi.createCheckout(
        planId,
        `${window.location.origin}/settings?success=true`,
        `${window.location.origin}/settings?canceled=true`
      );
      if (response.url) {
        window.location.href = response.url;
      } else {
        toast.error('Could not create checkout session');
      }
    } catch (error) {
      const err = error as { message?: string; status?: number };
      toast.error(err.status === 503 ? 'Stripe not configured. Use PayPal instead.' : (err.message || 'Failed to start checkout'));
    } finally {
      setIsUpgrading(false);
    }
  };

  const handlePayPalUpgrade = async (planId: string) => {
    setIsUpgrading(true);
    try {
      const response = await subscriptionsApi.createPayPalCheckout(
        planId,
        `${window.location.origin}/settings`,
        `${window.location.origin}/settings?canceled=true`
      );
      if (response.url) window.location.href = response.url;
      else toast.error('Could not create PayPal checkout');
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to start PayPal checkout');
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <Sidebar>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-black text-white mb-2">Settings</h1>
          <p className="text-slate-400">
            Manage your account settings and preferences.
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:w-64 flex-shrink-0"
          >
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                    activeTab === tab.id
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span className="font-semibold text-sm">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Subscription Card */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white">Current Plan</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                  {user?.subscriptionPlan || 'Trial'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                {user?.subscriptionStatus === 'trial'
                  ? (() => {
                      const d = user.trialEndsAt
                        ? Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                        : 7;
                      return d === 0 ? '⚠️ Trial expires today!' : d === 1 ? '⏰ 1 day left on trial' : `⏳ ${d} days left on trial`;
                    })()
                  : `${user?.subscriptionPlan} plan`
                }
              </p>
              <button
                className="w-full py-2 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                onClick={() => setShowUpgradeModal(true)}
              >
                <CreditCard size={14} /> Upgrade Plan
              </button>
            </div>
          </motion.div>

          {/* Content Area */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1"
          >
            {activeTab === 'general' && (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
                <h2 className="text-lg font-black text-white mb-6">General Settings</h2>
                <div className="space-y-6">
                  <Input label="Full Name" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
                  <Input label="Email" type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} disabled helperText="Email cannot be changed" />
                  <Select label="Specialty" value={profileForm.specialty} onChange={(e) => setProfileForm({ ...profileForm, specialty: e.target.value })} options={specialties.map(s => ({ value: s, label: s }))} />
                  <div className="pt-4 border-t border-white/[0.08]">
                    <button onClick={handleProfileSave} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:opacity-90 transition-all text-sm">
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
                <h2 className="text-lg font-black text-white mb-6">Notification Settings</h2>
                <div className="space-y-6">
                  <Toggle enabled={notifications} onChange={toggleNotifications} label="Push Notifications" description="Receive notifications about your notes and account" />
                  <Toggle enabled={autoSave} onChange={toggleAutoSave} label="Auto-Save" description="Automatically save notes while editing" />
                  <div className="pt-4 border-t border-white/[0.08]">
                    <h3 className="font-bold text-white mb-4">Email Notifications</h3>
                    <div className="space-y-4">
                      <Toggle enabled={weeklySummary} onChange={toggleWeeklySummary} label="Weekly Summary" description="Receive a weekly summary of your activity" />
                      <Toggle enabled={noteReminders} onChange={toggleNoteReminders} label="Note Reminders" description="Get reminded about unsigned notes" />
                      <Toggle enabled={productUpdates} onChange={toggleProductUpdates} label="Product Updates" description="Learn about new features and improvements" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'templates' && (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
                <h2 className="text-lg font-black text-white mb-6">Template Settings</h2>
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Default Template</label>
                  <Select value={selectedTemplate} onChange={(e) => { const templateId = e.target.value as import('../types').NoteTemplate; setTemplate(templateId); }} options={templates.map(t => ({ value: t.id, label: t.name }))} />
                  <p className="text-sm text-slate-500 mt-2">This template will be used by default when creating new notes.</p>
                </div>
                <div className="pt-4 border-t border-white/[0.08]">
                  <h3 className="font-bold text-white mb-4">Available Templates</h3>
                  <div className="grid gap-3">
                    {templates.map((template) => (
                      <motion.div key={template.id} whileHover={{ scale: 1.01 }}
                        className={`p-4 border rounded-xl cursor-pointer transition-all ${
                          selectedTemplate === template.id
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                        }`}
                        onClick={() => setTemplate(template.id)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-white text-sm">{template.name}</h4>
                            <p className="text-xs text-slate-400 mt-0.5">{template.description}</p>
                          </div>
                          {selectedTemplate === template.id && <Check size={18} className="text-emerald-400" />}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
                <h2 className="text-lg font-black text-white mb-6">Account & Security</h2>
                <div className="space-y-4">
                  <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-white text-sm">Change Password</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Update your password regularly for security</p>
                      </div>
                      <button onClick={() => setShowPasswordModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-white/20 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg text-xs font-semibold transition-all">
                        <Lock size={12} /> Change
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-white text-sm">Two-Factor Authentication</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{twoFactorEnabled ? '2FA is enabled for your account' : 'Add an extra layer of security'}</p>
                      </div>
                      <button onClick={handleToggle2FA} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${twoFactorEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'border border-white/20 text-slate-300 hover:bg-white/10'}`}>
                        {twoFactorEnabled ? '✓ Enabled' : 'Enable'}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl cursor-pointer hover:bg-white/[0.07] transition-colors" onClick={() => setShowPrivacyModal(true)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-white text-sm">Privacy Policy</h4>
                        <p className="text-xs text-slate-400 mt-0.5">View our privacy policy</p>
                      </div>
                      <ExternalLink size={16} className="text-slate-500" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/[0.08]">
                    <h3 className="font-bold text-red-400 mb-3 text-sm">Danger Zone</h3>
                    <div className="p-4 border border-red-500/20 rounded-xl bg-red-500/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-red-300 text-sm">Delete Account</h4>
                          <p className="text-xs text-red-400/70 mt-0.5">Permanently delete your account and all data</p>
                        </div>
                        <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 rounded-lg text-xs font-bold transition-all">
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Upgrade Modal */}
        <Modal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} title="Choose Your Plan" size="full">

          {/* Verifying PayPal banner */}
          {isVerifyingPayPal && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <p className="text-sm text-blue-700 font-medium">Verifying your PayPal subscription…</p>
            </div>
          )}

          {/* Payment Method Toggle */}
          <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setPaymentMethod('paypal')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                paymentMethod === 'paypal'
                  ? 'bg-[#003087] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="text-base">🅿️</span> PayPal
            </button>
            <button
              onClick={() => setPaymentMethod('stripe')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                paymentMethod === 'stripe'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard size={16} /> Credit / Debit Card
            </button>
          </div>

          {/* Info banners */}
          {paymentMethod === 'paypal' && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-sm text-blue-700">
              🔒 You'll be redirected to PayPal to complete your subscription securely.
            </div>
          )}
          {paymentMethod === 'stripe' && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-sm text-amber-700">
              <AlertCircle size={15} className="flex-shrink-0" />
              Card payments require Stripe configuration. <strong className="ml-1">Switch to PayPal for instant checkout.</strong>
            </div>
          )}

          {/* Plan cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pricingPlans.map((plan) => (
              <div key={plan.id}
                className={`p-5 border-2 rounded-xl flex flex-col h-full ${
                  plan.highlighted ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'
                }`}
              >
                {plan.highlighted && (
                  <span className="inline-block text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full mb-2 w-fit">
                    MOST POPULAR
                  </span>
                )}
                <div>
                  <h4 className="font-semibold text-gray-900 text-lg">{plan.name}</h4>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {plan.price ? `$${plan.price}` : 'Custom'}
                    {plan.price && <span className="text-sm font-normal text-gray-500">/{plan.period}</span>}
                  </p>
                  {plan.pricePerMonth && plan.period === 'year' && (
                    <p className="text-sm text-emerald-600 font-medium">${plan.pricePerMonth.toFixed(2)}/mo</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                </div>
                <ul className="space-y-2 mt-4 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <Check size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {paymentMethod === 'paypal' ? (
                  <button
                    disabled={isUpgrading}
                    onClick={() => handlePayPalUpgrade(plan.id)}
                    className="w-full mt-5 py-3 px-4 bg-[#FFC439] hover:bg-[#f0b429] text-[#003087] font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isUpgrading
                      ? <div className="w-4 h-4 border-2 border-[#003087]/40 border-t-[#003087] rounded-full animate-spin" />
                      : <><span>🅿️</span> Pay with PayPal</>
                    }
                  </button>
                ) : (
                  <Button
                    variant={plan.highlighted ? 'primary' : 'outline'}
                    className="w-full mt-5"
                    disabled={isUpgrading}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {isUpgrading ? 'Processing…' : plan.cta}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Modal>

        {/* Change Password Modal */}
        <Modal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false);
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setShowPasswords({ current: false, new: false, confirm: false });
          }}
          title="Change Password"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <div className="relative">
                <Input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <Input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowPasswordModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Account Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteConfirmText('');
          }}
          title="Delete Account"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                <strong>Warning:</strong> This action cannot be undone. All your data, including notes, 
                templates, and account information will be permanently deleted.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-mono bg-gray-100 px-1 rounded">DELETE</span> to confirm:
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="font-mono"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-red-500 hover:bg-red-600"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount || deleteConfirmText !== 'DELETE'}
              >
                <Trash2 size={14} className="mr-1" />
                {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Privacy Policy Modal */}
        <Modal
          isOpen={showPrivacyModal}
          onClose={() => setShowPrivacyModal(false)}
          title="Privacy Policy"
          size="lg"
        >
          <div className="prose prose-sm max-w-none text-gray-600">
            <h3 className="text-lg font-semibold text-gray-900">1. Information We Collect</h3>
            <p>
              We collect information you provide directly to us, such as when you create an account, 
              use our services, or contact us for support. This includes:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account information (name, email, password)</li>
              <li>Clinical notes and documentation you create</li>
              <li>Audio recordings for dictation features</li>
              <li>Usage data and preferences</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-4">2. How We Use Your Information</h3>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide, maintain, and improve our services</li>
              <li>Process your clinical documentation</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-4">3. Data Security</h3>
            <p>
              We take reasonable measures to protect your personal information. All data is encrypted 
              in transit and at rest. We comply with HIPAA requirements for handling healthcare information.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-4">4. Data Retention</h3>
            <p>
              We retain your data for as long as your account is active or as needed to provide services. 
              You can request deletion of your data at any time through the account settings.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-4">5. Contact Us</h3>
            <p>
              If you have questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:privacy@pronote.com" className="text-emerald-600 hover:text-emerald-700">
                privacy@pronote.com
              </a>
            </p>
          </div>
          <div className="flex justify-end pt-6">
            <Button onClick={() => setShowPrivacyModal(false)}>
              Close
            </Button>
          </div>
        </Modal>
      </div>
    </Sidebar>
  );
}
